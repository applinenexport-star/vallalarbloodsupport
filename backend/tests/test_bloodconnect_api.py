"""BloodConnect API Backend Tests — JWT admin auth iteration.

Covers:
- Root health + otp mode (should now be 'twilio')
- /api/admin/auth/login (super admin email+password)
- /api/admin/auth/me  /invite  /list  /{id} delete
- Previously PIN-gated endpoints now require Bearer token
- /api/donors/sync-sheet  (invalid URL, missing auth)
- /api/admin/pending-registrations  (list / export / mark-synced)
- /api/donors/register inserts into pending_registrations
- /api/donors/filters extended BG set
- /api/auth/send-otp returns mode='twilio' (live keys)
"""
import os
import io
import time
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / 'frontend' / '.env')
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("EXPO_PUBLIC_BACKEND_URL not set")

SUPER_EMAIL = "gogreenrevolutiontn@gmail.com"
SUPER_PASS = "Star1981$$$"

# module-scoped tokens shared across tests
_super_token = None
_regular_admin = {"email": f"test_admin_{uuid.uuid4().hex[:6]}@example.com",
                  "password": "test1234",
                  "name": "TestAdmin",
                  "id": None,
                  "token": None}


def _super_headers():
    global _super_token
    if _super_token is None:
        r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                          json={"email": SUPER_EMAIL, "password": SUPER_PASS})
        assert r.status_code == 200, f"Super admin login failed: {r.text}"
        _super_token = r.json()["token"]
    return {"Authorization": f"Bearer {_super_token}"}


# -------- Root / Health --------
class TestHealth:
    def test_root_otp_mode_twilio(self):
        r = requests.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        d = r.json()
        assert d["service"] == "blood-donor-api"
        # Twilio keys configured → otp_mode should be 'twilio'
        assert d["otp_mode"] == "twilio", f"Expected twilio mode, got {d['otp_mode']}"


# -------- Twilio send-otp shape (do not spam real SMS) --------
class TestSendOtpShape:
    def test_send_otp_invalid_phone(self):
        r = requests.post(f"{BASE_URL}/api/auth/send-otp", json={"phone_number": "12"})
        assert r.status_code == 400


