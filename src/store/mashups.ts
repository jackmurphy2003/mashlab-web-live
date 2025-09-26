import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '../lib/apiClient';

export type TrackRow = {
  // Core identifiers
  id: string;                 // Deezer track id or spotify track id
  spotify_id?: string;        // Spotify track id (for backward compatibility)

  // Track info
  name: string;
  title?: string;            // Deezer title field

  // Artist info
  artist: string;             // primary artist name
  artistId?: string;          // primary artist id
  artist_primary_name?: string; // from library store

  // Album info
  cover: string;              // album art URL
  album?: string;

  // Audio features
  bpm?: number | string | null;        // from GetSongBPM API or audio-features.tempo
  keyNum?: number | null;     // 0–11
  mode?: 0 | 1 | null;        // 1=major, 0=minor
  keyStr?: string | null;     // formatted from (keyNum, mode), e.g., "A minor"
  audio?: {                 // Deezer audio object
    bpm?: number | null;
    key?: string | null;
    gain?: number | null;
    time_signature?: number | null;
  };

  // Additional metadata
  popularity?: number | null; // track.popularity 0–100
  features?: Partial<{
    energy: number; danceability: number; valence: number;
    acousticness: number; instrumentalness: number; liveness: number; speechiness: number;
    genres?: string[];
  }>;
  genres?: string[];         // from primary artist
  explicit?: boolean | null;
  year?: number | null;
  source: "library" | "collections" | "playlists" | "spotify";

  // Enrichment metadata
  metaSource?: string;       // BPM source: deezer, getsongbpm, analysis_preview, placeholder
  metaConfidence?: number;   // Confidence score for enriched data
};

export type Criteria = {
  bpm: [number, number];      // ALWAYS enforced
  keyOn: boolean;             // same key as seed when true
  yearOn?: boolean;           year?: [number, number] | null;
  excludeSameArtist?: boolean;
  explicitFree?: boolean;

  artistOn?: boolean;         artistIds?: string[];   // primary artist IDs
  genresOn?: boolean;         genres?: string[];      // normalized genre names
  query?: string | null;      // free text
};

export type Mashup = {
  id: string;
  seedId: string;             // spotify id of seed
  partnerId: string;          // spotify id of match
  source: TrackRow["source"];
  criteria: Criteria;
  createdAt: string;
  note?: string;
  tags?: string[];
  seedTrack?: TrackRow;       // full seed track data
  partnerTrack?: TrackRow;    // full partner track data
};

type MashupsState = {
  // Build state
  seed?: TrackRow;
  source: "library" | "collections" | "playlists" | "spotify";
  selectedCollectionIds: string[];
  selectedPlaylistIds: string[];
  criteria: Criteria;
  results: TrackRow[];
  total: number;
  offset: number;
  loading: boolean;
  
  // Saved mashups
  saved: Mashup[];

  // Actions
  setSeed: (track: TrackRow) => void;
  setSource: (source: "library" | "collections" | "playlists" | "spotify") => void;
  setCollections: (ids: string[]) => void;
  setPlaylists: (ids: string[]) => void;
  setCriteria: (partial: Partial<Criteria>) => void;
  search: (options?: { reset?: boolean }) => Promise<void>;
  showMore: () => Promise<void>;
  saveMashup: (partner: TrackRow) => Promise<void>;
  removeMashup: (id: string) => void;
  updateMashupNote: (id: string, note: string) => void;
  updateMashupTags: (id: string, tags: string[]) => void;
  setBpmPercent: (percent: number) => void;
};

