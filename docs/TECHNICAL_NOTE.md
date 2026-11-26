# Technical Note: EDXSO LinkedIn Engagement & Lookalike Profile Discovery

## 1. Architecture

One TypeScript pipeline (`src/lib/engine/pipeline.ts`) is shared by the web UI (Next.js 16 App Router + React 19 + Tailwind v4, route handlers `/api/discover`, `/api/export`, `/api/health`) and the CLI (`npm run cli`). The app is stateless: nothing is written to disk or a database.

```
Keyword phrase ──┐                                ┌─ Labelled test dataset (explicit, or when no keys)
Post URL ────────┼─► Stage 1-2  Post discovery ───┤
                 │                                └─ Serper/Tavily public search index: site:linkedin.com/posts <phrase>
                 │                                   (recency: past month → past year → all time)
                 ▼
          Stage 3  Commenters ── Apify licensed provider (harvestapi/linkedin-post-comments, no cookies)
                                └─ User import: CSV / JSON / pipe rows / text copied from the post
                 ▼
          Dedupe on canonical profile URL (case-insensitive, host/query/slash normalised),
          keeping every post URL + comment per person
                 ▼
          Stage 4  AI profile analysis: 100-pt rubric + 12-dim concept embedding + token cosine
                 ▼
          Stage 5  Lookalikes: seed roles/indicators/location → public profile searches
                   (site:linkedin.com/in "former principal" Pune) → candidates
                   → similarity to every seed (Gemini embeddings 60% + local 40%)
                   → commenters & post authors excluded
                 ▼
          Stage 6  Gemini zero-shot persona classification blended into rank → UI + CSV/JSON export
```

| Module | Responsibility |
| --- | --- |
| `src/lib/data/compliant-provider.ts` | Chooses the source (test vs live) and gathers posts + comments |
| `src/lib/data/providers/web-search.ts` | Serper/Tavily calls; parses post and profile search results |
| `src/lib/data/providers/apify.ts` | Licensed comments provider; attributes each comment to its post |
| `src/lib/data/import-parser.ts` | Parses user-supplied commenter exports (shared by browser + server) |
| `src/lib/data/linkedin-urls.ts` | URL canonicalisation, activity-id → date decoding, headline splitting |
| `src/lib/engine/deduplicator.ts` | Cross-post dedupe with traceability |
| `src/lib/engine/scorer.ts`, `semantic.ts` | Rubric, indicators, concept embedding |
| `src/lib/engine/lookalike-sourcing.ts`, `lookalike.ts` | Seed-derived search queries; similarity and seed attribution |
| `src/lib/engine/gemini.ts` | Model discovery, embeddings, JSON classification |

## 2. Data retrieval approach and compliance

LinkedIn has no public API for phrase-based post search or for reading comments, and its terms forbid scraping and getting around its login. This app therefore **never logs into LinkedIn, never handles LinkedIn cookies, and never fetches linkedin.com pages**. Every live record comes from one of these:

1. **Public search index (Serper.dev, or Tavily as an alternative).** It reads only what Google already shows publicly: title, URL and snippet. It is used for (a) the 5 recent posts for a phrase and (b) lookalike profile discovery. Post dates are decoded exactly from the LinkedIn activity id (the first 41 bits are a Unix-ms timestamp), so no page fetch is needed.
2. **Licensed third-party provider for comments (Apify).** The default actor is `harvestapi/linkedin-post-comments`, which returns publicly visible comments without LinkedIn cookies. The provider operates under its own terms, and in production EDXSO would sign a DPA with it. Swap actors with `APIFY_COMMENTS_ACTOR`.
3. **User-supplied data.** Any post URL, plus a commenter list the user exports or copies (CSV, JSON including Apify exports, pipe rows, or text selected from the comment section). Copied text has no profile links, so those rows show "URL not available" and are deduplicated by name + organisation.
4. **Clearly labelled test dataset.** Synthetic fixtures with `isTestData: true`, used on first page load and whenever no live key is configured. It is shown with an amber banner and flagged on every exported row. **Test profiles are never mixed into live results.** If a live run has no search key, it returns zero lookalikes and says so.

Nothing is fabricated. Unknown fields stay empty or are labelled "not provided". A comment that the provider cannot trace to a specific source post is dropped rather than guessed. Post-author profile URLs are not guessed from the URL slug.

