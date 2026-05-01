# Vallalar's Friends Blood Support — Auth Testing Guide

## Admin Auth
- **Super admin**: `gogreenrevolutiontn@gmail.com` / `Star1981$$$`
- Login: `POST /api/admin/auth/login` — returns `{ token, admin }`
- JWT sent as `Authorization: Bearer <token>`
- Endpoints:
  - `POST /api/admin/auth/login`
  - `GET /api/admin/auth/me`
  - `POST /api/admin/auth/invite` (super_admin only)
  - `GET /api/admin/auth/list` (super_admin only)
  - `DELETE /api/admin/auth/{id}` (super_admin only)
- Legacy PIN endpoints still work via `X-Admin-Pin: 0000` for upload/block/complaints for backward compat OR via `Authorization: Bearer` JWT.

## Google Sheet Sync (Option C)
- **Read**: admin pastes a public Google Sheet link (Anyone with link → Viewer). App fetches `export?format=csv` and imports.
- **Write**: new donor registrations go into MongoDB + `pending_registrations` collection with `registered_at` timestamp. Super admin can CSV-export to paste into sheet.

## Donor Phone OTP (unchanged)
- Any 10-digit phone + OTP `123456` (DEV MODE)
