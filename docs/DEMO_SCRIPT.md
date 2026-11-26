# End-to-End Demo Script (about 8 minutes)

1. **Intro and compliance (0:00–1:00)**
   - Open the live URL. The first view is the **labelled test dataset**: point out the amber provenance banner, the "Test data" badges, and the providers line.
   - Explain that LinkedIn has no public search or comments API, so the app uses a public search index, a licensed comments provider, and user-supplied data. It never logs into or scrapes LinkedIn.

2. **Keyword search on live data (1:00–2:30)**
   - Keep *Live LinkedIn data* selected, type `K12 B2B Sales`, and click **Run Discovery**.
   - Show the 5 real posts: URL, author, exact date (decoded from the activity id), snippet and comment count.
   - Show the green banner: "Posts: serper public search index · Comments: Apify …".

3. **Commenter extraction and dedupe (2:30–4:00)**
   - With an Apify token: show commenters from all posts, a "Deduplicated · N comments" badge, and expand **source post traceability** to show each post URL and comment.
   - Without a token: open **Providers & Import**, paste text copied from a post's comment section (or upload a CSV with `post_url`), show the live preview table, apply, and rerun.

4. **AI profile analysis and ranking (4:00–5:15)**
   - Open **Scoring Logic**: 35/25/25/15 rubric, 12-dim concept embedding, Gemini blend (60/40).
   - On a card, show the indicators, the Gemini persona chip with fit score, the explanation, and the breakdown bars. Use the tier filter and min-score slider.

5. **Lookalike discovery (5:15–6:30)**
   - In the lookalike column, show the real `linkedin.com/in/...` URLs, **% Seed Match**, the seed traceability box, and "Found via public profile search `"former principal" Pune`, built from seed …".
   - Point out the **Category Isolation: Verified** tile: no commenter appears as a lookalike.

6. **Direct post URL (6:30–7:15)**
   - Click **Isolate Post** on a discovered post, or paste any LinkedIn post URL in *Direct Post URL* mode, and run.

7. **Export and CLI (7:15–8:00)**
   - Export CSV and JSON. Open them to show `record_category`, `discovery_query`, `ai_persona`, `data_source` and `is_test_data`.
   - Optional terminal: `npm run cli -- --query "K12 B2B Sales" --source live`.
