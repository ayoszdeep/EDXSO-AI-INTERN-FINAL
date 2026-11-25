# Deployment Guide — EDXSO LinkedIn Discovery Tool

This application is stateless by default (all AI semantic scoring, deduplication, and lookalike matching run inside Next.js API Route Handlers with zero required external database or API keys), so it deploys cleanly to Vercel, Netlify, Render, or any Node 20+ server.

## Option 1: Deploy to Vercel (Recommended, ~2 Minutes)
1. Install or run the Vercel CLI from the project root:
   ```bash
   npx vercel login
   npx vercel --prod
   ```
2. Accept the default Next.js framework settings (already pre-configured in `vercel.json`).
3. *(Optional)* Add environment variables in the Vercel dashboard (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `SERPER_API_KEY`, `TAVILY_API_KEY`) if you want live search index / LLM enrichment enabled alongside the built-in semantic engine.
4. Verify the live deployment:
   - `GET https://<your-app>.vercel.app/api/health` → returns `{"status":"ok", ...}`
   - `GET https://<your-app>.vercel.app/api/discover?query=K12+B2B+Sales` → returns 5 posts, deduplicated commenters, and seed-traced lookalikes.
   - Open `https://<your-app>.vercel.app/` in a browser and test CSV/JSON export.

## Option 2: Deploy via GitHub + Vercel / Netlify / Render Web UI
1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. Import the repository in **Vercel**, **Netlify**, or **Render**:
   - **Build Command**: `npm run build`
   - **Start Command** (for Node hosts like Render): `npm run start`
   - **Node Version**: `20.x` or `22.x`

## Hosting & Security Notes
- No LinkedIn credentials or cookies are stored or requested.
- Optional API keys entered in the UI **Providers & Import** modal stay in browser session memory only and are never written to server storage.
- For production persistence with a PostgreSQL + `pgvector` instance, apply `sql/schema.sql`.
