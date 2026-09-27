import { Account, Client, Databases } from 'node-appwrite';

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

const APPWRITE_ENDPOINT = process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT = process.env.VITE_APPWRITE_PROJECT_ID || 'codey-main';
const APPWRITE_DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || 'main';
const APPWRITE_RUN_SESSIONS_ID = process.env.VITE_APPWRITE_RUN_SESSIONS_COLLECTION_ID || 'run_sessions';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

function adminDatabases() {
  const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
  if (APPWRITE_API_KEY) client.setKey(APPWRITE_API_KEY);
  return new Databases(client);
}

async function authenticateRequest(req: ApiRequest): Promise<string | null> {
  const header = req.headers.authorization || req.headers['x-appwrite-jwt'];
  const rawToken = Array.isArray(header) ? header[0] : header;
  if (!rawToken) return null;

  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
      .setJWT(rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken);
    return (await new Account(client).get()).$id;
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Appwrite-JWT');

  if (req.method === 'OPTIONS') return void res.status(200).json({ ok: true });
  if (req.method !== 'POST') return void res.status(405).json({ error: 'Method not allowed.' });

  const userId = await authenticateRequest(req);
  if (!userId) return void res.status(401).json({ error: 'Authentication required to start Ranked Mode.' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { sessionId?: string } || {};
  if (!body.sessionId) return void res.status(400).json({ error: 'Missing Ranked session.' });

  try {
    const databases = adminDatabases();
    const session = await databases.getDocument({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId: APPWRITE_RUN_SESSIONS_ID,
      documentId: body.sessionId,
    });

    if (session.userId !== userId) return void res.status(403).json({ error: 'Ranked session ownership mismatch.' });
    if (session.completedAt) return void res.status(409).json({ error: 'Ranked session was already completed.' });

    const now = Date.now();
    const currentExpiry = new Date(session.expiresAt).getTime();
    if (currentExpiry < now) return void res.status(410).json({ error: 'Challenge session expired before typing started.' });

    const mode = session.mode === 'timed' ? 'timed' : 'snippet';
    const runWindowMs = mode === 'timed'
      ? (Number(session.durationSeconds || 30) + 120) * 1000
      : 20 * 60 * 1000;

    // Fresh challenges expire exactly 30 minutes after document creation.
    // Once armed, expiresAt changes to the run deadline and cannot be extended.
    const waitingRoomExpiry = new Date(session.$createdAt).getTime() + 30 * 60 * 1000;
    const alreadyStarted = Math.abs(currentExpiry - waitingRoomExpiry) > 5_000;
    const expiresAt = alreadyStarted
      ? session.expiresAt as string
      : new Date(now + runWindowMs).toISOString();

    if (!alreadyStarted) {
      await databases.updateDocument({
        databaseId: APPWRITE_DATABASE_ID,
        collectionId: APPWRITE_RUN_SESSIONS_ID,
        documentId: body.sessionId,
        data: { expiresAt },
      });
    }

    res.status(200).json({ startedAt: new Date(new Date(expiresAt).getTime() - runWindowMs).toISOString(), expiresAt });
  } catch (error) {
    console.error('Failed to arm Ranked session:', error);
    res.status(503).json({ error: 'Ranked session could not be started.' });
  }
}
