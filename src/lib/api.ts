import { TrackRow, Criteria, Mashup } from '../store/mashups';
import { apiFetch } from './apiClient';

export async function searchMashups(params: {
  seedId: string;
  source: "library" | "collections" | "playlists" | "spotify";
  collectionIds?: string[];
  playlistIds?: string[];
  q?: string | null;
  criteria: Criteria;
  limit: number;
  offset: number;
  libraryTracks?: any[]; // Library tracks from Zustand store
}): Promise<{ items: TrackRow[]; total: number }> {
  const requestBody = {
    ...params,
    // Include library tracks when source is library
    ...(params.source === "library" && params.libraryTracks ? { libraryTracks: params.libraryTracks } : {})
  };

  const response = await apiFetch('/api/mashups/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return response.json();
}

export async function saveMashup(params: {
  seedId: string;
  partnerId: string;
  source: TrackRow["source"];
  criteria: Criteria;
}): Promise<{ ok: boolean; id: string }> {
  const response = await fetch('/api/mashups/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!response.ok) {
    throw new Error('Save failed');
  }

  return response.json();
}

export async function getSavedMashups(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: Mashup[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  const response = await fetch(`/api/mashups/saved?${searchParams}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch saved mashups');
  }

  return response.json();
}

export async function deleteSavedMashups(ids: string[]): Promise<{ ok: boolean }> {
  const response = await fetch('/api/mashups/saved', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error('Delete failed');
  }

  return response.json();
}
