# End-to-End Demo Script (5–7 Minutes)

1. **Introduction & Compliance Overview (0:00–1:00)**
   - Open the live deployed dashboard.
   - Point out the **Data Provenance Banner** explicitly labelling the evaluation dataset (`Clearly Labelled Test Dataset`) and explaining why unauthorized LinkedIn scraping is avoided.

2. **Stage 1 & 2 — Keyword Search (`"K12 B2B Sales"`) & Post Discovery (1:00–2:15)**
   - Show the default `"K12 B2B Sales"` search run returning **5 recent relevant posts** with complete URLs, authors, dates, topics, and snippets.
   - Click **Scoring Logic** in the header to briefly walk through the 12-dim semantic embedding space and `35 / 25 / 25 / 15` rubric.

3. **Stage 3 & 4 — Commenter Extraction, Deduplication & AI Analysis (2:15–3:45)**
   - Switch to **Original Commenters** / **Side-by-Side Split View**.
   - Highlight how `15` raw comments across the 5 posts are deduplicated down to `9` unique commenters (`6` duplicates merged).
   - Expand **"View source post traceability & comments"** on *Dr. Kavita Sharma* (`3 posts`) and *Rajeshwar Nair* (`2 posts`) to show multi-post URL traceability and comment context.
   - Contrast top-scoring school advisors/trustees (`85–95/100`) against the bottom-ranked *Sunita Verma (Corporate L&D)* (`Low Fit`), proving semantic drift penalties work.

4. **Stage 5 — Lookalike Discovery & Seed Traceability (3:45–5:00)**
   - Inspect the **AI-Discovered Lookalikes** column (`ai_lookalike_profile`).
   - Show that none of the original commenters appear here, and point out the **Seed Profile Traceability** card on *Dr. Vandana Kulkarni* and *Sanjeevani Reddy* showing exact seed matches, `%` similarity, and shared signals.

5. **Direct LinkedIn Post URL Mode & Manual Import (5:00–6:00)**
   - Click **Isolate Post** on a discovered post (or switch to **Direct Post URL** tab) to demonstrate single-post analysis.
   - Open **Providers & Import**, click **"Load sample import rows"**, paste a custom LinkedIn post URL, and re-run to show compliant processing of user-supplied URLs + engagement records.

6. **Export & CLI Verification (6:00–6:45)**
   - Click **Export CSV** and **Export JSON**, opening the downloaded files to confirm `original_commenter` and `ai_lookalike_profile` are exported as separate categories with complete LinkedIn URLs and provenance flags.
   - (Optional terminal shot): Run `npm run cli -- --query "K12 B2B Sales"` to show CLI parity.
