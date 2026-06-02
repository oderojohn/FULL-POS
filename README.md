# FULL-POS

Full POS application with a React/Vite frontend and Django REST backend.

## Production setup

Backend configuration is environment-driven. Set `DATABASE_URL`, `SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS`, and `CSRF_TRUSTED_ORIGINS` in the deployment environment before running migrations and starting the server.

```powershell
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
```

Frontend API endpoints are configured with `VITE_POS_API_URL` and `VITE_INVENTORY_API_URL`.

## Separate Vercel Deployments

Deploy this repo as two Vercel projects.

Frontend project:

- Root Directory: repo root
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Set `VITE_POS_API_URL` and `VITE_INVENTORY_API_URL` to the backend project URL.

Backend project:

- Root Directory: `backend`
- Vercel uses `backend/vercel.json`.
- `backend/api/index.py` is the Django serverless entrypoint.
- `backend/requirements.txt` installs Django and `psycopg`.

Set these backend Vercel environment variables:

```text
DATABASE_URL=postgresql://...
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=.vercel.app,your-domain.com
CSRF_TRUSTED_ORIGINS=https://*.vercel.app,https://your-domain.com
CORS_ALLOWED_ORIGINS=https://your-frontend-domain.com
```

Run migrations against the production database before first use:

```powershell
cd backend
python manage.py migrate
```
