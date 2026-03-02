# Trello UI Clone - Setup Instructions

## Prerequisites

- Node.js 14+ installed
- Python 3.8+ installed
- Docker (for Redis)

## Backend Setup

1. **Start Redis**:
```bash
docker-compose up -d
```

2. **Navigate to backend**:
```bash
cd backend
```

3. **Create virtual environment** (if not exists):
```bash
python -m venv venv
```

4. **Activate virtual environment**:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

5. **Install dependencies**:
```bash
pip install -r requirements.txt
```

6. **Run migrations**:
```bash
python manage.py migrate
```

7. **Create superuser** (if not exists):
```bash
python manage.py createsuperuser
```

8. **Start backend server**:
```bash
python manage.py runserver
```

Backend will run at: http://localhost:8000

## Frontend Setup

1. **Navigate to frontend**:
```bash
cd frontend
```

2. **Install dependencies**:
```bash
npm install
```

This will install:
- React and React DOM
- @dnd-kit packages for drag-drop
- date-fns for date formatting
- Tailwind CSS and PostCSS
- All other dependencies

3. **Start development server**:
```bash
npm start
```

Frontend will run at: http://localhost:3000

## Verification

1. **Check backend**: Visit http://localhost:8000/admin and log in
2. **Check frontend**: Visit http://localhost:3000
3. **Check Redis**: `docker ps` should show Redis running

## Troubleshooting

### Backend Issues

**Port 8000 already in use**:
```bash
# Find and kill the process
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

**Database errors**:
```bash
# Delete and recreate database
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

### Frontend Issues

**Port 3000 already in use**:
- The app will prompt to use port 3001 instead
- Or kill the process using port 3000

**Module not found errors**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Tailwind not working**:
```bash
# Rebuild Tailwind
npm run build
```

## Next Steps

1. Create a workspace via Django admin or API
2. Create a board within that workspace
3. Add lists to the board
4. Add cards to lists
5. Test drag-and-drop functionality
6. Verify API integration

## Development Workflow

1. **Backend changes**: Restart `python manage.py runserver`
2. **Frontend changes**: Hot reload is automatic
3. **CSS changes**: May require browser refresh
4. **Dependency changes**: Restart dev servers

## Production Build

```bash
cd frontend
npm run build
```

This creates an optimized production build in `frontend/build/`.
