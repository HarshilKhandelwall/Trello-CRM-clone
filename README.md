# Internal Educational CRM (SQLite)

## Stack
- Django + DRF
- Django Channels
- SQLite (local)
- Redis
- React

## Run (Fast)

```bash
docker-compose up -d
cd backend
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open frontend separately.
