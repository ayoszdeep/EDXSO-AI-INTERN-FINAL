# Technical Note: EDXSO LinkedIn Engagement & Lookalike Profile Discovery Tool

## 1. System Architecture
The application is built as a full-stack **Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS** application sharing a single core pipeline engine (`src/lib/engine/`) across both the Web UI (`/api/discover`, `/api/export`) and the CLI (`npm run cli`).

```
[UI / CLI Input: Keyword OR Direct Post URL]
                  │
                  ▼
   [Compliant Data Provider Layer]
   ├── Clearly Labelled Test Dataset (default evaluation baseline)
   ├── User-Supplied Post URL + Manual/Exported Engagement Import
   └── Optional Authorized Search Index (Serper / Tavily)
                  │
                  ▼
 [Commenter Extraction & Canonical Deduplicator]
   └── Normalizes LinkedIn URLs, merges multi-post activity, preserves postUrls[]
                  │
                  ▼
   [AI Profile Analyzer & 12-Dim Semantic Scorer]
   └── Concept Embeddings + Synonym-Expanded TF Cosine + Optional Gemini/OpenAI
                  │
                  ▼
     [Lookalike Discovery & Seed Attribution]
   └── Strict exclusion of original commenters + Top-3 seed traceability
                  │
                  ▼
    [Ranked Two-Track UI + CSV/JSON Exporter]
```

## 2. Compliant Data Retrieval & Feasibility Note
LinkedIn does **not** offer an unrestricted public API for phrase-based post search or arbitrary post comment extraction, and its Terms of Service prohibit bypassing authentication walls, CAPTCHAs, rate limits, or automated scraping.

To remain 100% compliant while delivering a fully functional, verifiable workflow:
1. **Clearly Labelled Test Dataset (`labelled_test_dataset`)**: Provides realistic K12 school-ecosystem posts, multi-post overlapping commenters, and a candidate directory explicitly tagged with `isTestData: true` and surfaced in a prominent provenance banner and export columns so test data is never misrepresented as live scraped LinkedIn data.
2. **User-Supplied Post URL & Exported Engagement (`supplied_url_manual`)**: Accepts any `linkedin.com/posts/...` or `linkedin.com/feed/update/...` URL plus user-exported JSON/CSV/pipe-delimited commenter records—processing them without touching LinkedIn's private endpoints.
3. **Authorized Search Index (`authorized_provider`)**: Optionally queries Serper or Tavily (`site:linkedin.com/posts <phrase>`) when API keys are configured.

### Compliant Path to Production
- **LinkedIn Official APIs**: Apply for LinkedIn Marketing Developer / Community Management API access for partner-owned organization pages and authorized engagement webhooks.
- **Licensed B2B Data Partners**: Integrate licensed profile/company APIs (e.g., People Data Labs, CoreSignal, Proxycurl) under signed Data Processing Agreements (DPAs) to resolve lookalike candidate pools.
- **CRM & First-Party Consent**: Sync exported leads into EDXSO's CRM with opt-out tracking and automatic 90-day retention expiration.

## 3. AI/ML Method, Semantic Similarity & Ranking Logic
Rather than brittle exact-keyword matching, every profile and comment context is projected into a **12-dimensional K12 Education Ecosystem Concept Embedding** blended (`58% / 42%`) with **synonym-expanded TF-cosine similarity**:
- **Positive Concept Dimensions**: Former Principals & School Leadership, Trustee/Owner/Board Governance, School & Education Consulting, Multi-School Network Reach (extracting campus/school counts), K12 B2B GTM & Procurement, Decision-Maker Relationships, Education Entrepreneurship, Curriculum/NEP 2020, K12 Domain Specificity, Regional Tier-2/3 Presence.
- **Drift Penalty Dimensions**: Higher-Ed Drift (universities, NAAC, college admissions) and Non-School Corporate L&D / B2C Coaching Drift.

### Scoring Rubric (0–100)
1. **Ecosystem Fit (0–35 pts)**: Alignment with EDXSO's 5 target personas (consultants/advisors, former principals/directors/owners/trustees, education entrepreneurs).
2. **School Network Reach (0–25 pts)**: Multi-campus scale (`10+`, `25+`, `100+` schools), consortium/federation roles, and decision-maker access.
3. **Semantic Alignment (0–25 pts)**: Cosine similarity against EDXSO's ideal target vector and search/seed context.
4. **Engagement / Seed Similarity Signal (0–15 pts)**: Comment depth and multi-post participation for commenters; top seed cosine similarity for lookalikes.

### Lookalike Discovery & Strict Category Separation
- Original commenters (deduplicated via canonicalized `https://www.linkedin.com/in/<slug>`) act as **seed profiles**.
- Candidate profiles are strictly filtered against the commenter canonical URL set so **no lookalike is ever labelled as a commenter**.
- Each lookalike is matched against every seed profile, recording the top 1–3 `seedProfiles`, `similarityScore`, `sharedSignals`, and `rationale`.

## 4. Data Privacy, Retention & Limitations
- **Data Minimization**: Stores only professional outreach fields (name, public LinkedIn URL, role, org, location, ecosystem indicators)—no private contact scraping or personal sensitive attributes.
- **Export Hygiene**: CSV/JSON exports embed `data_source` and `is_test_data` metadata on every row.
- **Limitations**: Without an enterprise LinkedIn partner token or licensed B2B dataset API key, live comment scraping is intentionally omitted; live URLs rely on user-supplied engagement imports or the clearly labelled test dataset.
