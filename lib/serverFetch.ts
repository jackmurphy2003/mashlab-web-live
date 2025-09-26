export async function serverFetch(path: string, init: RequestInit = {}) {
  const base = process.env.BACKEND_API_BASE ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    throw new Error('BACKEND_API_BASE or NEXT_PUBLIC_API_URL environment variable not set');
  }
  const headers = new Headers(init.headers || {});
  const previewSecret = process.env.PREVIEW_SHARED_SECRET;
  if (previewSecret) {
    headers.set("x-ml-preview-secret", previewSecret);
  }
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  
  const res = await fetch(`${base}${path}`, { ...init, headers });
  return res;
}
