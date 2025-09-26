import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch } from "../lib/apiClient";

export type TrackRow = {
  // Core identifiers
  id?: string;               // Deezer track id (for compatibility)
  spotify_id: string;        // Spotify track id (for backward compatibility)
  
  // Track info
  name: string;
  title?: string;            // Deezer title field
  
  // Artist info
  artists: { id: string; name: string }[];
  artist?: string;           // Deezer artist field
  artist_primary_id: string;
  artist_primary_name: string;
  
  // Album info
  album_id: string;
  album_name: string;
  album?: string;            // Deezer album field
  cover_url: string;
  album_art?: string;        // Deezer album_art field
  
  // Audio features
  bpm?: number | string | null;
  key_num?: number | null;   // 0-11
  mode?: 0 | 1 | null;       // 1=major,0=minor
  key_str?: string | null;   // preformatted if available
  audio?: {                 // Deezer audio object
    bpm?: number | null;
    key?: number | null;
    gain?: number | null;
    time_signature?: number | null;
  };
  
  // Additional metadata
  duration_sec?: number;     // Deezer duration field
  preview_url?: string;      // Deezer preview field
  source?: string;           // Track source (deezer, spotify, etc.)
  genres?: string[];         // from primary artist
  date_added?: string;
  
  // Enrichment metadata
  metaSource?: string;       // BPM source: deezer, getsongbpm, analysis_preview
  metaConfidence?: number;   // Confidence score for enriched data
};

type Collection = { 
  id: string; 
  name: string; 
  trackIds: string[];
  coverImage?: string; // Base64 encoded image or URL
};

type State = {
  // SEARCH
  searchQuery: string;
  searchResults: TrackRow[];       // last results
  searchMembership: Record<string, boolean>; // spotify_id -> in library

  // LIBRARY
  libraryById: Record<string, TrackRow>;     // spotify_id -> track
  libraryOrder: string[];                    // for stable display order

  // COLLECTIONS
  collections: Record<string, Collection>;   // id -> collection
  collectionOrder: string[];

  // actions
  setSearchResults: (q: string, rows: TrackRow[], membership: string[]) => void;
  toggleLibrary: (row: TrackRow) => void; // add/remove
  isInLibrary: (id: string) => boolean;
  updateTrack: (track: TrackRow) => Promise<void>;
  addToCollections: (trackId: string, collectionIds: string[]) => void;
  createCollection: (name: string) => string;
  updateCollectionCover: (collectionId: string, coverImage: string) => void;
  syncWithServer: () => Promise<void>;
  clearCollections: () => void;
};

export const useLibraryStore = create<State>()(
  persist(
    (set, get) => ({
      searchQuery: "",
      searchResults: [],
      searchMembership: {},

      libraryById: {},
      libraryOrder: [],

      collections: {},
      collectionOrder: [],

      setSearchResults: (q, rows, membershipIds) => {
        const membershipMap: Record<string, boolean> = {};
        membershipIds.forEach(id => (membershipMap[id] = true));
        set({ searchQuery: q, searchResults: rows, searchMembership: membershipMap });
      },

      isInLibrary: (id) => !!get().libraryById[id],

      updateTrack: async (track) => {
        const { libraryById } = get();
        set({
          libraryById: { ...libraryById, [track.spotify_id]: track }
        });
        
        // Also update on the server
        try {
          await apiFetch('/api/library/update-track', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(track)
          });
        } catch (error) {
          console.error('Failed to update track on server:', error);
        }
      },

      toggleLibrary: (row) => {
        const { libraryById, libraryOrder, searchMembership } = get();
        const exists = !!libraryById[row.spotify_id];

        if (exists) {
          // remove
          const { [row.spotify_id]: _, ...rest } = libraryById;
          set({
            libraryById: rest,
            libraryOrder: libraryOrder.filter(x => x !== row.spotify_id),
            searchMembership: { ...searchMembership, [row.spotify_id]: false }
          });
        } else {
          // add
          set({
            libraryById: { ...libraryById, [row.spotify_id]: { ...row, date_added: new Date().toISOString() } },
            libraryOrder: libraryOrder.includes(row.spotify_id) ? libraryOrder : [row.spotify_id, ...libraryOrder],
            searchMembership: { ...searchMembership, [row.spotify_id]: true }
          });
        }
      },

      addToCollections: (trackId, collectionIds) => {
        const { collections } = get();
        const updated: Record<string, Collection> = {};
        for (const id of Object.keys(collections)) {
          const c = collections[id];
          const shouldHave = collectionIds.includes(id);
          const has = c.trackIds.includes(trackId);
          if (shouldHave && !has) updated[id] = { ...c, trackIds: [...c.trackIds, trackId] };
          else if (!shouldHave && has) updated[id] = { ...c, trackIds: c.trackIds.filter(t => t !== trackId) };
        }
        set({ collections: { ...collections, ...updated } });
      },

      createCollection: (name) => {
        const id = `c_${Date.now()}`;
        const { collections, collectionOrder } = get();
        set({
          collections: { ...collections, [id]: { id, name, trackIds: [] } },
          collectionOrder: [...collectionOrder, id]
        });
        return id;
      },

      updateCollectionCover: (collectionId, coverImage) => {
        const { collections } = get();
        const collection = collections[collectionId];
        if (collection) {
          set({
            collections: {
              ...collections,
              [collectionId]: { ...collection, coverImage }
            }
          });
        }
      },

      syncWithServer: async () => {
        try {
          const response = await apiFetch('/api/library/sync');
          if (response.ok) {
            const serverTracks = await response.json();
            const currentLibrary = get().libraryById;
            
            // Only sync if there are tracks on the server that aren't in our local library
            const newTracks: Record<string, TrackRow> = {};
            const newOrder: string[] = [];
            
            serverTracks.forEach((track: any) => {
              if (!currentLibrary[track.spotify_id]) {
                newTracks[track.spotify_id] = {
                  spotify_id: track.spotify_id,
                  name: track.name,
                  artists: track.artists || [],
                  artist_primary_id: track.artist_primary_id,
                  artist_primary_name: track.artist_primary_name,
                  album_id: track.album_id,
                  album_name: track.album_name,
                  cover_url: track.cover_url,
                  bpm: track.bpm,
                  key_num: track.key_num,
                  mode: track.mode,
                  key_str: track.key_str,
                  genres: track.genres || [],
                  date_added: track.date_added
                };
                newOrder.push(track.spotify_id);
              }
            });
            
            // Only update if there are new tracks
            if (Object.keys(newTracks).length > 0) {
              set(state => ({
                libraryById: { ...state.libraryById, ...newTracks },
                libraryOrder: [...newOrder, ...state.libraryOrder]
              }));
              console.log('✅ Added new tracks from server:', newOrder.length, 'tracks');
            }
          }
        } catch (error) {
          console.error('❌ Failed to sync library with server:', error);
        }
      },

      clearCollections: () => {
        set({ collections: {}, collectionOrder: [] });
      }
    }),
    { name: "mashlab-store" }
  )
);
