# Internal CRM Backend (SQLite)

## Setup (development)

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Redis must be running on localhost:6379

## Environment variables

Copy `.env.example` to `.env` and fill in values:

- `DJANGO_SECRET_KEY`: a long, random string (never commit the real value).
- `DJANGO_DEBUG`: `True` for development, `False` for production.
- `DJANGO_ALLOWED_HOSTS`: comma-separated list of allowed hostnames.
- `DJANGO_CORS_ALLOWED_ORIGINS`: comma-separated list of allowed frontend origins.
- Database variables (`DJANGO_DB_*`) if not using the default SQLite.
- Channels / Redis: `DJANGO_CHANNEL_BACKEND=redis`, `DJANGO_REDIS_URL=redis://redis:6379/0`.
- `SENDGRID_API_KEY`: SendGrid API key (keep secret, rotate if compromised).

In production, run with `DJANGO_DEBUG=False`, a strong `DJANGO_SECRET_KEY`, a production database, and Redis-backed channel layer.
