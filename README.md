# Codey

## Dynamic GitHub snippets

The browser requests `/api/snippets?language=...`. The serverless route discovers popular repositories, filters generated/test/build files, extracts typing-sized snippets, and caches responses for six hours.

Create a fine-grained, read-only GitHub token and configure it only on the server or deployment platform:

```bash
GITHUB_TOKEN=github_pat_...
```

Never expose the token through a `VITE_` environment variable. Vite embeds those values in the public browser bundle.

On Vercel, add `GITHUB_TOKEN` under Project Settings -> Environment Variables. Use `vercel dev` when testing the serverless endpoint locally. Plain `npm run dev` remains usable and falls back to the curated public GitHub sources.

## Appwrite

Appwrite is the planned backend for accounts, cloud history, and leaderboards. The app remains local-first when Appwrite environment variables are absent.

See `appwrite/README.md` for project, GitHub OAuth, database, and permission setup. Never expose `APPWRITE_API_KEY` using a `VITE_` prefix.

## Tests

```bash
npm test          # run once (what CI runs)
npm run test:watch
```

Tests use Vitest. Pure logic runs in Node; files that need a browser API start with `// @vitest-environment happy-dom`. The duel tests drive several players through a real room over an in-memory stand-in for PeerJS, so no network or browser is needed. Server tests live next to the code in `api/_lib/` (anything else under `api/` would be deployed as an endpoint).

CI (`.github/workflows/ci.yml`) typechecks, builds and runs the tests on every pull request and on pushes to `main`.
