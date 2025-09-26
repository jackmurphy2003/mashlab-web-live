import React from "react";
import { useLibraryStore, TrackRow } from "./store/library";
import { apiFetch } from "./lib/apiClient";


const colors = {
  bg: "#0C1022",
  panel: "#0E1530",
  panelBorder: "#1A2348",
  rowHover: "#121A3A",
  text: "#E8EDFF",
  secondary: "#96A0C2",
  muted: "#6F7BA6",
  divider: "rgba(255,255,255,0.06)",
  inputBg: "#0F1836",
  inputBorder: "#222C55",
  placeholder: "#7E88AF",
  accent: "#8A7CFF",
  accentSoft: "rgba(138,124,255,0.12)",
  focusRing: "rgba(138,124,255,0.45)",
};

const pillBase = "h-10 px-4 rounded-full border transition";
const pillDefault = `${pillBase} border-[#8A7CFF] bg-[rgba(138,124,255,0.12)] text-[#E8EDFF] hover:brightness-110`;
const pillSolid = `${pillBase} border-[#8A7CFF] bg-[#8A7CFF] text-[#0B0F22]`;

// Removed unused fmtKey function



// Simple async queue to throttle to N concurrent jobs
function makeQueue(limit = 4) {
  let active = 0;
  const q: Array<() => Promise<void>> = [];
  const runNext = () => {
    if (active >= limit || q.length === 0) return;
    active++;
    const job = q.shift()!;
    job().finally(() => { active--; runNext(); });
  };
  return (job: () => Promise<void>) => { q.push(job); runNext(); };
}

const enrichmentQueue = makeQueue(4);

