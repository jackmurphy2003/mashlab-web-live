const RAW_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

function buildUrl(path: string) {
  if (/^https?:/i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!RAW_BASE) {
    return normalizedPath;
  }

  return `${RAW_BASE}${normalizedPath}`;
}

export async function apiFetch(input: string, init?: RequestInit) {
  const url = buildUrl(input);
  return fetch(url, init);
}

export function apiUrl(path: string) {
  return buildUrl(path);
}
