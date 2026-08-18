# Potatopay Admin

Standalone operations console for Potatopay. This app is intentionally outside `potatopay-web` and talks to the shared Potatopay API.

## Local development

1. Start Postgres and the API on port `4000`.
2. Set `NEXT_PUBLIC_API_URL` in `.env.local`.
3. Use `NEXT_PUBLIC_ADMIN_AUTH_BYPASS=true` only for local development.
4. Run `npm install` and `npm run dev`.

The local admin app runs at `http://localhost:3001`.

Routes:

- `/` — daily operating overview
- `/creators` — paginated creator directory
- `/supporters` — paginated daily supporter ranking
- `/kyc` — pending KYC queue and review actions

Production must disable the local bypass and use the API's authenticated admin session. KYC document storage remains a backend concern; do not use the local filesystem for real identity documents.
