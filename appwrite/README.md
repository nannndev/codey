# Appwrite Setup

Codey remains fully usable without Appwrite. Configure Appwrite only when public accounts, cloud history, and leaderboards are ready to be enabled.

## Project

1. Create an Appwrite Cloud project.
2. Add a Web platform for each allowed hostname:
   - `localhost`
   - the production Vercel domain
3. Copy the project ID into `VITE_APPWRITE_PROJECT_ID`.
4. This project is currently hosted in Singapore, so its endpoint is `https://sgp.cloud.appwrite.io/v1`.

## GitHub OAuth

1. In Appwrite, open **Auth -> Settings -> OAuth2 Providers -> GitHub**.
2. Create a GitHub OAuth App at <https://github.com/settings/developers>.
3. Copy the callback URL shown by Appwrite into the GitHub OAuth App authorization callback field.
4. Add the GitHub Client ID and Client Secret to Appwrite. The secret belongs in Appwrite, never in Vite environment variables.

The frontend helper `signInWithGitHub()` is available in `src/lib/appwrite.ts`.

## Database

Create a database using the existing legacy ID `codetype`, then create the collections described in `schema.md` (including `daily_challenges` and `daily_runs` for the daily challenge). The legacy ID is intentionally preserved after the Codey rename so current cloud data remains connected. Collection IDs can be changed through the Vite environment variables in `.env.example`.

## Server API key

Future verified run submission should happen in Vercel functions using `APPWRITE_API_KEY`. Never give the browser permission to mark a run as verified.

## Daily challenge collections

The daily challenge needs `daily_challenges` and `daily_runs`. Create them with the setup script instead of clicking through the console:

1. In Appwrite, open **Overview → Integrations → API keys** and create a key with these scopes: `databases.read`, `databases.write`, `collections.read`, `collections.write`, `attributes.read`, `attributes.write`, `indexes.read`, `indexes.write`.
2. Put the project values in a local `.env` (never commit it):

   ```bash
   VITE_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
   VITE_APPWRITE_PROJECT_ID=your_project_id
   VITE_APPWRITE_DATABASE_ID=codetype
   APPWRITE_API_KEY=the_key_from_step_1
   ```

3. Run `npm run setup:daily`. It is safe to run again; it only adds what is missing.

The Vercel `APPWRITE_API_KEY` used by the API also needs `documents.read` and `documents.write` so it can freeze each day's challenge and save scores. No redeploy is needed after the collections exist.

