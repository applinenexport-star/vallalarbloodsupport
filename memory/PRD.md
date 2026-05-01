# Vallalar's Friends Blood Support — Product Requirements Document

## Overview
**Vallalar's Friends Blood Support** is an emergency blood-donor finder mobile app for India. Tagline: *"Your Blood Saves Many Lives — Donate Today, Be a Hero."* Patient attenders can quickly post a blood request, find verified donors by state/city/blood-group, and reach them via WhatsApp with a pre-built poster and text message. Donors can self-register, manage their availability, and honor a 5-month post-donation cooldown.

## Stack
- **Frontend**: React Native (Expo SDK 54) with expo-router, react-native-view-shot, expo-sharing, AsyncStorage
- **Backend**: FastAPI + Motor (async MongoDB)
- **Auth**: Phone OTP via Twilio Verify (DEV MODE fallback: OTP `123456`)

## Screens
| Route | Purpose |
|---|---|
| `/` | Phone login (OTP) |
| `/otp` | OTP entry (routes to `/profile` if donor, else `/home`) |
| `/home` | Blood Request Form (patient name, BG, hospital + city + phone, units, attender, T&C, Register a Complaint button) |
| `/donors` | Donor search (state/city/BG filters) + multi-select (min 5) + WhatsApp send + JPG poster |
| `/register` | Donor self-registration (name, phone, age, BG, state dropdown, city dropdown, town, diabetic) |
| `/profile` | Donor profile (edit details, toggle Available/Not-Available, set last donation date) |
| `/complaint` | Complaint form |
| `/terms` | Full Terms & Conditions |
| `/admin` | PIN-gated admin (Upload CSV, Block Users, View Complaints) |

## Key Rules
- **Min 5 donors** must be selected to bulk-send via WhatsApp
- **5-month cooldown** after last donation date — donor auto-hidden from search
- **Availability toggle** by donor hides them from search
- **Admin PIN** (default `0000`) blocks misusing phone numbers from even sending OTP
- **T&C acceptance** mandatory before blood request submission
- **JPG poster** generated on-device via `react-native-view-shot`

## API Endpoints
- `POST /api/auth/send-otp` · `POST /api/auth/verify-otp`
- `GET /api/donors?state=&city=&blood_group=` · `GET /api/donors/filters`
- `POST /api/donors/register` · `GET /api/donors/me?phone=` · `PUT /api/donors/me?phone=`
- `POST /api/requests` · `POST /api/complaints`
- `POST /api/admin/login` · `POST /api/admin/block` · `POST /api/admin/unblock`
- `GET /api/admin/blocklist` · `GET /api/admin/complaints` · `POST /api/donors/upload-csv` (admin-only)

## Seeded Data
- **465 donors** loaded from user-provided CSV (A+ Tamil Nadu: Coimbatore & Tirupur). Admin can upload more via CSV.

## Dev Credentials
- OTP: `123456` (any 10-digit phone)
- Admin PIN: `0000`
