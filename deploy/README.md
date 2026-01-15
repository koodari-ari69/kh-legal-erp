# KH Legal ERP - Deployment Guide

## Quick Deploy to Railway (Free Tier Available)

### Step 1: Create a GitHub Repository

1. Go to [github.com](https://github.com) and create a new repository
2. Name it `kh-legal-erp`
3. Upload all files from this folder to the repository

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select `kh-legal-erp`
5. Railway will automatically detect the Python app and start deploying

### Step 3: Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically sets the `DATABASE_URL` environment variable
4. Your app will auto-redeploy with the database connected

### Step 4: Get Your URL

1. Click on your web service
2. Go to "Settings" → "Networking"
3. Click "Generate Domain"
4. Your app is now live at: `https://your-app-name.up.railway.app`

---

## Alternative: Deploy to Render (Also Free)

1. Go to [render.com](https://render.com)
2. New → Web Service → Connect your GitHub repo
3. Settings:
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add a PostgreSQL database from Render dashboard
5. Set `DATABASE_URL` environment variable (Render does this automatically)

---

## Files Included

```
├── main.py           # FastAPI backend + frontend serving
├── models.py         # Database models
├── schemas.py        # API schemas
├── database.py       # Database configuration
├── pdf_reports.py    # PDF generation
├── frontend.jsx      # React frontend (mobile-responsive)
├── requirements.txt  # Python dependencies
├── Procfile          # Railway/Heroku process file
└── railway.json      # Railway configuration
```

---

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally (uses SQLite)
uvicorn main:app --reload

# Open http://localhost:8000
```

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `PORT` | Server port | Auto-set by Railway |

---

## Cost

- **Railway**: Free tier includes $5/month credit (enough for small apps)
- **Render**: Free tier available (spins down after inactivity)

---

## Support

The app includes:
- Finnish UI
- Mobile-responsive design
- PDF invoice generation
- Time tracking
- Document management
- Client management

Enjoy your new ERP! 🎉
