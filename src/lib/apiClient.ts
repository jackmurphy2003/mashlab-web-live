const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function buildUrl(path: string) {
  if (/^https?:/i.test(path)) return path;
  if (path.startsWith('/')) return `${DEFAULT_BASE}${path}`;
  return `${DEFAULT_BASE}/${path}`;
}

export async function apiFetch(input: string, init?: RequestInit) {
  return fetch(buildUrl(input), init);
}

export function apiUrl(path: string) {
  return buildUrl(path);
}
