# Deploy NAFSCOB Dashboard on Vercel

## What works on Vercel

| Feature | Vercel | Render |
|---------|--------|--------|
| Dashboard & charts | Yes | Yes |
| Add Data (Excel/JSON upload) | Yes | Yes |
| PDF convert (browser) | Yes | Yes |
| PDF convert (Python server) | No | Yes |

Vercel hosts this as a **static site**. PDF conversion uses the **in-browser fallback** automatically when the Python API is unavailable.

---

## One-time setup (5 minutes)

1. Go to **https://vercel.com** and sign in with **GitHub**
2. Click **Add New… → Project**
3. Import **`SOHUM24/nafscob-dashboard`**
4. Configure:

| Setting | Value |
|---------|-------|
| Framework Preset | **Other** |
| Root Directory | `.` (default) |
| Build Command | *(leave empty)* |
| Output Directory | *(leave empty)* |
| Install Command | *(leave empty)* |

5. Click **Deploy**
6. Wait 2–5 minutes (large data files `pacs_data.js` ~16MB may slow first deploy)

---

## Your live URLs

After deploy, Vercel gives you a URL like:

- `https://nafscob-dashboard.vercel.app/`
- `https://nafscob-dashboard.vercel.app/visualization_final.html`
- `https://nafscob-dashboard.vercel.app/sources.html`

Custom domains: Project → **Settings → Domains**

---

## Auto-deploy

Every `git push` to `main` triggers a new Vercel deployment automatically.

---

## CLI deploy (optional)

```powershell
npm i -g vercel
cd C:\Users\91708\Downloads\FInal-dccb-site
vercel login
vercel --prod
```
