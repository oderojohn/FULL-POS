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

## Vercel

This repo is configured for Vercel with:

- `api/index.py` as the Django serverless entrypoint.
- `vercel.json` routing `/api/*` and `/admin/*` to Django, and all other routes to the Vite app.
- Root `requirements.txt` forwarding to `backend/requirements.txt` so Vercel installs Django and `psycopg`.

Set these Vercel environment variables:

```text
DATABASE_URL=postgresql://...
SECRET_KEY=...
DEBUG=False
ALLOWED_HOSTS=.vercel.app,your-domain.com
CSRF_TRUSTED_ORIGINS=https://*.vercel.app,https://your-domain.com
```

Run migrations against the production database before first use:

```powershell
cd backend
python manage.py migrate
```
