import { Account, Client, Databases } from 'node-appwrite';

/** Server-side Appwrite config shared by the daily challenge endpoints. */
export const APPWRITE = {
  endpoint: process.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1',
  projectId: process.env.VITE_APPWRITE_PROJECT_ID || '',
  databaseId: process.env.VITE_APPWRITE_DATABASE_ID || 'codetype',
  apiKey: process.env.APPWRITE_API_KEY,
  collections: {
    profiles: process.env.VITE_APPWRITE_PROFILES_COLLECTION_ID || 'profiles',
    runSessions: process.env.VITE_APPWRITE_RUN_SESSIONS_COLLECTION_ID || 'run_sessions',
    dailyChallenges: process.env.VITE_APPWRITE_DAILY_CHALLENGES_COLLECTION_ID || 'daily_challenges',
    dailyRuns: process.env.VITE_APPWRITE_DAILY_RUNS_COLLECTION_ID || 'daily_runs',
  },
};

export function isConfigured(): boolean {
  return Boolean(APPWRITE.projectId && APPWRITE.apiKey);
}

export function adminDatabases(): Databases {
  const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.projectId);
  if (APPWRITE.apiKey) client.setKey(APPWRITE.apiKey);
  return new Databases(client);
}

/** Resolves the Appwrite user ID from a JWT in Authorization or X-Appwrite-JWT. */
export async function authenticateRequest(headers: Record<string, string | string[] | undefined>): Promise<string | null> {
  const header = headers.authorization || headers['x-appwrite-jwt'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return null;
  try {
    const client = new Client()
      .setEndpoint(APPWRITE.endpoint)
      .setProject(APPWRITE.projectId)
      .setJWT(raw.startsWith('Bearer ') ? raw.slice(7) : raw);
    return (await new Account(client).get()).$id;
  } catch {
    return null;
  }
}

export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface ApiResponse {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

export function applyCors(res: ApiResponse, methods: string) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', `${methods}, OPTIONS`);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Appwrite-JWT');
}

export function readBody<T>(req: ApiRequest): Partial<T> {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Partial<T>;
    } catch {
      return {};
    }
  }
  return req.body as Partial<T>;
}

declare const process: { env: Record<string, string | undefined> };
