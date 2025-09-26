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

  try {
    const r = await serverFetch(`/api/deezer/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`);
    const body = await r.text();
    res.status(r.status).send(body);
  } catch (error) {
    console.error("Deezer search proxy error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
