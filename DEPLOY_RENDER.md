# Deploy NAFSCOB Dashboard on Render (Beginner Guide)

## What you need (15 minutes)

- A **GitHub account** (free): https://github.com/signup
- A **Render account** (free): https://render.com — sign up with GitHub
- This project folder on your PC

---

## Part 1 — Put code on GitHub

### Step 1: Install Git (if needed)

Download: https://git-scm.com/download/win  
During install, keep defaults. Restart terminal after install.

### Step 2: Create a new GitHub repository

1. Go to https://github.com/new
2. Repository name: `nafscob-dashboard` (or any name)
3. Choose **Public** or **Private**
4. **Do NOT** check "Add README" (you already have files)
5. Click **Create repository**
6. Copy the repo URL, e.g. `https://github.com/YOUR_USERNAME/nafscob-dashboard.git`

### Step 3: Push your code from PowerShell

Open PowerShell in the project folder:

```powershell
cd C:\Users\91708\Downloads\FInal-dccb-site

git init
git add .
git status
git commit -m "Initial deploy: NAFSCOB dashboard with Render config"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nafscob-dashboard.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

If Git asks you to log in, use **GitHub Personal Access Token** as password:
https://github.com/settings/tokens → Generate new token (classic) → check `repo` scope.

**Note:** Large data files (`pacs_data.js` ~16MB) are included — first push may take 2–5 minutes.

---

## Part 2 — Deploy on Render

### Option A — Blueprint (easiest, recommended)

1. Go to https://dashboard.render.com
2. Click **New +** → **Blueprint**
3. Connect your GitHub account if prompted
4. Select repository `nafscob-dashboard`
5. Render reads `render.yaml` automatically
6. Click **Apply** / **Deploy**
7. Wait 5–10 minutes for build to finish

### Option B — Manual Web Service

1. **New +** → **Web Service**
2. Connect repo `nafscob-dashboard`
3. Settings:

| Field | Value |
|-------|-------|
| Name | `nafscob-dashboard` |
| Region | Singapore (closest to India) or Oregon |
| Branch | `main` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn server:app --bind 0.0.0.0:$PORT --timeout 180 --workers 1` |
| Plan | **Free** |

4. Click **Create Web Service**

---

## Part 3 — Your live URLs

After deploy succeeds (green "Live" badge):

| Page | URL |
|------|-----|
| Home / Report | `https://YOUR-APP.onrender.com/` |
| Dashboard | `https://YOUR-APP.onrender.com/visualization_final.html` |
| Add Data | `https://YOUR-APP.onrender.com/sources.html` |

Replace `YOUR-APP` with your Render service name.

---

## Part 4 — After deploy checklist

- [ ] Open dashboard URL — map and charts load
- [ ] Open Add Data — upload a small Excel test
- [ ] Try PDF convert (server may be slow on free tier; browser fallback works)
- [ ] First visit after 15 min idle may take **30–60 seconds** (free tier sleeps)

---

## Updating the site later

After you change code locally:

```powershell
cd C:\Users\91708\Downloads\FInal-dccb-site
git add .
git commit -m "Describe your change"
git push
```

Render **auto-redeploys** on every push to `main`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on pandas | `requirements.txt` uses flexible versions — retry deploy |
| 502 / slow first load | Free tier woke from sleep — wait 60s and refresh |
| PDF convert timeout | Use browser extraction in Add Data (automatic fallback) |
| Push rejected (file too large) | Ensure `.gitignore` excludes PDFs and xlsx source files |
| Git not recognized | Install Git and restart terminal |

---

## Free tier limits (Render)

- Service **sleeps** after ~15 minutes of no traffic
- **512 MB** RAM — enough for this dashboard
- **750 hours/month** — one app is always within limit
- No custom domain on free (you get `*.onrender.com`)
