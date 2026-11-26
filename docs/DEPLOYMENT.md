# Deployment Guide

The app is a stateless Next.js 16 project. API route handlers run as serverless functions (`maxDuration = 60s`, because live runs wait on the comments provider and Gemini).

## Vercel (recommended)

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repo. The Next.js framework is auto-detected (`vercel.json`).
3. Under **Settings → Environment Variables** (Production + Preview), add:
   - `SERPER_API_KEY`: live posts and lookalike search
   - `GEMINI_API_KEY`: AI ranking
   - `APIFY_API_TOKEN`: automatic commenter retrieval (optional; users can import lists instead)
4. Deploy, then verify:
   - `https://<app>.vercel.app/api/health` should show `providersConfigured.serper: true`, etc.
   - `https://<app>.vercel.app/api/discover?query=K12+B2B+Sales&source=live` should return 5 real posts.
   - Open the site and run a keyword search, a post-URL run, and a CSV/JSON export.

CLI alternative: `npx vercel login`, then `npx vercel --prod`, then `npx vercel env add SERPER_API_KEY` (and the other variables), then redeploy.

> Vercel Hobby allows functions up to 60 s. If Apify regularly times out on large threads, lower the per-post comment cap in `src/lib/data/providers/apify.ts` or use a Pro plan.

## Other Node hosts (Render, Railway, VM)
- Build: `npm ci && npm run build`
- Start: `npm run start` (port from `PORT`)
- Node 20.12+ or 22.x
- Set the same environment variables.

## Cost and abuse notes for a public URL
- On first page load the app runs the free labelled test dataset (plus Gemini ranking if a key is set). Live provider credit is spent only when a user clicks **Run Discovery** in live mode.
- Identical provider calls are cached in memory for 30–60 min.
- Serper's free tier is 2,500 searches. A live keyword run uses about 1–3 searches for posts plus up to 5 for lookalikes.
- Apify charges per comment (about $1.5–2 per 1,000). Set a spending limit in the Apify console.
- Rotate keys if they are ever exposed. Never commit `.env.local` (it is gitignored).
