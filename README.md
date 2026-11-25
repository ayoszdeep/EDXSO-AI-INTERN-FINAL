# EDXSO LinkedIn Engagement & Lookalike Profile Discovery Tool

An AI-powered prospect intelligence application built for **EDXSO** to discover high-fit K12 school-ecosystem stakeholders (school consultants, former principals, managing trustees, school owners, education entrepreneurs, and multi-school network leaders) starting from either a **search phrase** or a **direct LinkedIn post URL**.

## Core Capabilities (6-Stage Workflow)
1. **Search Input (UI, API & CLI)**: Accepts keyword phrases (demo default: `"K12 B2B Sales"`) or direct LinkedIn post URLs.
2. **Post Discovery**: Returns the top 5 most relevant recent posts (with URL, author, date, topics, and snippet) for keyword searches, or processes a single supplied URL directly.
3. **Commenter Extraction & Canonical Deduplication**: Normalizes LinkedIn profile URLs (stripping query params/trailing slashes), merges duplicate appearances across posts, and preserves full `associatedPostUrls[]` traceability.
4. **AI Profile Analysis**: Extracts role, organization, location, and school-ecosystem indicators, scoring every commenter (`0–100`) with transparent sub-scores and human-readable reasoning.
5. **Lookalike Discovery**: Uses extracted commenters as seed profiles to find similar school-ecosystem professionals via 12-dimensional semantic embeddings + synonym-expanded token cosine similarity, strictly excluding original commenters and recording seed attribution.
6. **Ranking & Export**: Ranks both groups separately and exports clean **CSV** and **JSON** files preserving separate categories (`original_commenter` vs `ai_lookalike_profile`), provenance, and seed traceability.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend / Engine**: Next.js Route Handlers (`/api/discover`, `/api/export`, `/api/health`) + shared TypeScript semantic engine (`src/lib/engine/`)
- **CLI**: `tsx src/cli/discover.ts`
- **Testing**: `node:test` via `tsx --test`

## Local Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Configure live provider / LLM keys
cp .env.example .env.local

# 3. Run development server
npm run dev

# 4. Run automated unit & integration tests
npm test

# 5. Run production build check
npm run build
```

### CLI Usage
```bash
# Keyword search (default: "K12 B2B Sales")
npm run cli -- --query "K12 B2B Sales"

# Direct post URL
npm run cli -- --url "https://www.linkedin.com/posts/demo-k12-gtm_k12-b2b-sales-school-trustees-activity-7264102938471001"

# Export directly to CSV or JSON
npm run cli -- --query "K12 B2B Sales" --format csv --out edxso-results.csv
```

## API Endpoints
- `GET /api/health` — Service health & configured optional provider status
- `POST /api/discover` (or `GET /api/discover?query=K12+B2B+Sales`) — Executes the full 6-stage pipeline
- `POST /api/export` — Streams downloadable `.csv` or `.json` with separate commenter and lookalike categories

## Documentation
- [Technical Note](docs/TECHNICAL_NOTE.md) — Architecture, compliance strategy, semantic similarity & scoring rubric, and limitations
- [Database Schema](docs/SCHEMA.md) & [`sql/schema.sql`](sql/schema.sql) — Production PostgreSQL + `pgvector` schema
- [Demo Walkthrough Script](docs/DEMO_SCRIPT.md) — 5–7 minute evaluation guide

## Deployment (Vercel / Node)
The app is stateless and builds cleanly with `npm run build`. Deploy directly to Vercel (`vercel --prod`) or any Node 20+ host running `npm run build && npm run start`. No required external environment variables are needed for evaluation mode.
