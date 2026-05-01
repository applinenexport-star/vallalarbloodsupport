from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Header, Request, Depends
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
import uuid
import bcrypt
import jwt as pyjwt
import httpx
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ['DB_NAME']]

TWILIO_ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
TWILIO_AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
TWILIO_VERIFY_SERVICE_SID = os.environ.get('TWILIO_VERIFY_SERVICE_SID', '').strip()
DEV_MODE_OTP = os.environ.get('DEV_MODE_OTP', '123456').strip()
ADMIN_PIN = os.environ.get('ADMIN_PIN', '0000').strip()
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret-change-me').strip()
SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL', 'admin@example.com').strip().lower()
SUPER_ADMIN_PASSWORD = os.environ.get('SUPER_ADMIN_PASSWORD', 'admin123').strip()
JWT_ALG = "HS256"

twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID:
    try:
        from twilio.rest import Client as TwilioClient
        twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except Exception as e:
        logging.warning(f"Twilio init failed: {e}")

app = FastAPI()
api_router = APIRouter(prefix="/api")

COOLDOWN_DAYS = 150  # 5 months

# ---------- Models ----------
class SendOtpRequest(BaseModel):
    phone_number: str

class VerifyOtpRequest(BaseModel):
    phone_number: str
    code: str

class Donor(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    phone_normalized: str = ""
    email: Optional[str] = None
    blood_group: str
    city: str
    state: str = "Tamil Nadu"
    town: Optional[str] = None
    status: str = "Available"  # "Available" or "Not Available"
    age: Optional[int] = None
    diabetic: Optional[str] = None  # "Diabetic" / "Non-Diabetic"
    last_donation_date: Optional[str] = None  # ISO yyyy-mm-dd
    blocked: bool = False
    owner: bool = False  # True if self-registered

class DonorRegister(BaseModel):
    name: str
    phone: str
    age: int
    blood_group: str
    state: str
    city: str
    email: Optional[str] = None
    town: Optional[str] = None
    diabetic: Optional[str] = None

class DonorUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    blood_group: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    town: Optional[str] = None
    diabetic: Optional[str] = None
    status: Optional[str] = None
    last_donation_date: Optional[str] = None
    email: Optional[str] = None

class ComplaintCreate(BaseModel):
    name: str
    phone: str
    details: str

class Complaint(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    details: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BloodRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    patient_name: str
    blood_group: str
    hospital: str
    hospital_city: Optional[str] = None
    hospital_phone: Optional[str] = None
    units: int
    attender_name: str
    attender_phone: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BloodRequestCreate(BaseModel):
    patient_name: str
    blood_group: str
    hospital: str
    hospital_city: Optional[str] = None
    hospital_phone: Optional[str] = None
    units: int
    attender_name: str
    attender_phone: str

class AdminLogin(BaseModel):
    pin: str

class AdminLoginEmail(BaseModel):
    email: str
    password: str

class AdminInvite(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class BlockRequest(BaseModel):
    phone: str
    reason: Optional[str] = None

class SheetSyncRequest(BaseModel):
    sheet_url: str

# ---------- Helpers ----------
def normalize_phone(phone: str) -> str:
    p = (phone or "").strip().replace(" ", "").replace("-", "")
    if p.startswith("+"):
        return p
    if len(p) == 10 and p.isdigit():
        return f"+91{p}"
    if p.startswith("91") and len(p) == 12:
        return f"+{p}"
    return p

def phone_key(phone: str) -> str:
    """Last 10 digits used as a stable comparison key."""
    digits = "".join(c for c in (phone or "") if c.isdigit())
    return digits[-10:] if len(digits) >= 10 else digits

def donor_available(donor: dict) -> bool:
    if donor.get("blocked"):
        return False
    if (donor.get("status") or "Available") != "Available":
        return False
    last = donor.get("last_donation_date")
    if last:
        try:
            d = datetime.fromisoformat(last).date()
            if (date.today() - d).days < COOLDOWN_DAYS:
                return False
        except Exception:
            pass
    return True

CITY_STATE_MAP = {
    "coimbatore": "Tamil Nadu", "tirupur": "Tamil Nadu", "chennai": "Tamil Nadu",
    "madurai": "Tamil Nadu", "salem": "Tamil Nadu", "erode": "Tamil Nadu",
    "trichy": "Tamil Nadu", "tiruchirappalli": "Tamil Nadu",
}
def resolve_state(city: str, fallback: str = "Tamil Nadu") -> str:
    return CITY_STATE_MAP.get((city or "").strip().lower(), fallback)

async def verify_admin(x_admin_pin: Optional[str]) -> None:
    if (x_admin_pin or "").strip() != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Admin authentication required")

# ---------- JWT Admin Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_pw(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_admin_token(admin_id: str, email: str, role: str) -> str:
    payload = {
        "sub": admin_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "admin",
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def get_admin(authorization: Optional[str] = Header(None)) -> dict:
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Admin token required")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "admin":
        raise HTTPException(status_code=401, detail="Invalid token type")
    admin = await db.admins.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    return admin

async def require_super_admin(admin: dict = Depends(get_admin)) -> dict:
    if admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin only")
    return admin

# ---------- Auth ----------
@api_router.post("/auth/send-otp")
async def send_otp(req: SendOtpRequest):
    phone = normalize_phone(req.phone_number)
    if not phone or len(phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    # Check blocklist
    blk = await db.blocklist.find_one({"phone_key": phone_key(phone)})
    if blk:
        raise HTTPException(status_code=403, detail="This phone number has been blocked.")

    if twilio_client:
        try:
            v = twilio_client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)\
                .verifications.create(to=phone, channel="sms")
            return {"status": v.status, "phone": phone, "mode": "twilio"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Twilio error: {e}")

    await db.otp_sessions.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": DEV_MODE_OTP,
                  "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"status": "pending", "phone": phone, "mode": "dev",
            "hint": f"Use OTP {DEV_MODE_OTP}"}

@api_router.post("/auth/verify-otp")
async def verify_otp(req: VerifyOtpRequest):
    phone = normalize_phone(req.phone_number)
    code = req.code.strip()

    if twilio_client:
        try:
            check = twilio_client.verify.v2.services(TWILIO_VERIFY_SERVICE_SID)\
                .verification_checks.create(to=phone, code=code)
            if check.status != "approved":
                raise HTTPException(status_code=400, detail="Invalid OTP")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Twilio error: {e}")
    else:
        if code != DEV_MODE_OTP:
            raise HTTPException(status_code=400, detail="Invalid OTP (dev mode expects 123456)")

    token = str(uuid.uuid4())
    await db.sessions.insert_one({
        "token": token, "phone": phone,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Detect if this phone is a registered donor (self-registered)
    pk = phone_key(phone)
    donor = await db.donors.find_one({"phone_normalized": pk, "owner": True}, {"_id": 0})
    return {
        "valid": True, "token": token, "phone": phone,
        "is_donor": bool(donor),
        "donor": donor,
    }

# ---------- Donor Filters ----------
@api_router.get("/donors/filters")
async def donor_filters():
    pipeline = [
        {"$match": {"blocked": {"$ne": True}, "status": {"$ne": "Not Available"}}},
        {"$group": {"_id": {"state": "$state", "city": "$city", "blood_group": "$blood_group"}}},
    ]
    rows = await db.donors.aggregate(pipeline).to_list(20000)
    states: set = set()
    city_by_state: dict = {}
    blood_groups: set = set()
    for r in rows:
        g = r["_id"]
        if g.get("state"):
            states.add(g["state"])
            city_by_state.setdefault(g["state"], set()).add(g.get("city", ""))
        if g.get("blood_group"):
            blood_groups.add(g["blood_group"])
    return {
        "states": sorted(states),
        "cities_by_state": {k: sorted(v) for k, v in city_by_state.items()},
        "blood_groups": sorted(blood_groups),
    }

@api_router.get("/donors")
async def list_donors(state: Optional[str] = None,
                      city: Optional[str] = None,
                      blood_group: Optional[str] = None):
    q: dict = {"blocked": {"$ne": True}}
    if state: q["state"] = state
    if city: q["city"] = city
    if blood_group: q["blood_group"] = blood_group
    cursor = db.donors.find(q, {"_id": 0}).limit(2000)
    raw = await cursor.to_list(2000)
    # Apply availability filtering (status + cooldown)
    donors = [d for d in raw if donor_available(d)]
    return {"count": len(donors), "donors": donors}

# ---------- Donor Register / Profile ----------
@api_router.post("/donors/register", response_model=Donor)
async def register_donor(payload: DonorRegister):
    if not payload.name.strip() or not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Name and phone are required")
    if payload.age < 16 or payload.age > 80:
        raise HTTPException(status_code=400, detail="Age must be between 16 and 80")
    pk = phone_key(payload.phone)
    if not pk or len(pk) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    # prevent duplicate self-registration
    existing = await db.donors.find_one({"phone_normalized": pk, "owner": True})
    if existing:
        raise HTTPException(status_code=409, detail="This phone is already registered as a donor")

    donor = Donor(
        name=payload.name.strip(),
        phone=pk,
        phone_normalized=pk,
        email=(payload.email or "").strip() or None,
        blood_group=payload.blood_group.strip(),
        city=payload.city.strip(),
        state=payload.state.strip(),
        town=(payload.town or "").strip() or None,
        status="Available",
        age=payload.age,
        diabetic=(payload.diabetic or None),
        owner=True,
    )
    await db.donors.insert_one(donor.dict())
    # Option C: record in pending_registrations for super admin export
    await db.pending_registrations.insert_one({
        "id": donor.id,
        "name": donor.name, "phone": donor.phone, "age": donor.age,
        "blood_group": donor.blood_group, "state": donor.state, "city": donor.city,
        "town": donor.town, "diabetic": donor.diabetic, "email": donor.email,
        "registered_at": datetime.now(timezone.utc).isoformat(),
        "synced": False,
    })
    return donor

@api_router.get("/donors/me")
async def get_me(phone: str):
    pk = phone_key(phone)
    donor = await db.donors.find_one({"phone_normalized": pk, "owner": True}, {"_id": 0})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")
    return donor

@api_router.put("/donors/me")
async def update_me(phone: str, payload: DonorUpdate):
    pk = phone_key(phone)
    donor = await db.donors.find_one({"phone_normalized": pk, "owner": True})
    if not donor:
        raise HTTPException(status_code=404, detail="Donor profile not found")

    updates = {k: v for k, v in payload.dict().items() if v is not None and v != ""}
    if "status" in updates and updates["status"] not in ("Available", "Not Available"):
        raise HTTPException(status_code=400, detail="Invalid status")
    if "age" in updates and (updates["age"] < 16 or updates["age"] > 80):
        raise HTTPException(status_code=400, detail="Age must be between 16 and 80")
    if "last_donation_date" in updates:
        try:
            datetime.fromisoformat(updates["last_donation_date"])
        except Exception:
            raise HTTPException(status_code=400, detail="last_donation_date must be YYYY-MM-DD")

    await db.donors.update_one({"_id": donor["_id"]}, {"$set": updates})
    updated = await db.donors.find_one({"_id": donor["_id"]}, {"_id": 0})
    return updated

# ---------- Complaints ----------
@api_router.post("/complaints", response_model=Complaint)
async def create_complaint(payload: ComplaintCreate):
    if not payload.name.strip() or not payload.phone.strip() or not payload.details.strip():
        raise HTTPException(status_code=400, detail="All fields are required")
    obj = Complaint(name=payload.name.strip(), phone=payload.phone.strip(),
                    details=payload.details.strip())
    doc = obj.dict()
    doc["created_at"] = obj.created_at.isoformat()
    await db.complaints.insert_one(doc)
    return obj

# ---------- Blood Requests ----------
@api_router.post("/requests", response_model=BloodRequest)
async def create_request(payload: BloodRequestCreate):
    obj = BloodRequest(**payload.dict())
    doc = obj.dict()
    doc["created_at"] = obj.created_at.isoformat()
    await db.requests.insert_one(doc)
    return obj

# ---------- CSV Upload ----------
@api_router.post("/donors/upload-csv")
async def upload_csv(file: UploadFile = File(...), admin: dict = Depends(get_admin)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")
    raw = await file.read()
    text = raw.decode("utf-8", errors="ignore")
    count = await _ingest_csv_text(text)
    return {"inserted": count}

async def _ingest_csv_text(text: str) -> int:
    reader = csv.DictReader(io.StringIO(text))
    def get(row, *keys):
        for k in keys:
            for rk, rv in row.items():
                if rk and rk.strip().lower() == k.lower():
                    return (rv or "").strip()
        return ""

    inserted = 0
    for row in reader:
        name = get(row, "Doners Name", "Donor Name", "Name")
        phone = get(row, "Phone no", "Phone", "Phone Number", "Mobile")
        bg = get(row, "Blood group", "Blood Group")
        city = get(row, "City")
        state = get(row, "State") or resolve_state(city)
        status = get(row, "Status") or "Available"
        if not name or not phone or not bg or not city:
            continue
        phone = phone.replace(" ", "")
        pk = phone_key(phone)
        donor_doc = Donor(
            name=name, phone=phone, phone_normalized=pk,
            blood_group=bg, city=city.strip().title(),
            state=state, status=status, owner=False,
        ).dict()
        # Upsert by (phone_normalized + blood_group) so re-syncs don't duplicate.
        # Skip self-registered (owner=True) rows so we never overwrite a donor's own data.
        await db.donors.update_one(
            {"phone_normalized": pk, "blood_group": bg, "owner": {"$ne": True}},
            {"$set": {
                "name": donor_doc["name"], "phone": donor_doc["phone"],
                "phone_normalized": pk, "blood_group": bg,
                "city": donor_doc["city"], "state": donor_doc["state"],
                "status": donor_doc["status"], "owner": False,
            }, "$setOnInsert": {"id": donor_doc["id"], "blocked": False}},
            upsert=True,
        )
        inserted += 1
    return inserted

# ---------- Admin ----------
@api_router.post("/admin/login")
async def admin_login(payload: AdminLogin):
    if (payload.pin or "").strip() != ADMIN_PIN:
        raise HTTPException(status_code=401, detail="Invalid admin PIN")
    return {"ok": True}

@api_router.post("/admin/block")
async def admin_block(payload: BlockRequest, admin: dict = Depends(get_admin)):
    pk = phone_key(payload.phone)
    if not pk:
        raise HTTPException(status_code=400, detail="Invalid phone")
    await db.blocklist.update_one(
        {"phone_key": pk},
        {"$set": {"phone_key": pk, "phone": payload.phone,
                  "reason": payload.reason or "",
                  "blocked_at": datetime.now(timezone.utc).isoformat(),
                  "blocked_by": admin.get("email")}},
        upsert=True,
    )
    await db.donors.update_many({"phone_normalized": pk}, {"$set": {"blocked": True}})
    return {"ok": True, "phone_key": pk}

@api_router.post("/admin/unblock")
async def admin_unblock(payload: BlockRequest, admin: dict = Depends(get_admin)):
    pk = phone_key(payload.phone)
    await db.blocklist.delete_one({"phone_key": pk})
    await db.donors.update_many({"phone_normalized": pk}, {"$set": {"blocked": False}})
    return {"ok": True}

@api_router.get("/admin/blocklist")
async def admin_blocklist(admin: dict = Depends(get_admin)):
    rows = await db.blocklist.find({}, {"_id": 0}).to_list(1000)
    return {"items": rows}

@api_router.get("/admin/complaints")
async def admin_complaints(admin: dict = Depends(get_admin)):
    rows = await db.complaints.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"items": rows}

@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin)):
    donors = await db.donors.count_documents({})
    registered = await db.donors.count_documents({"owner": True})
    blocked = await db.blocklist.count_documents({})
    complaints = await db.complaints.count_documents({})
    pending = await db.pending_registrations.count_documents({"synced": {"$ne": True}})
    return {"donors": donors, "registered": registered,
            "blocked": blocked, "complaints": complaints,
            "pending_registrations": pending}

# ---------- JWT Admin Auth Endpoints ----------
@api_router.post("/admin/auth/login")
async def admin_auth_login(payload: AdminLoginEmail):
    email = (payload.email or "").strip().lower()
    pw = (payload.password or "").strip()
    if not email or not pw:
        raise HTTPException(status_code=400, detail="Email and password required")
    admin = await db.admins.find_one({"email": email})
    if not admin or not verify_pw(pw, admin.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_admin_token(admin["id"], email, admin.get("role", "admin"))
    return {
        "token": token,
        "admin": {"id": admin["id"], "email": email,
                  "name": admin.get("name"), "role": admin.get("role", "admin")},
    }

@api_router.get("/admin/auth/me")
async def admin_auth_me(admin: dict = Depends(get_admin)):
    return admin

@api_router.post("/admin/auth/invite")
async def admin_auth_invite(payload: AdminInvite, super_admin: dict = Depends(require_super_admin)):
    email = (payload.email or "").strip().lower()
    pw = (payload.password or "").strip()
    if not email or len(pw) < 6:
        raise HTTPException(status_code=400, detail="Email and 6+ char password required")
    existing = await db.admins.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Admin with this email already exists")
    new_admin = {
        "id": str(uuid.uuid4()), "email": email,
        "password_hash": hash_pw(pw), "name": payload.name or email.split("@")[0],
        "role": "admin",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "invited_by": super_admin["email"],
    }
    await db.admins.insert_one(new_admin)
    return {"id": new_admin["id"], "email": email, "name": new_admin["name"], "role": "admin"}

@api_router.get("/admin/auth/list")
async def admin_auth_list(super_admin: dict = Depends(require_super_admin)):
    rows = await db.admins.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return {"items": rows}

@api_router.delete("/admin/auth/{admin_id}")
async def admin_auth_delete(admin_id: str, super_admin: dict = Depends(require_super_admin)):
    target = await db.admins.find_one({"id": admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    if target.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super admin")
    await db.admins.delete_one({"id": admin_id})
    return {"ok": True}

# ---------- Google Sheet Sync ----------
def sheet_export_url(sheet_url: str) -> str:
    """Convert a Google Sheet share URL to CSV export URL."""
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", sheet_url or "")
    if not m:
        return ""
    sid = m.group(1)
    gid_m = re.search(r"gid=(\d+)", sheet_url or "")
    gid = gid_m.group(1) if gid_m else "0"
    return f"https://docs.google.com/spreadsheets/d/{sid}/export?format=csv&gid={gid}"

@api_router.post("/donors/sync-sheet")
async def sync_sheet(payload: SheetSyncRequest, admin: dict = Depends(get_admin)):
    url = sheet_export_url(payload.sheet_url)
    if not url:
        raise HTTPException(status_code=400, detail="Invalid Google Sheet URL")
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        r = await client.get(url)
    ctype = r.headers.get("content-type", "")
    if r.status_code != 200 or "html" in ctype.lower():
        raise HTTPException(
            status_code=400,
            detail="Could not fetch sheet as CSV. Make sure sharing is set to "
                   "'Anyone with the link — Viewer'."
        )
    text = r.text
    inserted = await _ingest_csv_text(text)
    # Save the sheet URL in settings for later use
    await db.settings.update_one(
        {"_id": "donors_sheet"},
        {"$set": {"_id": "donors_sheet", "url": payload.sheet_url,
                  "last_synced": datetime.now(timezone.utc).isoformat(),
                  "last_synced_by": admin.get("email")}},
        upsert=True,
    )
    return {"inserted": inserted}

@api_router.get("/admin/sheet-settings")
async def get_sheet_settings(admin: dict = Depends(get_admin)):
    row = await db.settings.find_one({"_id": "donors_sheet"})
    if not row:
        return {"url": "", "last_synced": None}
    return {"url": row.get("url", ""), "last_synced": row.get("last_synced")}

# ---------- Pending Registrations (Option C) ----------
@api_router.get("/admin/pending-registrations")
async def admin_pending_list(admin: dict = Depends(get_admin)):
    rows = await db.pending_registrations.find(
        {"synced": {"$ne": True}}, {"_id": 0}
    ).sort("registered_at", -1).to_list(5000)
    return {"items": rows, "count": len(rows)}

@api_router.get("/admin/pending-registrations/export")
async def admin_pending_export(admin: dict = Depends(get_admin)):
    rows = await db.pending_registrations.find(
        {"synced": {"$ne": True}}, {"_id": 0}
    ).sort("registered_at", 1).to_list(5000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Registered At", "Name", "Phone", "Age", "Blood Group",
                     "State", "City", "Town/Area", "Diabetic", "Email"])
    for d in rows:
        writer.writerow([
            d.get("registered_at", ""), d.get("name", ""), d.get("phone", ""),
            d.get("age", ""), d.get("blood_group", ""),
            d.get("state", ""), d.get("city", ""), d.get("town", "") or "",
            d.get("diabetic", "") or "", d.get("email", "") or "",
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pending_donors.csv"},
    )

@api_router.post("/admin/pending-registrations/mark-synced")
async def admin_pending_mark(admin: dict = Depends(get_admin)):
    res = await db.pending_registrations.update_many(
        {"synced": {"$ne": True}}, {"$set": {"synced": True, "synced_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"marked": res.modified_count}

# ---------- Root ----------
@api_router.get("/")
async def root():
    return {"service": "blood-donor-api", "status": "ok",
            "otp_mode": "twilio" if twilio_client else "dev"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def seed_on_startup():
    # Seed super admin
    try:
        await db.admins.create_index("email", unique=True)
        existing = await db.admins.find_one({"email": SUPER_ADMIN_EMAIL})
        if not existing:
            await db.admins.insert_one({
                "id": str(uuid.uuid4()),
                "email": SUPER_ADMIN_EMAIL,
                "password_hash": hash_pw(SUPER_ADMIN_PASSWORD),
                "name": "Super Admin",
                "role": "super_admin",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Seeded super admin: {SUPER_ADMIN_EMAIL}")
        elif not verify_pw(SUPER_ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.admins.update_one(
                {"email": SUPER_ADMIN_EMAIL},
                {"$set": {"password_hash": hash_pw(SUPER_ADMIN_PASSWORD),
                          "role": "super_admin"}},
            )
            logger.info("Updated super admin password")
    except Exception as e:
        logger.error(f"Super admin seed error: {e}")

    # Backfill phone_normalized for existing donors (simple Python loop)
    try:
        async for d in db.donors.find({"$or": [
            {"phone_normalized": {"$exists": False}},
            {"phone_normalized": None},
            {"phone_normalized": ""},
        ]}, {"_id": 1, "phone": 1}):
            pk = phone_key(d.get("phone", ""))
            await db.donors.update_one({"_id": d["_id"]}, {"$set": {"phone_normalized": pk}})
    except Exception as e:
        logger.warning(f"phone_normalized backfill warning: {e}")

    try:
        count = await db.donors.count_documents({})
        if count == 0:
            seed_path = ROOT_DIR / "seed_donors.csv"
            if seed_path.exists():
                with open(seed_path, "r", encoding="utf-8", errors="ignore") as f:
                    text = f.read()
                inserted = await _ingest_csv_text(text)
                logger.info(f"Seeded {inserted} donors from {seed_path}")
        else:
            logger.info(f"Donors collection already has {count} rows.")
    except Exception as e:
        logger.error(f"Seed error: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    mongo_client.close()