# -------- JWT Admin Auth --------
class TestAdminAuth:
    def test_super_login_ok(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                          json={"email": SUPER_EMAIL, "password": SUPER_PASS})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and d["token"]
        assert d["admin"]["email"] == SUPER_EMAIL
        assert d["admin"]["role"] == "super_admin"
        assert "password_hash" not in d["admin"]

    def test_login_wrong_password_401(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                          json={"email": SUPER_EMAIL, "password": "WrongPass123"})
        assert r.status_code == 401

    def test_login_missing_fields_400(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                          json={"email": "", "password": ""})
        assert r.status_code == 400

    def test_me_without_token_401(self):
        r = requests.get(f"{BASE_URL}/api/admin/auth/me")
        assert r.status_code == 401

    def test_me_with_super_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/auth/me", headers=_super_headers())
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == SUPER_EMAIL
        assert d["role"] == "super_admin"
        assert "password_hash" not in d
        assert "_id" not in d

    def test_invite_regular_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/invite",
                          headers=_super_headers(),
                          json={"email": _regular_admin["email"],
                                "password": _regular_admin["password"],
                                "name": _regular_admin["name"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == _regular_admin["email"]
        assert d["role"] == "admin"
        _regular_admin["id"] = d["id"]

    def test_invite_duplicate_email_409(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/invite",
                          headers=_super_headers(),
                          json={"email": _regular_admin["email"],
                                "password": "whatever99"})
        assert r.status_code == 409

    def test_invite_short_password_400(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/invite",
                          headers=_super_headers(),
                          json={"email": f"short_{uuid.uuid4().hex[:4]}@ex.com",
                                "password": "abc"})
        assert r.status_code == 400

    def test_regular_admin_can_login(self):
        r = requests.post(f"{BASE_URL}/api/admin/auth/login",
                          json={"email": _regular_admin["email"],
                                "password": _regular_admin["password"]})
        assert r.status_code == 200
        d = r.json()
        _regular_admin["token"] = d["token"]
        assert d["admin"]["role"] == "admin"

    def test_admin_list_super_only(self):
        # Super admin should get list
        r = requests.get(f"{BASE_URL}/api/admin/auth/list", headers=_super_headers())
        assert r.status_code == 200
        items = r.json()["items"]
        emails = [a["email"] for a in items]
        assert SUPER_EMAIL in emails
        assert _regular_admin["email"] in emails
        for a in items:
            assert "password_hash" not in a
            assert "_id" not in a

    def test_admin_list_regular_gets_403(self):
        assert _regular_admin["token"], "regular token not set"
        r = requests.get(f"{BASE_URL}/api/admin/auth/list",
                         headers={"Authorization": f"Bearer {_regular_admin['token']}"})
        assert r.status_code == 403

    def test_cannot_delete_super_admin(self):
        # Fetch super admin id
        r = requests.get(f"{BASE_URL}/api/admin/auth/list", headers=_super_headers())
        super_id = next(a["id"] for a in r.json()["items"] if a["email"] == SUPER_EMAIL)
        r2 = requests.delete(f"{BASE_URL}/api/admin/auth/{super_id}",
                             headers=_super_headers())
        assert r2.status_code == 400

    def test_delete_regular_admin(self):
        assert _regular_admin["id"]
        r = requests.delete(f"{BASE_URL}/api/admin/auth/{_regular_admin['id']}",
                            headers=_super_headers())
        assert r.status_code == 200
        # verify it's gone
        r2 = requests.get(f"{BASE_URL}/api/admin/auth/list", headers=_super_headers())
        emails = [a["email"] for a in r2.json()["items"]]
        assert _regular_admin["email"] not in emails


# -------- Legacy endpoints now require Bearer (NOT PIN) --------
class TestLegacyEndpointsNowJWT:
    BAD_PIN = {"X-Admin-Pin": "0000"}

    def test_blocklist_with_only_pin_fails(self):
        r = requests.get(f"{BASE_URL}/api/admin/blocklist", headers=self.BAD_PIN)
        assert r.status_code == 401

    def test_blocklist_with_bearer_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/blocklist", headers=_super_headers())
        assert r.status_code == 200
        assert "items" in r.json()

    def test_complaints_with_only_pin_fails(self):
        r = requests.get(f"{BASE_URL}/api/admin/complaints", headers=self.BAD_PIN)
        assert r.status_code == 401

    def test_complaints_with_bearer_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/complaints", headers=_super_headers())
        assert r.status_code == 200

    def test_block_requires_bearer(self):
        r = requests.post(f"{BASE_URL}/api/admin/block",
                          json={"phone": "9111111122"}, headers=self.BAD_PIN)
        assert r.status_code == 401

    def test_block_and_unblock_with_bearer(self):
        p = "9111111122"
        r = requests.post(f"{BASE_URL}/api/admin/block",
                          json={"phone": p, "reason": "test"}, headers=_super_headers())
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/admin/blocklist", headers=_super_headers())
        keys = [i.get("phone_key") for i in r2.json()["items"]]
        assert p in keys
        r3 = requests.post(f"{BASE_URL}/api/admin/unblock",
                           json={"phone": p}, headers=_super_headers())
        assert r3.status_code == 200

    def test_upload_csv_with_pin_fails(self):
        csv_data = "Doners Name,Phone no,Blood group,City\nTEST_G,9999999990,O+,Chennai\n"
        files = {'file': ('t.csv', io.BytesIO(csv_data.encode()), 'text/csv')}
        r = requests.post(f"{BASE_URL}/api/donors/upload-csv",
                          files=files, headers=self.BAD_PIN)
        assert r.status_code == 401


# -------- Google Sheet Sync --------
class TestSheetSync:
    def test_sync_without_auth_401(self):
        r = requests.post(f"{BASE_URL}/api/donors/sync-sheet",
                          json={"sheet_url": "https://example.com"})
        assert r.status_code == 401

    def test_sync_invalid_url_400(self):
        r = requests.post(f"{BASE_URL}/api/donors/sync-sheet",
                          json={"sheet_url": "not-a-valid-sheet-url"},
                          headers=_super_headers())
        assert r.status_code == 400

    def test_sheet_settings_get(self):
        r = requests.get(f"{BASE_URL}/api/admin/sheet-settings",
                         headers=_super_headers())
        assert r.status_code == 200
        d = r.json()
        assert "url" in d


# -------- Pending Registrations --------
PENDING_PHONE = f"99000{int(time.time()) % 100000:05d}"

class TestPendingRegistrations:
    def test_register_creates_pending(self):
        r = requests.post(f"{BASE_URL}/api/donors/register", json={
            "name": "TEST_Pending", "phone": PENDING_PHONE, "age": 27,
            "blood_group": "O+", "state": "Tamil Nadu", "city": "Chennai",
            "diabetic": "Non-Diabetic",
        })
        assert r.status_code == 200, r.text
        assert r.json()["owner"] is True

    def test_pending_list_requires_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/pending-registrations")
        assert r.status_code == 401

    def test_pending_list_with_admin(self):
        r = requests.get(f"{BASE_URL}/api/admin/pending-registrations",
                         headers=_super_headers())
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "count" in d
        # Our just-registered donor should be in the list
        phones = [i["phone"] for i in d["items"]]
        assert PENDING_PHONE in phones
        item = next(i for i in d["items"] if i["phone"] == PENDING_PHONE)
        assert "registered_at" in item and item["registered_at"]
        assert "_id" not in item

    def test_pending_export_csv(self):
        r = requests.get(f"{BASE_URL}/api/admin/pending-registrations/export",
                         headers=_super_headers())
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "csv" in ctype.lower()
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".csv" in cd.lower()
        body = r.text
        assert "Registered At" in body and "Name" in body
        assert PENDING_PHONE in body

    def test_mark_synced(self):
        r = requests.post(f"{BASE_URL}/api/admin/pending-registrations/mark-synced",
                         headers=_super_headers())
        assert r.status_code == 200
        assert r.json()["marked"] >= 1
        # list should now exclude synced
        r2 = requests.get(f"{BASE_URL}/api/admin/pending-registrations",
                         headers=_super_headers())
        phones = [i["phone"] for i in r2.json()["items"]]
        assert PENDING_PHONE not in phones


# -------- Donor Filters (extended BG set) --------
class TestDonorFilters:
    def test_filters_shape(self):
        r = requests.get(f"{BASE_URL}/api/donors/filters")
        assert r.status_code == 200
        d = r.json()
        assert "blood_groups" in d
        assert "states" in d
        assert "cities_by_state" in d
        assert isinstance(d["blood_groups"], list)
        # Should have at least the common BGs present in data
        assert len(d["blood_groups"]) >= 8


# -------- Admin stats (requires Bearer) --------
class TestAdminStats:
    def test_stats_requires_bearer(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 401

    def test_stats_with_bearer(self):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_super_headers())
        assert r.status_code == 200
        d = r.json()
        for k in ("donors", "registered", "blocked", "complaints",
                  "pending_registrations"):
            assert k in d
        assert d["donors"] >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
