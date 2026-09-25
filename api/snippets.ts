import {
  LANGUAGE_CONFIG,
  discoverRepos,
  shuffle,
  snippetsFromRepo,
  type DynamicSnippet,
} from './_lib/github-snippets.js';

interface ApiRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const responseCache = new Map<string, { expiresAt: number; snippets: DynamicSnippet[] }>();

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method && request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const rawLanguage = request.query.language;
  const language = Array.isArray(rawLanguage) ? rawLanguage[0] : rawLanguage;
  if (!language || !LANGUAGE_CONFIG[language]) {
    response.status(400).json({ error: 'Unsupported language' });
    return;
  }

  const cacheKey = language.toLowerCase();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    response.status(200).json({ snippets: cached.snippets, source: 'cache' });
    return;
  }

  try {
    const repositories = await discoverRepos(language);
    // Shuffle so the same three repos are not always the ones sampled, and keep a
    // pool large enough that a 6-hour cache still feels varied to one player.
    const batches = await Promise.all(
      shuffle(repositories).slice(0, 4).map((repo) => snippetsFromRepo(language, repo).catch(() => [])),
    );
    const snippets = shuffle(batches.flat()).slice(0, 40);
    responseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, snippets });
    response.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    response.status(200).json({
      snippets,
      source: process.env.GITHUB_TOKEN ? 'github-search' : 'curated',
    });
  } catch {
    response.status(502).json({ error: 'GitHub source is temporarily unavailable', snippets: [] });
  }
}
declare const process: { env: Record<string, string | undefined> };
