import { Account, Client, Databases, OAuthProvider } from "appwrite";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT?.trim();
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim();

export const appwriteConfig = {
  endpoint: endpoint || "https://sgp.cloud.appwrite.io/v1",
  projectId: projectId || "",
  databaseId: import.meta.env.VITE_APPWRITE_DATABASE_ID?.trim() || "codetype",
  profilesCollectionId: import.meta.env.VITE_APPWRITE_PROFILES_COLLECTION_ID?.trim() || "profiles",
  runsCollectionId: import.meta.env.VITE_APPWRITE_RUNS_COLLECTION_ID?.trim() || "runs",
  runSessionsCollectionId: import.meta.env.VITE_APPWRITE_RUN_SESSIONS_COLLECTION_ID?.trim() || "run_sessions",
  dailyRunsCollectionId: import.meta.env.VITE_APPWRITE_DAILY_RUNS_COLLECTION_ID?.trim() || "daily_runs",
};

export const isAppwriteConfigured = Boolean(projectId);

const client = isAppwriteConfigured
  ? new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId)
  : null;

export const account = client ? new Account(client) : null;
export const databases = client ? new Databases(client) : null;

export function signInWithGitHub(): void {
  if (!account) throw new Error("Appwrite is not configured");

  const origin = window.location.origin;
  account.createOAuth2Session({
    provider: OAuthProvider.Github,
    success: `${origin}/`,
    failure: `${origin}/?auth=failed`,
  });
}

export async function signOut(): Promise<void> {
  if (!account) return;
  await account.deleteSession({ sessionId: "current" });
}
