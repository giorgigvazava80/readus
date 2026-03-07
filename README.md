# Readus Full Stack (Django API + User/Admin Frontends)

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

## Project Structure

- `api/` Django backend
- `frontend-public/` Public user frontend
- `frontend-admin/` Admin frontend

## Run

From:
`C:\path\to\Readus\Readus`

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

## Render Quick Deploy (Easiest)

This repo includes [`render.yaml`](./render.yaml) for Blueprint deploy.

1. Push this project to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select your `giorgigvazava80/readus` repository and deploy.
4. Render will create:
   - `readus-db` (PostgreSQL)
   - `readus-cache` (Render Key Value, Redis-compatible cache)
   - `readus-api` (Django API)
   - `readus-public` (public frontend)
   - `readus-admin` (admin frontend)

After first deploy, verify these env vars:

- On `readus-api`: `FRONTEND_BASE_URL` should be your actual public frontend URL (used in email verification and password reset links).
- On both static sites: `VITE_API_BASE_URL` should be your actual API URL (example: `https://readus-api.onrender.com`).

If you change any of them, redeploy the affected service.

Media uploads in production are configured to use `MEDIA_ROOT=/var/data/media` on a Render persistent disk (`readus-media` in `render.yaml`).
If your current Render plan does not support persistent disks, move media to object storage (for example S3/Cloudinary) instead of local filesystem storage.

API response caching is configured to use Redis-compatible cache via `CACHE_URL` when available.
In this repo's `render.yaml`, `readus-api` reads `CACHE_URL` from `readus-cache` connection string.

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
- `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_REDIRECT_URI` (frontend Google OAuth)
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` (backend Google OAuth exchange)
- `GOOGLE_EMAIL_AUTHENTICATION`, `GOOGLE_EMAIL_AUTHENTICATION_AUTO_CONNECT` (allow Google verified email to sign in and auto-link existing local account)
- `ACCOUNT_EMAIL_VERIFICATION` (`none` for temporary no-verification mode, set back to `mandatory` later)
- `VITE_EMAIL_VERIFICATION_REQUIRED` (`0` now; set to `1` when re-enabling verification UX)
- `ROOT_EMAIL`, `ROOT_USERNAME`, `ROOT_PASSWORD`
- `BOOTSTRAP_ROOT`, `BOOTSTRAP_FORCE_PASSWORD_CHANGE`, `BOOTSTRAP_ROOT_RESET_PASSWORD`
- `THROTTLE_ANON`, `THROTTLE_USER`
- `EMAIL_SEND_ASYNC` (set `1` in production so signup does not wait on SMTP)
- `CONTENT_UPLOAD_ASYNC` (`0` for reliable inline upload analysis on hosted testing, `1` for in-process background threads)
- `SOCIAL_AUTH_GOOGLE_CALLBACK_URL`, `SOCIAL_AUTH_FACEBOOK_CALLBACK_URL` (for OAuth code flow)
- `SERVE_MEDIA` (set `1` to serve uploaded media files like cover images from Django in hosted testing)
- `MEDIA_ROOT` and `MEDIA_URL` (where uploaded files are stored and served from)
- `CACHE_URL`, `CACHE_KEY_PREFIX`, `CACHE_DEFAULT_TIMEOUT`, `CACHE_TTL_PUBLIC_LIST`, `CACHE_TTL_PUBLIC_DETAIL`

## Google OAuth Checklist

1. In Google Cloud Console, create an OAuth 2.0 **Web application** client.
2. Add authorized JavaScript origins:
   - `http://localhost:5173`
   - your deployed public frontend origin (example: `https://your-app.vercel.app`)
3. Add authorized redirect URIs:
   - `http://localhost:5173/login`
   - your deployed public login callback (example: `https://your-app.vercel.app/login`)
4. Set these env vars:
   - frontend (`frontend-public`): `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_REDIRECT_URI`
   - backend (`api`): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `SOCIAL_AUTH_GOOGLE_CALLBACK_URL`
5. Rebuild/redeploy frontend and API after env var changes.

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
