# adanabosanmaavukati-org

Zero-dependency Node.js (ESM) CLI toolkit for managing WordPress SEO/content for `adanabosanmaavukati.org` via the WordPress REST API and the Google Gemini API. There is no web server, no UI, and no lint/test/build framework — the "application" is the set of `node scripts/*.mjs` commands defined in `package.json`.

## Cursor Cloud specific instructions

- Node 18+ is required (`engines` in `package.json`); the VM has Node 22. Scripts rely on the built-in global `fetch`, so no `node-fetch` dependency exists.
- There are no third-party npm dependencies, lint config, test suite, or build step. To smoke-check the code, run `node --check` over `scripts/*.mjs` and `scripts/lib/*.mjs`.
- Available commands are the `npm run <name>` scripts in `package.json` (e.g. `check:wp`, `check:gemini`, `fetch:wp`, `analyze:divorce`, `generate:divorce`).
- Configuration is loaded from a `.env` file at the repo root by a custom loader in `scripts/lib/env.mjs` (not the `dotenv` package). Copy `.env.example` to `.env`. Required vars: `ADANABOSANMA_WP_USERNAME`, `ADANABOSANMA_WP_APP_PASSWORD` (WordPress Application Password), and `GEMINI_API_KEY`. `ADANABOSANMA_WP_BASE_URL` defaults to the production site.
- `npm run check:wp` / `npm run check:gemini` exit non-zero with a Turkish "BAŞARISIZ" message when credentials are missing — this is the expected, graceful behavior, not a crash.
- WARNING: most scripts act against the LIVE production WordPress site (creating drafts, publishing posts, applying SEO changes). `create:*`, `publish:*`, `draft:wp`, `enhance:publish`, `apply:*`, `fix:*`, `strengthen:*` are WRITE/destructive. Only `check:wp`, `check:gemini`, `fetch:wp` (writes `data/`), and `plan:links` are read-only/local. Do not run write scripts unless explicitly asked.
- `data/`, `generated/`, and `.env` are gitignored; `fetch:wp` writes `data/adanabosanma-content.json`.
- Offline core logic (markdown→HTML conversion, frontmatter parsing, link extraction, word counting) lives in `scripts/lib/` and can be exercised without any network/credentials.
