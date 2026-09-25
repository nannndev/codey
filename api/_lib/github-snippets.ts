/**
 * GitHub snippet pipeline shared by /api/snippets and /api/daily: discover
 * popular repositories per language, sample files and cut typing-sized,
 * code-dense snippets. Files under api/_lib are not deployed as endpoints.
 */

export interface RepoCandidate {
  owner: string;
  repo: string;
  defaultBranch: string;
}

export interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

export interface DynamicSnippet {
  id: string;
  language: string;
  code: string;
  filename: string;
  source: { repo: string; url: string };
}

const GITHUB_API = 'https://api.github.com';

export const LANGUAGE_CONFIG: Record<string, {
  githubLanguage: string;
  extensions: string[];
  topic?: string;
  curated: Array<[string, string]>;
}> = {
  TypeScript: { githubLanguage: 'TypeScript', extensions: ['ts', 'tsx'], curated: [['TanStack', 'query'], ['shadcn-ui', 'ui'], ['vercel', 'next.js'], ['vuejs', 'core'], ['tailwindlabs', 'tailwindcss']] },
  React: { githubLanguage: 'TypeScript', extensions: ['tsx', 'jsx'], topic: 'react', curated: [['TanStack', 'query'], ['facebook', 'react'], ['mui', 'material-ui'], ['shadcn-ui', 'ui']] },
  JavaScript: { githubLanguage: 'JavaScript', extensions: ['js', 'jsx'], curated: [['expressjs', 'express'], ['vercel', 'next.js'], ['axios', 'axios'], ['facebook', 'react']] },
  Rust: { githubLanguage: 'Rust', extensions: ['rs'], curated: [['rust-lang', 'rust'], ['tokio-rs', 'tokio'], ['serde-rs', 'serde'], ['clap-rs', 'clap']] },
  Python: { githubLanguage: 'Python', extensions: ['py'], curated: [['psf', 'requests'], ['pallets', 'flask'], ['encode', 'httpx'], ['fastapi', 'fastapi'], ['pydantic', 'pydantic']] },
  Go: { githubLanguage: 'Go', extensions: ['go'], curated: [['gin-gonic', 'gin'], ['gofiber', 'fiber'], ['spf13', 'cobra'], ['go-chi', 'chi']] },
  PHP: { githubLanguage: 'PHP', extensions: ['php'], curated: [['laravel', 'framework'], ['symfony', 'symfony'], ['guzzle', 'guzzle'], ['slimphp', 'Slim'], ['nette', 'utils']] },
  Dart: { githubLanguage: 'Dart', extensions: ['dart'], curated: [['dart-lang', 'sdk'], ['dart-lang', 'http']] },
  Flutter: { githubLanguage: 'Dart', extensions: ['dart'], topic: 'flutter', curated: [['flutter', 'flutter'], ['flutter', 'packages']] },
  Kotlin: { githubLanguage: 'Kotlin', extensions: ['kt'], curated: [['square', 'okhttp'], ['square', 'retrofit'], ['Kotlin', 'kotlinx.coroutines'], ['ktorio', 'ktor']] },
  Swift: { githubLanguage: 'Swift', extensions: ['swift'], curated: [['Alamofire', 'Alamofire'], ['apple', 'swift-algorithms'], ['apple', 'swift-collections'], ['vapor', 'vapor']] },
  C: { githubLanguage: 'C', extensions: ['c', 'h'], curated: [['torvalds', 'linux'], ['redis', 'redis'], ['curl', 'curl']] },
  Zig: { githubLanguage: 'Zig', extensions: ['zig'], curated: [['ziglang', 'zig'], ['oven-sh', 'bun']] },
  Elixir: { githubLanguage: 'Elixir', extensions: ['ex', 'exs'], curated: [['phoenixframework', 'phoenix'], ['elixir-ecto', 'ecto'], ['elixir-lang', 'elixir']] },
  Lua: { githubLanguage: 'Lua', extensions: ['lua'], curated: [['Kong', 'kong'], ['nvim-lua', 'plenary.nvim'], ['folke', 'lazy.nvim']] },
};

