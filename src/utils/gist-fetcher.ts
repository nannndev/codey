import type { Snippet } from "@/types";

const EXTENSION_MAP: Record<string, string> = {
  ts: "TypeScript",
  tsx: "React",
  js: "JavaScript",
  jsx: "React",
  py: "Python",
  rs: "Rust",
  go: "Go",
  php: "PHP",
  dart: "Dart",
  kt: "Kotlin",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  h: "C",
  css: "CSS",
  sql: "SQL",
  yml: "YAML",
  yaml: "YAML",
  sh: "Bash",
  bash: "Bash",
  ex: "Elixir",
  lua: "Lua",
  zig: "Zig",
  json: "JSON",
};

export function detectLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_MAP[ext] ?? "Plain Text";
}

export async function fetchCodeFromGistOrUrl(rawInput: string): Promise<Snippet> {
  const urlString = rawInput.trim();
  if (!urlString) {
    throw new Error("URL or Gist ID cannot be empty.");
  }

  // 1. Raw GitHub user content URL (e.g., https://raw.githubusercontent.com/user/repo/main/file.ts)
  if (urlString.includes("raw.githubusercontent.com")) {
    const res = await fetch(urlString);
    if (!res.ok) throw new Error(`Failed to fetch file (HTTP ${res.status})`);
    const code = await res.text();
    const filename = urlString.split("/").pop() || "raw-file.txt";
    const language = detectLanguageFromFilename(filename);

    return {
      id: `raw-${Date.now()}`,
      filename,
      language,
      code: code.replace(/\r\n/g, "\n").trimEnd(),
      sourceType: "custom",
    };
  }

  // 2. GitHub Gist URL or Gist ID (e.g. https://gist.github.com/username/123456789 or just 123456789)
  let gistId = urlString;
  const gistMatch = urlString.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i);
  if (gistMatch?.[1]) {
    gistId = gistMatch[1];
  }

  // Fetch Gist details via GitHub REST API
  const apiRes = await fetch(`https://api.github.com/gists/${gistId}`);
  if (!apiRes.ok) {
    throw new Error(`Gist not found or invalid Gist ID (HTTP ${apiRes.status})`);
  }

  const gistData = (await apiRes.json()) as {
    files: Record<string, { filename: string; language: string | null; raw_url: string; content?: string }>;
  };

  const fileKeys = Object.keys(gistData.files);
  if (fileKeys.length === 0) {
    throw new Error("Gist contains no files.");
  }

  // Grab the first file in the Gist
  const firstFile = gistData.files[fileKeys[0]];
  let code = firstFile.content;

  if (!code && firstFile.raw_url) {
    const rawRes = await fetch(firstFile.raw_url);
    if (!rawRes.ok) throw new Error("Failed to fetch raw Gist file content.");
    code = await rawRes.text();
  }

  if (!code) {
    throw new Error("Gist file is empty.");
  }

  const language = firstFile.language || detectLanguageFromFilename(firstFile.filename);

  return {
    id: `gist-${gistId}`,
    filename: firstFile.filename,
    language,
    code: code.replace(/\r\n/g, "\n").trimEnd(),
    sourceType: "custom",
    source: {
      repo: `Gist: ${gistId.slice(0, 8)}`,
      url: urlString.startsWith("http") ? urlString : `https://gist.github.com/${gistId}`,
    },
  };
}