export const useMashups = create<MashupsState>()(
  persist(
    (set, get) => ({
      // Initial state
      source: "library",
      selectedCollectionIds: [],
      selectedPlaylistIds: [],
      criteria: {
        bpm: [120, 130],
        keyOn: false,
        yearOn: false,
        year: [2010, 2024],
        excludeSameArtist: false,
        explicitFree: false,
        artistOn: false,
        artistIds: [],
        genresOn: false,
        genres: [],
        query: null
      },
      results: [],
      total: 0,
      offset: 0,
      loading: false,
      saved: [],

      // Actions
      setSeed: (track) => {
        set({ seed: track });
        // Auto-update BPM range based on seed BPM
        const seedBpm = track.audio?.bpm || track.bpm;
        if (seedBpm && typeof seedBpm === 'number') {
          const range = [Math.max(40, seedBpm - 5), Math.min(300, seedBpm + 5)];
          set(state => ({
            criteria: { ...state.criteria, bpm: range as [number, number] }
          }));
        }
      },

      setSource: (source) => {
        set({ 
          source,
          selectedCollectionIds: [],
          selectedPlaylistIds: [],
          results: [],
          total: 0,
          offset: 0
        });
      },

      setCollections: (ids) => {
        set({ selectedCollectionIds: ids });
      },

      setPlaylists: (ids) => {
        set({ selectedPlaylistIds: ids });
      },

      setCriteria: (partial) => {
        set(state => ({
          criteria: { ...state.criteria, ...partial }
        }));
      },

      search: async (options = {}) => {
        const { seed, source, selectedCollectionIds, selectedPlaylistIds, criteria } = get();
        
        console.log('🎯 Search function called with:', { seed, source, criteria });
        
        if (!seed) {
          console.error('❌ No seed track selected');
          return;
        }

        console.log('✅ Seed track found, starting search...');
        set({ loading: true });

        try {
          const offset = options.reset ? 0 : get().offset;
          
          // Get library tracks from the library store when source is library or collections
          let libraryTracks = undefined;
          if (source === 'library') {
            // Import the library store to get the current library tracks
            const { useLibraryStore } = await import('./library');
            const libraryStore = useLibraryStore.getState();
            const tracks = libraryStore.libraryOrder.map(id => libraryStore.libraryById[id]).filter(Boolean);
            libraryTracks = tracks;
            console.log(`📚 Sending ${tracks.length} library tracks to search`);
          } else if (source === 'collections') {
            // Import the library store to get collection tracks
            const { useLibraryStore } = await import('./library');
            const libraryStore = useLibraryStore.getState();
            
            // Get tracks from selected collections only
            const collectionTracks = [];
            for (const collectionId of selectedCollectionIds) {
              const collection = libraryStore.collections[collectionId];
              if (collection) {
                for (const trackId of collection.trackIds) {
                  const track = libraryStore.libraryById[trackId];
                  if (track) {
                    collectionTracks.push(track);
                  }
                }
              }
            }
            
            libraryTracks = collectionTracks;
            console.log(`📁 Sending ${collectionTracks.length} tracks from ${selectedCollectionIds.length} collections to search`);
          }
          
          const requestBody = {
            seedId: seed.id,
            source,
            collectionIds: source === 'collections' ? selectedCollectionIds : undefined,
            playlistIds: source === 'playlists' ? selectedPlaylistIds : undefined,
            q: criteria.query,
            criteria,
            limit: 10,
            offset,
            ...((source === 'library' || source === 'collections') && libraryTracks ? { libraryTracks } : {})
          };
          
          const response = await apiFetch('/api/mashups/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            throw new Error('Search failed');
          }

          const data = await response.json();
          console.log('📊 Search response received:', { items: data.items?.length, total: data.total });
          
          if (options.reset) {
            console.log('🔄 Resetting results with:', data.items?.length, 'items');
            set({ 
              results: data.items, 
              total: data.total, 
              offset: 10 
            });
          } else {
            console.log('➕ Appending results with:', data.items?.length, 'items');
            set({ 
              results: [...get().results, ...data.items], 
              total: data.total, 
              offset: offset + 10 
            });
          }
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          set({ loading: false });
        }
      },

      showMore: async () => {
        await get().search();
      },

      saveMashup: async (partner) => {
        const { seed, source, criteria } = get();
        
        console.log('💾 Save mashup called with:', { seed, partner, source, criteria });
        
        if (!seed) {
          console.error('❌ No seed track found for saving mashup');
          return;
        }

        try {
          const response = await apiFetch('/api/mashups/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seedId: seed.id,
              partnerId: partner.id,
              source,
              criteria,
              seedTrack: seed,
              partnerTrack: partner
            })
          });

          if (!response.ok) {
            throw new Error('Save failed');
          }

          const data = await response.json();
          console.log('✅ Mashup saved successfully:', data);
          
          const newMashup: Mashup = {
            id: data.id,
            seedId: seed.id,
            partnerId: partner.id,
            source,
            criteria,
            createdAt: new Date().toISOString(),
            seedTrack: seed,
            partnerTrack: partner
          };

          set(state => ({
            saved: [newMashup, ...state.saved]
          }));
          
          console.log('✅ Mashup added to saved list');
        } catch (error) {
          console.error('Save error:', error);
        }
      },

      removeMashup: (id) => {
        set(state => ({
          saved: state.saved.filter(m => m.id !== id)
        }));
      },

      updateMashupNote: (id, note) => {
        set(state => ({
          saved: state.saved.map(m => 
            m.id === id ? { ...m, note } : m
          )
        }));
      },

      updateMashupTags: (id, tags) => {
        set(state => ({
          saved: state.saved.map(m => 
            m.id === id ? { ...m, tags } : m
          )
        }));
      },

      setBpmPercent: (percent) => {
        const { seed } = get();
        console.log('setBpmPercent called with percent:', percent);
        console.log('Current seed:', seed);
        
        const seedBpm = seed?.audio?.bpm || seed?.bpm;
        console.log('Seed BPM found:', seedBpm);
        
        if (!seedBpm || typeof seedBpm !== 'number') {
          console.log('No valid BPM found, returning early');
          return;
        }
        
        const range = (seedBpm * percent) / 100;
        const min = Math.max(40, Math.round(seedBpm - range));
        const max = Math.min(300, Math.round(seedBpm + range));
        
        console.log(`Setting BPM range to [${min}, ${max}]`);
        
        set(state => ({
          criteria: { ...state.criteria, bpm: [min, max] }
        }));
      }
    }),
    {
      name: 'mashups-store-v1',
      partialize: (state) => ({
        seed: state.seed,
        source: state.source,
        selectedCollectionIds: state.selectedCollectionIds,
        selectedPlaylistIds: state.selectedPlaylistIds,
        criteria: state.criteria,
        results: state.results,
        total: state.total,
        offset: state.offset,
        saved: state.saved
      })
    }
  )
);
