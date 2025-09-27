import type { NextApiRequest, NextApiResponse } from "next";
import { serverFetch } from "../../../lib/serverFetch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).setHeader("Allow", "GET").end();
  }

  const q = req.query.q;
  const limit = req.query.limit ?? "25";

  if (!q || typeof q !== "string") {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  const backendBase = process.env.BACKEND_API_BASE ?? process.env.NEXT_PUBLIC_API_URL;

  try {
    if (backendBase) {
      const r = await serverFetch(`/api/deezer/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`);
      const body = await r.text();
      res.status(r.status).send(body);
      return;
    }

    // Fallback: hit Deezer directly when no backend is configured
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`;
    const response = await fetch(deezerUrl);
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    console.error("Deezer search proxy error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