export default function SearchPage() {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [visibleCount, setVisibleCount] = React.useState(10);
  
  // Zustand store
  const { 
    searchQuery, 
    searchResults, 
    searchMembership, 
    setSearchResults,
    toggleLibrary 
  } = useLibraryStore();

  // Function to update individual rows in the search results
  const updateRow = React.useCallback((id: string, patch: Partial<TrackRow>) => {
    const currentResults = useLibraryStore.getState().searchResults;
    const updatedResults = currentResults.map(r => 
      (r.id === id || r.spotify_id === id) ? { ...r, ...patch, audio: { ...r.audio, ...patch.audio } } : r
    );
    // Convert searchMembership Record to string array
    const membershipArray = Object.keys(searchMembership).filter(id => searchMembership[id]);
    setSearchResults(q, updatedResults, membershipArray);
  }, [q, searchMembership, setSearchResults]);

  // Initialize query from store
  React.useEffect(() => {
    if (searchQuery) {
      setQ(searchQuery);
    }
  }, [searchQuery]);

  // Reset loading state on mount
  React.useEffect(() => {
    console.log('🚀 SearchPage mounted - ensuring loading state is false');
    setLoading(false);
  }, []);

  // Reset loading state on unmount or if loading gets stuck
  React.useEffect(() => {
    // Reset loading state on mount in case it's stuck from previous session
    if (loading) {
      console.log('🧹 Resetting stuck loading state on mount');
      setLoading(false);
    }
    
    return () => {
      if (loading) {
        console.log('🧹 Cleaning up loading state on unmount');
        setLoading(false);
      }
    };
  }, [loading]);

  const CAP = Math.min(searchResults.length, 50);
  const visibleRows = React.useMemo(() => searchResults.slice(0, visibleCount), [searchResults, visibleCount]);



  const handleSearch = async () => {
    console.log('🔍 Search triggered with query:', q);
    if (!q.trim()) {
      console.log('❌ Search blocked - empty query');
      return;
    }
    
    setLoading(true);
    console.log('🔄 Loading state set to true');
    
    try {
      console.log('📡 Fetching tracks from API...');
      
      // Get initial search results
      const searchUrl = `/api/deezer/search?q=${encodeURIComponent(q.trim())}&limit=25`;
      const res = await apiFetch(searchUrl);
      if (!res.ok) throw new Error(`Deezer search failed: ${res.status}`);
      const data = await res.json();
      
      // Normalize to TrackRow format
      const rows: TrackRow[] = (data.items || []).map((x: any) => ({
        id: x.id,
        spotify_id: x.id, // Keep for backward compatibility
        name: x.title || x.name,
        title: x.title || x.name,
        artist: x.artist || x.artist_primary_name,
        artists: x.artist_id ? [{ id: x.artist_id, name: x.artist || x.artist_primary_name }] : [],
        artist_primary_id: x.artist_id || x.artists?.[0]?.id,
        artist_primary_name: x.artist || x.artist_primary_name || x.artists?.[0]?.name || "",
        album_id: x.album_id || '',
        album_name: x.album || x.album_name || '',
        album: x.album || x.album_name || '',
        cover_url: x.album_art || x.cover_url || '',
        album_art: x.album_art || x.cover_url || '',
        audio: x.audio ?? { bpm: null, key: null },
        duration_sec: x.duration_sec || null,
        preview_url: x.preview_url || null,
        source: x.source || 'deezer',
        genres: x.genres || []
      }));

      console.log('📊 Initial rows processed:', rows.length);
      
      // Get membership status
      const presentIds = rows
        .map(r => r.spotify_id)
        .filter(id => useLibraryStore.getState().isInLibrary(id));

      // Store initial results in Zustand
      setSearchResults(q, rows, presentIds);
      setVisibleCount(Math.min(10, Math.min(rows.length, 50)));
      
      // Post-search enrichment: batch process tracks missing BPM
      rows.forEach(row => {
        enrichmentQueue(async () => {
          // 1) Try track details first (sometimes includes bpm)
          if (!row.audio?.bpm && row.id) {
            try {
              const r1 = await apiFetch(`/api/deezer/track/${row.id}`);
              if (r1.ok) {
                const full = await r1.json();
                if (full?.audio?.bpm) {
                  console.log(`✅ Track details found BPM for ${row.title}: ${full.audio.bpm}`);
                  updateRow(row.id, {
                    audio: { bpm: full.audio.bpm, key: full.audio.key ?? null },
                    metaSource: "deezer",
                    duration_sec: full.duration_sec ?? row.duration_sec,
                    preview_url: full.preview_url ?? row.preview_url,
                  });
                  return; // stop here if we got BPM
                }
              }
            } catch (error) {
              console.log(`⚠️ Track details failed for ${row.title}:`, error);
            }
          }
          
          // 2) Fallback: enrichment pipeline
          if (!row.audio?.bpm && row.id) {
            try {
              const r2 = await apiFetch(`/api/meta/enrich/${row.id}`);
              if (r2.ok) {
                const meta = await r2.json();
                if (meta?.bpm || meta?.key) {
                  console.log(`✅ Enrichment found data for ${row.title}: BPM=${meta.bpm}, Key=${meta.key}, Source=${meta.source}`);
                  updateRow(row.id, {
                    audio: { bpm: meta.bpm ?? null, key: meta.key ?? null },
                    metaSource: meta.source,
                    metaConfidence: meta.confidence,
                  });
                }
              }
            } catch (error) {
              console.log(`⚠️ Enrichment failed for ${row.title}:`, error);
            }
          }

          // 3) Genre enrichment (always try to get genres)
          if (row.id && (!row.genres || row.genres.length === 0)) {
            try {
              const r3 = await apiFetch(`/api/meta/genre/${row.id}`);
              if (r3.ok) {
                const genreData = await r3.json();
                if (genreData?.genres && genreData.genres.length > 0) {
                  console.log(`✅ Genre enrichment found for ${row.title}: ${genreData.genres.join(', ')}`);
                  updateRow(row.id, {
                    genres: genreData.genres,
                  });
                }
              }
            } catch (error) {
              console.log(`⚠️ Genre enrichment failed for ${row.title}:`, error);
            }
          }
        });
      });
      
      console.log('✅ Search completed with', rows.length, 'results, enrichment queued');
    } catch (error) {
      console.error('❌ Search error:', error);
      // Show empty results on error
      setSearchResults(q, [], []);
      setVisibleCount(0);
    } finally {
      console.log('🔄 Resetting loading state');
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1280px] px-6 py-8">
      {/* Card */}
      <section className="rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.25)] p-6" style={{ background: colors.panel, borderColor: colors.panelBorder }}>
        {/* Search bar with pill button */}
        <div className="mb-5 flex gap-3">
          <input 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search for a track..." 
            className="flex-1 h-12 rounded-[12px] px-4 text-[16px] outline-none border focus:ring-4" 
            style={{ 
              background: colors.inputBg, 
              color: colors.text, 
              borderColor: colors.inputBorder, 
              boxShadow: "none" 
            }}
            onFocus={(e) => (e.currentTarget.style.boxShadow = `0 0 0 4px ${colors.focusRing}`)}
            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
          />
          <button 
            className={pillDefault} 
            disabled={!q.trim()} 
            onClick={handleSearch}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {/* Table header */}
        <div className="grid py-3 text-[13px] font-semibold border-b" style={{ gridTemplateColumns: "48px 1.8fr 1.2fr 0.8fr 0.8fr 0.8fr 170px", color: colors.muted, borderColor: colors.divider }}>
          <div>#</div>
          <div>Track</div>
          <div>Artist</div>
          <div>BPM</div>
          <div>Key</div>
          <div>Source</div>
          <div></div>
        </div>

        {/* Rows */}
        <ul className="divide-y" style={{ borderColor: colors.divider }}>
          {visibleRows.map((r, index) => (
            <li key={r.id || r.spotify_id} className="grid items-center px-2" style={{ gridTemplateColumns: "48px 1.8fr 1.2fr 0.8fr 0.8fr 0.8fr 170px", height: "72px" }}>
              <div className="text-[13px] font-semibold" style={{ color: colors.muted }}>{index + 1}</div>
              <div className="flex items-center gap-3">
                <img src={r.album_art || r.cover_url || '/placeholder-album.png'} alt="" className="h-11 w-11 rounded-[10px] object-cover" />
                <div>
                  <div className="text-[16px] font-semibold" style={{ color: colors.text }}>{r.title || r.name}</div>
                  <div className="text-[13px] font-medium" style={{ color: colors.secondary }}>{r.album || r.album_name}</div>
                </div>
              </div>
              <div className="text-[14px] font-medium" style={{ color: colors.text }}>{r.artist || r.artist_primary_name}</div>
              <div className="text-[14px] font-medium" style={{ color: colors.text }}>
                {(() => {
                  const bpm = r.audio?.bpm;
                  if (bpm && typeof bpm === 'number') {
                    return Math.round(bpm);
                  }
                  return "—";
                })()}
              </div>
              <div className="text-[14px] font-medium" style={{ color: colors.text }}>
                {r.audio?.key || "—"}
              </div>
              <div className="text-[14px] font-medium flex items-center" style={{ color: colors.text }}>
                {(() => {
                  const source = r.metaSource || 'deezer';
                  
                  // Color coding based on source
                  let sourceColor = colors.secondary; // default
                  let displayText = source;
                  
                  switch (source) {
                    case 'deezer':
                      sourceColor = colors.text;
                      displayText = 'Deezer';
                      break;
                    case 'placeholder':
                      sourceColor = '#F59E0B'; // amber
                      displayText = 'Placeholder';
                      break;
                    case 'getsongbpm':
                      sourceColor = '#3B82F6'; // blue
                      displayText = 'GetSongBPM';
                      break;
                    case 'analysis_preview':
                      sourceColor = '#10B981'; // green
                      displayText = 'AI Analysis';
                      break;
                    case 'User Input':
                      sourceColor = '#8B5CF6'; // purple
                      displayText = 'User Input';
                      break;
                    default:
                      displayText = source;
                  }
                  
                  return (
                    <span style={{ color: sourceColor }}>
                      {displayText}
                    </span>
                  );
                })()}
              </div>
              <div className="flex justify-end">
                <button 
                  className={searchMembership[r.id || r.spotify_id] ? pillSolid : pillDefault}
                  onClick={() => toggleLibrary(r)}
                >
                  {searchMembership[r.id || r.spotify_id] ? "Added" : "Add to Library"}
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Show More */}
        {visibleCount < CAP && (
          <div className="flex justify-center py-6">
            <button 
              className={pillDefault}
              onClick={() => setVisibleCount(c => Math.min(c + 10, CAP))}
            >
              Show More
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// Removed old search functions - now using post-search enrichment with batching
