# Database & Schema Design

The MVP runs statelesly via Next.js API Route Handlers so it deploys seamlessly to serverless platforms (Vercel/Netlify) without requiring external database provisioning for evaluation.

For production persistence, [`sql/schema.sql`](../sql/schema.sql) defines a PostgreSQL + `pgvector` schema with the following guarantees:

## Key Tables
1. **`discovery_runs`**: Tracks `input_mode` (`keyword` vs `post_url`), `data_source` provenance, `is_test_data` flag, and `retention_expires_at` (90-day default TTL for data minimization).
2. **`discovered_posts`**: Stores discovered posts keyed by `(run_id, canonical_post_url)`.
3. **`prospect_profiles`**: Deduplicated professionals keyed by `canonical_linkedin_url` (`https://www.linkedin.com/in/<slug>` with query parameters and trailing slashes stripped). Stores only outreach-necessary professional metadata plus a 12-dimension (or 768/1536-dim in production) `vector` embedding.
4. **`post_comment_engagements`**: Preserves exact M:N traceability from each commenter to every post they commented on.
5. **`commenter_analyses`** & **`lookalike_discoveries`**: Stored in separate tables so an AI-discovered lookalike is never mislabelled as an original commenter, and every lookalike stores `top_seed_profile_id`, `similarity_score`, and `seed_rationale`.