const EXCLUDED_PATHS = /(^|\/)(test|tests|fixtures|generated|vendor|dist|build|examples?|benchmarks?|migrations?|snapshots?)(\/|$)|\.min\.|\.generated\.|\.g\./i;
const LINE_COMMENT = /^\s*(\/\/|#(?!\!)|--)(?:\s|$)/;

/** Fisher-Yates. `sort(() => Math.random() - 0.5)` is biased and barely moves the head of the list. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'codetype-snippet-service',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

async function githubJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.json() as Promise<T>;
}

export async function discoverRepos(language: string): Promise<RepoCandidate[]> {
  const config = LANGUAGE_CONFIG[language];
  const repos = new Map<string, RepoCandidate>();

  if (process.env.GITHUB_TOKEN) {
    const topic = config.topic ? ` topic:${config.topic}` : '';
    const query = encodeURIComponent(`language:${config.githubLanguage}${topic} stars:>1500 archived:false fork:false`);
    try {
      const result = await githubJSON<{ items: Array<{ owner: { login: string }; name: string; default_branch: string }> }>(
        `/search/repositories?q=${query}&sort=stars&order=desc&per_page=6`,
      );
      for (const item of result.items) {
        repos.set(`${item.owner.login}/${item.name}`, {
          owner: item.owner.login,
          repo: item.name,
          defaultBranch: item.default_branch,
        });
      }
    } catch {
      // Curated repositories below keep the endpoint available if search is limited.
    }
  }

  for (const [owner, repo] of config.curated) {
    const key = `${owner}/${repo}`;
    if (repos.has(key)) continue;
    try {
      const metadata = await githubJSON<{ default_branch: string }>(`/repos/${owner}/${repo}`);
      repos.set(key, { owner, repo, defaultBranch: metadata.default_branch });
    } catch {
      // Skip unavailable repositories.
    }
  }

  return [...repos.values()];
}

export function selectSnippet(code: string): string | null {
  const sourceLines = code.replace(/\r\n/g, '\n').split('\n');
  let inBlock = false;
  const flags = sourceLines.map((line) => {
    const trimmed = line.trim();
    if (inBlock) {
      if (trimmed.includes('*/')) inBlock = false;
      return true;
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/', 2)) inBlock = true;
      return true;
    }
    return LINE_COMMENT.test(line);
  });
  let best: { score: number; code: string } | null = null;

  for (let windowStart = 0; windowStart < sourceLines.length; windowStart += 8) {
    const selected: Array<{ line: string; comment: boolean }> = [];
    let length = 0;
    for (let index = windowStart; index < Math.min(sourceLines.length, windowStart + 70); index += 1) {
      const line = sourceLines[index].replace(/\s+$/g, '');
      if (line.length > 140) continue;
      if (selected.length > 0 && (selected.length >= 60 || length + line.length + 1 > 2200)) break;
      selected.push({ line, comment: flags[index] });
      length += line.length + 1;
    }
    while (selected.length && (!selected[0].line.trim() || selected[0].comment)) selected.shift();
    while (selected.length && !selected[selected.length - 1].line.trim()) selected.pop();
    const comments = selected.filter((item) => item.comment).length;
    const codeLines = selected.filter((item) => item.line.trim() && !item.comment).length;
    const meaningful = comments + codeLines;
    const snippet = selected.map((item) => item.line).join('\n').trim();
    if (snippet.length < 80 || codeLines < 5 || !meaningful || comments / meaningful > 0.3) continue;
    const score = codeLines * 5 + Math.min(snippet.length, 2200) / 100 - comments * 7;
    if (!best || score > best.score) best = { score, code: snippet };
  }

  return best?.code ?? null;
}

export async function snippetsFromRepo(language: string, candidate: RepoCandidate): Promise<DynamicSnippet[]> {
  const config = LANGUAGE_CONFIG[language];
  const tree = await githubJSON<{ tree: TreeItem[]; truncated: boolean }>(
    `/repos/${candidate.owner}/${candidate.repo}/git/trees/${encodeURIComponent(candidate.defaultBranch)}?recursive=1`,
  );

  const files = tree.tree.filter((item) => {
    const extension = item.path.split('.').pop()?.toLowerCase() ?? '';
    return item.type === 'blob'
      && config.extensions.includes(extension)
      && !EXCLUDED_PATHS.test(item.path)
      && (item.size ?? 0) >= 200
      && (item.size ?? 0) <= 20_000;
  });

  // Sample across the whole tree. A contiguous window returns neighbouring files
  // from one directory, which read as "the same code" even when the offset moves.
  const candidates = shuffle(files).slice(0, 5);
  const snippets = await Promise.all(candidates.map(async (file) => {
    try {
      const content = await githubJSON<{ content: string; encoding: string }>(
        `/repos/${candidate.owner}/${candidate.repo}/contents/${encodeURIComponent(file.path)}?ref=${encodeURIComponent(candidate.defaultBranch)}`,
      );
      if (content.encoding !== 'base64') return null;
      const binary = atob(content.content.replace(/\n/g, ''));
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const decoded = new TextDecoder().decode(bytes);
      const code = selectSnippet(decoded);
      if (!code) return null;
      const filename = file.path.split('/').pop() ?? file.path;
      return {
        id: `${candidate.owner}-${candidate.repo}-${file.path}`,
        language,
        code,
        filename,
        source: {
          repo: `${candidate.owner}/${candidate.repo}`,
          url: `https://github.com/${candidate.owner}/${candidate.repo}/blob/${candidate.defaultBranch}/${file.path}`,
        },
      } satisfies DynamicSnippet;
    } catch {
      return null;
    }
  }));

  return snippets.filter((snippet): snippet is DynamicSnippet => snippet !== null);
}

declare const process: { env: Record<string, string | undefined> };
