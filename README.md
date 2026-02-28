# DjangoAuth Full Stack (Django API + User/Admin Frontends)

## What Is Implemented

- Email-verified registration with role selection (`reader` or `writer`)
- Writer application lifecycle (submit, pending, approve/reject with private reviewer comment)
- Effective RBAC: Reader, Pending Writer, Writer, Redactor, Admin, Root
- Admin APIs for redactor management and moderation audit logs
- In-app notifications and audit logging for critical moderation actions
- Root bootstrap account with forced password change on first login
- Domain-split frontend mode:
  - user app: `{domain}.ge` (local dev: `http://localhost:5173`)
  - admin app: `admin.{domain}.ge` (local dev: `http://localhost:5174`)

## Stack

- Backend: Django + DRF + dj-rest-auth + allauth + PostgreSQL
- Frontend: React + Vite + Tailwind + shadcn/ui
- Runtime: Docker Compose

## Run

From:
`C:\Users\Giorgi\Documents\lit_proj\full_project\DjangoAuth\DjangoAuth`

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

## URLs

- User frontend: `http://localhost:5173`
- Admin frontend: `http://localhost:5174`
- API: `http://localhost:9000`
- Swagger: `http://localhost:9000/swagger/`
- Health: `http://localhost:9000/health/`

## Root Bootstrap

On startup, root is ensured automatically:

- Email: `root@test.ge`
- Username: `root`
- Password: `ChangeMe@123`

First login requires password change. After changing password, privileged endpoints are unlocked.

## Important Environment Variables

- `VITE_API_BASE_URL`
- `VITE_APP_MODE` (set by compose service: `user` or `admin`)
- `ROOT_EMAIL`, `ROOT_USERNAME`, `ROOT_PASSWORD`
- `BOOTSTRAP_ROOT`, `BOOTSTRAP_FORCE_PASSWORD_CHANGE`, `BOOTSTRAP_ROOT_RESET_PASSWORD`
- `THROTTLE_ANON`, `THROTTLE_USER`

## API Surfaces

- Auth: `/auth/*`
- Me: `/api/accounts/me/`
- Writer applications: `/api/accounts/writer-application/*`
- Content: `/api/content/*`
- Admin redactors: `/api/admin/redactors/*`
- Admin audit logs: `/api/admin/audit-logs/`
- Notifications: `/api/notifications/*`

## Stop

```powershell
docker compose down
```

## Yahoo SMTP Notes

If you use Yahoo SMTP, use these settings:

- `EMAIL_HOST=smtp.mail.yahoo.com`
- `EMAIL_PORT=587`
- `EMAIL_USE_TLS=1`
- `EMAIL_USE_SSL=0`
- `EMAIL_HOST_USER=<your_yahoo_email>`
- `EMAIL_HOST_PASSWORD=<your_yahoo_app_password>`

Use a Yahoo **app password**, not your normal account password. Yahoo can return `535 5.7.0 (#AUTH005)` after repeated failed login attempts.