### Compliant path to production
- LinkedIn Community Management API for posts and comments on pages EDXSO administers (requires partner approval).
- A licensed comments/profile provider under a signed DPA (the Apify adapter is the integration point).
- CRM sync with opt-out tracking and an expiry date on stored records.

## 3. AI/ML method, similarity and ranking

**Rubric (0–100), always computed locally:**

| Component | Points | Signal |
| --- | --- | --- |
| Ecosystem persona fit | 35 | Former principal, trustee/owner, school director, school/education consultant, education entrepreneur, K12 B2B |
| Multi-school network reach | 25 | "15 schools", group/chain/association/federation, decision-maker access |
| Semantic alignment | 25 | Cosine of a 12-dim K12 concept embedding to EDXSO's ideal-target vector (72%) + synonym-expanded token cosine to the query (28%) |
| Engagement / seed similarity | 15 | Comment depth and number of posts commented on; for lookalikes, similarity to their best seed |

Higher-ed and corporate/B2C profiles are penalised. Tiers: ≥80 Primary Decision-Maker / Advisor, ≥62 Ecosystem Multiplier, ≥42 Adjacent, otherwise Low Fit.

**Gemini layer (when `GEMINI_API_KEY` is set):**
- *Embeddings:* every seed and candidate is embedded (`taskType: SEMANTIC_SIMILARITY`). Seed↔candidate similarity = 0.6 × rescaled Gemini cosine + 0.4 × local similarity.
- *Zero-shot classification:* each profile, with its comment or search snippet, is classified into one of EDXSO's target personas with a 0–100 fit score and a one-sentence rationale grounded in the given text (JSON output). **Final score = 0.6 × rubric + 0.4 × Gemini fit.**
- The model ids are discovered at runtime via `models.list` (newest stable `gemini-X-flash` and `gemini-embedding-*`), and can be overridden with `GEMINI_MODEL` / `GEMINI_EMBEDDING_MODEL`. Every Gemini failure falls back to the local score and is reported in the run notes.

**Lookalike sourcing.** For the strongest seeds (score ≥ 40), role phrases come from the headline (e.g. "former principal", "trustee", "school consultant") and the school-ecosystem indicators, plus the seed's city. Up to 5 queries such as `site:linkedin.com/in "trustee" Jaipur` are run. Each candidate records the query that found it and the seed(s) behind it (`discoveredVia`), and is then matched against every seed (top 3 kept, with shared signals and a rationale). Commenters (by URL, or by name for URL-less imports) and post authors are excluded, so a lookalike is never labelled as a commenter.

## 4. Privacy, retention and security
- **Minimisation:** only professional outreach fields are kept: name, public profile URL, headline/role/org, location, and the comment text that justifies the match. No emails, phone numbers or private data.
- **No storage:** results live only in the browser tab and in files the user chooses to export. Provider responses are cached in memory for 30–60 min only, to avoid paying twice.
- **Exports:** each row carries `record_category`, `data_source`, `is_test_data` and the discovery query. CSV cells that start with `= + - @` are neutralised against spreadsheet formula injection. Exported files contain personal data and should be stored in access-controlled locations and deleted after the campaign (a 90-day retention is recommended; `sql/schema.sql` includes `retention_expires_at`).
- **Consent:** outreach should honour opt-outs and applicable data-protection law (India DPDP Act 2023 / GDPR). The person's public LinkedIn context is used only to judge professional relevance.
- **Keys:** server keys come from environment variables. Keys typed in the UI stay in tab memory and are sent only with that user's requests. `/api/health` exposes booleans only.

## 5. Limitations
- Search-index coverage: only posts and profiles Google has indexed are discoverable, and snippets can be truncated, so role or org may be partial.
- Comments need an Apify token (paid per result, roughly $1.5–2 per 1,000 comments) or a user import. Without either, live runs show posts and explain the gap.
- Imported copied text has no profile URLs. Profile URLs are shown "wherever available", as the brief allows.
- Gemini latency varies; classification runs in small batches with timeouts and falls back to the rubric if it times out.
- Serverless function limit is 60 s (`maxDuration`); very large comment threads are capped at 50 comments per post.

## 6. Setup
See [README](../README.md) and [DEPLOYMENT](DEPLOYMENT.md).
