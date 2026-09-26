import { Client, Databases, Account, Permission, Role } from 'node-appwrite';
import { MIN_RANKED_ACCURACY, MIN_RANKED_WPM } from '../../src/utils/ranking.js';
import type { SnippetLength, TestMode } from '../../src/types.js';
import { encodeTrace, traceFromIntervals } from '../../src/utils/speed-trace.js';

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
const APPWRITE_RUNS_ID = process.env.VITE_APPWRITE_RUNS_COLLECTION_ID || 'runs';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

function getAppwriteAdmin() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);
  if (APPWRITE_API_KEY) {
    client.setKey(APPWRITE_API_KEY);
  }
  return { client, databases: new Databases(client) };
}

async function authenticateRequest(req: ApiRequest): Promise<string | null> {
  const authHeader = req.headers['authorization'] || req.headers['x-appwrite-jwt'];
  const jwt = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  if (!jwt) return null;

  const token = jwt.startsWith('Bearer ') ? jwt.slice(7) : jwt;
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT)
      .setJWT(token);
    const account = new Account(client);
    const user = await account.get();
    return user.$id;
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Appwrite-JWT');

  if (req.method === 'OPTIONS') {
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userId = await authenticateRequest(req);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required to submit Ranked run.' });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
    sessionId?: string;
    challengeHash?: string;
    completedCode?: string;
    mistakes?: number;
    keystrokes?: number;
    correctChars?: number;
    totalMs?: number;
    keyIntervals?: number[];
    language?: string;
    mode?: TestMode;
    snippetLength?: SnippetLength;
    durationSeconds?: number;
  } || {};

  const {
    sessionId,
    challengeHash,
    completedCode = '',
    mistakes = 0,
    keystrokes = completedCode.length,
    correctChars = Math.max(0, completedCode.length - mistakes),
    totalMs = 1,
    keyIntervals = [],
    language = 'TypeScript',
    mode = 'snippet',
    snippetLength = 'medium',
    durationSeconds,
  } = body;

  if (!sessionId || !completedCode || totalMs <= 0) {
    res.status(400).json({ error: 'Invalid submission payload.' });
    return;
  }

  const { databases } = getAppwriteAdmin();

  // Verify session document if present
  try {
    const sessionDoc = await databases.getDocument({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId: APPWRITE_RUN_SESSIONS_ID,
      documentId: sessionId,
    });

    if (sessionDoc.userId !== userId) {
      res.status(403).json({ error: 'Session belongs to another user.' });
      return;
    }

    if (sessionDoc.completedAt) {
      res.status(400).json({ error: 'Challenge session already completed.' });
      return;
    }

    if (new Date(sessionDoc.expiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: 'Challenge session expired.' });
      return;
    }

    if (challengeHash && sessionDoc.challenge !== challengeHash) {
      res.status(400).json({ error: 'Challenge hash mismatch.' });
      return;
    }
  } catch (sessionError) {
    console.error('Failed to verify Ranked session:', sessionError);
    res.status(400).json({ error: 'Ranked session was not found or could not be verified.' });
    return;
  }

  // Authoritative Metric Recalculation
  const charLength = completedCode.length;
  const totalKeystrokes = Math.max(charLength, Math.round(keystrokes));
  const finalCorrectChars = Math.max(0, Math.min(charLength, Math.round(correctChars)));
  const successfulAttempts = Math.max(0, totalKeystrokes - mistakes);
  const minutes = Math.max(0.001, totalMs / 60000);

  const calculatedWpm = Number(((finalCorrectChars / 5) / minutes).toFixed(1));
  const calculatedRawWpm = Number(((totalKeystrokes / 5) / minutes).toFixed(1));
  const calculatedAccuracy = Number(Math.max(0, Math.min(100, (successfulAttempts / totalKeystrokes) * 100)).toFixed(1));

  // Anti-Cheat Checks
  if (calculatedAccuracy < MIN_RANKED_ACCURACY) {
    res.status(400).json({ error: `Accuracy ${calculatedAccuracy}% is below the ${MIN_RANKED_ACCURACY}% minimum required for Ranked Mode.` });
    return;
  }

  if (calculatedWpm < MIN_RANKED_WPM) {
    res.status(400).json({ error: `WPM ${calculatedWpm} is below the ${MIN_RANKED_WPM} WPM minimum required for Ranked Mode.` });
    return;
  }

  if (calculatedWpm > 250) {
    res.status(400).json({ error: 'Run rejected: WPM exceeds plausibility threshold.' });
    return;
  }

  if (charLength >= 50 && totalMs < charLength * 12) {
    res.status(400).json({ error: 'Run rejected: Duration is impossibly short.' });
    return;
  }

  if (keyIntervals.length > 20) {
    const minInterval = Math.min(...keyIntervals);
    if (minInterval < 2) {
      res.status(400).json({ error: 'Run rejected: Synthetic keypress timing detected.' });
      return;
    }
  }

  // Create Verified Run Document
  const documentId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const speedTrace = encodeTrace(traceFromIntervals(keyIntervals, totalMs));
    const runData = {
      userId,
      sessionId,
      language,
      mode,
      snippetLength,
      targetChars: charLength,
      durationMs: Math.round(totalMs),
      durationSeconds: durationSeconds ?? (mode === 'timed' ? Math.round(totalMs / 1000) : undefined),
      wpm: calculatedWpm,
      rawWpm: calculatedRawWpm,
      accuracy: calculatedAccuracy,
      consistency: 92.5,
      correctChars: finalCorrectChars,
      keystrokes: totalKeystrokes,
      mistakes,
      snippetsCompleted: 1,
      verified: true,
    };
    const createRun = (data: Record<string, unknown>) => databases.createDocument({
      databaseId: APPWRITE_DATABASE_ID,
      collectionId: APPWRITE_RUNS_ID,
      documentId,
      data,
      permissions: [
        Permission.read(Role.any()),
      ],
    });
    let runDocument;
    try {
      runDocument = await createRun(speedTrace ? { ...runData, speedTrace } : runData);
    } catch (error) {
      // The speedTrace attribute is optional; a project without it still stores the run.
      if (!speedTrace || (error as { code?: number })?.code !== 400) throw error;
      runDocument = await createRun(runData);
    }

    // Mark session completed
    try {
      await databases.updateDocument({
        databaseId: APPWRITE_DATABASE_ID,
        collectionId: APPWRITE_RUN_SESSIONS_ID,
        documentId: sessionId,
        data: { completedAt: new Date().toISOString() },
      });
    } catch {
      // Non-fatal
    }

    res.status(200).json({
      verified: true,
      runId: runDocument.$id,
      wpm: calculatedWpm,
      rawWpm: calculatedRawWpm,
      accuracy: calculatedAccuracy,
    });
  } catch (dbError) {
    console.error('Failed to create verified run document:', dbError);
    res.status(500).json({ error: 'Failed to record verified run.' });
  }
}
