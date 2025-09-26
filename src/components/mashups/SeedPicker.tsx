import React from 'react';
import { useLibraryStore } from '../../store/library';
import { useMashups, TrackRow } from '../../store/mashups';
import { apiFetch } from '../../lib/apiClient';

// Add Spotify search functionality
async function searchSpotify(query: string): Promise<any[]> {
  try {
    const response = await apiFetch(`/api/spotify/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    return data.tracks?.items || [];
  } catch (error) {
    console.error('Spotify search error:', error);
    return [];
  }
}

const colors = {
  text: "#E8EDFF",
  muted: "#96A0C2",
  muted2: "#6F7BA6",
  pillBorder: "#8A7CFF",
  pillBg: "rgba(138,124,255,0.12)",
  pillSolid: "#8A7CFF",
  pillSolidText: "#0B0F22",
  inputBg: "#0F1836",
  inputBorder: "#222C55",
};

const pillBase = "h-10 px-4 rounded-full border transition";
const pillDefault = `${pillBase} border-[#8A7CFF] bg-[rgba(138,124,255,0.12)] text-[#E8EDFF] hover:brightness-110`;

export default function SeedPicker() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [spotifyResults, setSpotifyResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const { seed, setSeed } = useMashups();
  const { libraryById, libraryOrder } = useLibraryStore();

  const libraryTracks = libraryOrder.map(id => libraryById[id]).filter(Boolean);

  const filteredTracks = libraryTracks.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist_primary_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Search Spotify when query changes
  React.useEffect(() => {
    if (searchQuery.trim() && searchQuery.length > 2) {
      setIsSearching(true);
      searchSpotify(searchQuery).then(results => {
        setSpotifyResults(results);
        setIsSearching(false);
      });
    } else {
      setSpotifyResults([]);
    }
  }, [searchQuery]);

  const handleSelectTrack = (track: any, source: 'library' | 'spotify') => {
    let trackRow: TrackRow;
    
    if (source === 'library') {
      trackRow = {
        id: track.spotify_id,
        name: track.name,
        artist: track.artist_primary_name,
        artistId: track.artist_primary_id,
        cover: track.cover_url,
        album: track.album_name,
        bpm: track.audio?.bpm || track.bpm, // Use enriched BPM data
        keyNum: track.key_num,
        mode: track.mode,
        keyStr: track.audio?.key || track.key_str, // Use enriched key data
        audio: track.audio, // Include the full audio object
        source: 'library' as const
      };
    } else {
      // Spotify track
      trackRow = {
        id: track.id,
        name: track.name,
        artist: track.artists?.[0]?.name || 'Unknown Artist',
        artistId: track.artists?.[0]?.id || '',
        cover: track.album?.images?.[0]?.url || '',
        album: track.album?.name || 'Unknown Album',
        bpm: 67, // Placeholder BPM
        keyNum: null,
        mode: null,
        keyStr: null,
        source: 'spotify' as const
      };
    }
    
    setSeed(trackRow);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={pillDefault}
        aria-label="Select seed track"
      >
        {seed ? (
          <div className="flex items-center gap-3">
            <img 
              src={seed.cover} 
              alt="" 
              className="h-7 w-7 rounded object-cover"
            />
            <div className="text-left">
              <div className="text-sm font-medium truncate max-w-[200px]">
                {seed.name}
              </div>
              <div className="text-xs opacity-75 truncate max-w-[200px]">
                {seed.artist}
              </div>
            </div>
          </div>
        ) : (
          "Choose seed"
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-96 max-h-96 overflow-hidden rounded-lg border shadow-lg z-50" style={{ background: colors.inputBg, borderColor: colors.inputBorder }}>
          {/* Search */}
          <div className="p-3 border-b" style={{ borderColor: colors.inputBorder }}>
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 px-3 rounded-md text-sm outline-none border"
              style={{ 
                background: colors.inputBg, 
                color: colors.text, 
                borderColor: colors.inputBorder 
              }}
              autoFocus
            />
          </div>

          {/* Track List */}
          <div className="max-h-80 overflow-y-auto">
            {/* Library Tracks */}
            {filteredTracks.length > 0 && (
              <div className="p-2 text-xs font-semibold" style={{ color: colors.muted2, borderBottom: `1px solid ${colors.inputBorder}` }}>
                Library
              </div>
            )}
            {filteredTracks.map((track) => (
              <button
                key={track.spotify_id}
                onClick={() => handleSelectTrack(track, 'library')}
                className="w-full p-3 flex items-center gap-3 hover:bg-opacity-10 hover:bg-white transition-colors"
              >
                <img 
                  src={track.cover_url} 
                  alt="" 
                  className="h-10 w-10 rounded object-cover"
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: colors.text }}>
                    {track.name}
                  </div>
                  <div className="text-xs truncate" style={{ color: colors.muted }}>
                    {track.artist_primary_name}
                  </div>
                </div>
                {(() => {
                  const bpm = track.audio?.bpm || track.bpm;
                  return bpm && bpm !== '-' && bpm !== '' && (
                    <div className="text-xs" style={{ color: colors.muted2 }}>
                      {typeof bpm === 'number' ? Math.round(bpm) : bpm} BPM
                    </div>
                  );
                })()}
              </button>
            ))}

            {/* Spotify Search Results */}
            {spotifyResults.length > 0 && (
              <div className="p-2 text-xs font-semibold" style={{ color: colors.muted2, borderBottom: `1px solid ${colors.inputBorder}` }}>
                Spotify Search
              </div>
            )}
            {isSearching && (
              <div className="p-4 text-center text-sm" style={{ color: colors.muted2 }}>
                Searching Spotify...
              </div>
            )}
            {spotifyResults.map((track) => (
              <button
                key={track.id}
                onClick={() => handleSelectTrack(track, 'spotify')}
                className="w-full p-3 flex items-center gap-3 hover:bg-opacity-10 hover:bg-white transition-colors"
              >
                <img 
                  src={track.album?.images?.[0]?.url || ''} 
                  alt="" 
                  className="h-10 w-10 rounded object-cover"
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: colors.text }}>
                    {track.name}
                  </div>
                  <div className="text-xs truncate" style={{ color: colors.muted }}>
                    {track.artists?.[0]?.name || 'Unknown Artist'}
                  </div>
                </div>
                <div className="text-xs" style={{ color: colors.muted2 }}>
                  67 BPM
                </div>
              </button>
            ))}

            {/* No Results */}
            {filteredTracks.length === 0 && spotifyResults.length === 0 && !isSearching && (
              <div className="p-4 text-center text-sm" style={{ color: colors.muted2 }}>
                {searchQuery ? 'No tracks found' : 'No tracks in library'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
