import { APPWRITE, adminDatabases } from './appwrite-admin.js';
import { languageLabel, metaPageHtml, RUN_ID_PATTERN } from './share-card.js';
import { CARD_VERSION } from '../../src/utils/share-card-version.js';

/**
 * "Challenge a friend" links: /c/<id> previews with a card that shows the
 * score to beat and the first lines of the snippet, then opens it to type.
 */

export interface SharedChallenge {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  language: string;
  wpm: number;
  accuracy: number;
  /** The first lines of the snippet, for the card. */
  preview: string[];
  lines: number;
}

type Doc = Record<string, unknown>;

interface ChallengeDb {
  getDocument(params: { databaseId: string; collectionId: string; documentId: string }): Promise<Doc>;
}

const text = (value: unknown, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max);

export async function loadChallenge(id: string, db: ChallengeDb = adminDatabases() as unknown as ChallengeDb): Promise<SharedChallenge | null> {
  if (!RUN_ID_PATTERN.test(id)) return null;
  let doc: Doc;
  try {
    doc = await db.getDocument({ databaseId: APPWRITE.databaseId, collectionId: process.env.VITE_APPWRITE_CHALLENGES_COLLECTION_ID || 'challenges', documentId: id });
  } catch {
    return null;
  }
  const username = text(doc.username, 64) || null;
  const code = text(doc.code, 16000).replace(/\t/g, '  ');
  const lines = code.split('\n');
  return {
    id,
    name: text(doc.name, 64) || username || 'A Codey typist',
    username,
    avatarUrl: username ? `https://avatars.githubusercontent.com/${encodeURIComponent(username)}?s=200` : null,
    language: languageLabel(text(doc.language, 40)),
    wpm: Number(doc.wpm) || 0,
    accuracy: Number(doc.accuracy) || 0,
    preview: lines.slice(0, 7).map((line) => (line.length > 46 ? `${line.slice(0, 44).trimEnd()}...` : line)),
    lines: lines.length,
  };
}

export function challengeTitle(challenge: SharedChallenge) {
  return `${challenge.name} challenges you: beat ${challenge.wpm.toFixed(1)} WPM${challenge.language === 'Mixed' ? '' : ` in ${challenge.language}`}`;
}

export function challengeShareHtml(challenge: SharedChallenge | null, origin: string, id: string) {
  return metaPageHtml({
    title: challenge ? challengeTitle(challenge) : 'Codey: type real code, faster',
    description: challenge
      ? `Type the same ${challenge.lines}-line snippet and see if you are faster. ${challenge.accuracy.toFixed(1)}% accuracy to match.`
      : 'Typing practice with real code from GitHub, daily challenges and live duels.',
    image: challenge ? `${origin}/api/og/${encodeURIComponent(id)}?kind=challenge&v=${CARD_VERSION}` : `${origin}/og-default.png?v=${CARD_VERSION}`,
    url: `${origin}/c/${encodeURIComponent(id)}`,
    target: challenge ? `${origin}/?challenge=${encodeURIComponent(id)}` : origin,
  });
}
