import React from "react";
import { useLibraryStore } from "./store/library";
import { Popover } from "./components/Popover";
import CollectionCover from "./components/CollectionCover";
import EditableBpm from "./components/EditableBpm";

// Design tokens from JSON spec
const colors = {
  bg: "#0C1022",
  panel: "#0E1530",
  panelBorder: "#1A2348",
  divider: "rgba(255,255,255,0.08)",
  rowHover: "#121A3A",
  text: "#E8EDFF",
  secondary: "#96A0C2",
  muted: "#6F7BA6",
  accent: "#8A7CFF",
  accentSoft: "rgba(138,124,255,0.12)",
  focusRing: "rgba(138,124,255,0.45)",
  danger: "#FF5C5C",
  success: "#2BD576",
  badge: "#0B1432"
};



// Grid template for consistent column widths
// order:  # | Track | Artist | BPM | Key | Genre | Select
const GRID = "grid-cols-[56px_2.0fr_1.4fr_0.8fr_0.8fr_0.8fr_0.8fr_1.0fr_64px]";

function CollectionModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { collections, libraryById, updateCollectionCover } = useLibraryStore();
  const c = collections[id];
  const [showUpload, setShowUpload] = React.useState(false);
  
  if (!c) return null;

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          updateCollectionCover(id, result);
          setShowUpload(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCover = () => {
    updateCollectionCover(id, '');
    setShowUpload(false);
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="w-[780px] max-w-[90vw] max-h-[80vh] overflow-auto rounded-2xl border p-6 bg-[#0E1530] border-[#1A2348]">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white text-lg font-semibold">{c.name}</div>
          <button className="text-[#96A0C2]" onClick={onClose}>Close</button>
        </div>
        
        {/* Collection Cover Section */}
        <div className="mb-6 p-4 rounded-lg border border-[#1A2348]">
          <div className="flex items-center gap-4">
            <CollectionCover collectionId={id} size="large" />
            <div className="flex-1">
              <div className="text-white text-sm font-medium mb-1">Collection Cover</div>
              <div className="text-[#96A0C2] text-xs mb-2">
                {c.coverImage && c.coverImage.trim() !== '' ? 'Custom cover image' : 'Auto-generated from first 4 tracks'}
              </div>
              <div className="flex gap-2">
                {!showUpload ? (
                  <>
                    <button
                      onClick={() => setShowUpload(true)}
                      className="px-3 py-1 text-xs bg-[#8A7CFF] text-white rounded-md hover:bg-[#7A6CFF] transition-colors"
                    >
                      Upload Custom
                    </button>
                    {c.coverImage && c.coverImage.trim() !== '' && (
                      <button
                        onClick={handleRemoveCover}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="cover-upload"
                    />
                    <label
                      htmlFor="cover-upload"
                      className="px-3 py-1 text-xs bg-[#8A7CFF] text-white rounded-md hover:bg-[#7A6CFF] transition-colors cursor-pointer"
                    >
                      Choose File
                    </label>
                    <button
                      onClick={() => setShowUpload(false)}
                      className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <ul className="divide-y divide-white/10">
          {c.trackIds.map(tid => {
            const t = libraryById[tid];
            if (!t) return null;
            return (
              <li key={tid} className="flex items-center gap-3 py-3">
                <img src={t.cover_url} alt="" className="h-10 w-10 rounded-[10px] object-cover" />
                <div className="text-white font-semibold">{t.name}</div>
                <div className="ml-auto text-[#96A0C2] text-sm">{t.artist_primary_name}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function LibraryTable() {
  const { libraryById, libraryOrder, collections, addToCollections, createCollection } = useLibraryStore();
  const [visibleCount, setVisibleCount] = React.useState(25);
  
  // Multi-select state
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  
  // Sorting state
  const [sortField, setSortField] = React.useState<string>('');
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>('asc');
  
  // Header menu state
  const [headerAnchor, setHeaderAnchor] = React.useState<HTMLElement | null>(null);
  const [showCollections, setShowCollections] = React.useState(false);
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});
  const [newName, setNewName] = React.useState("");

  // Get tracks from store
  const tracks = libraryOrder.map(id => libraryById[id]).filter(Boolean);

  // Computed values
  const visibleTracks = tracks.slice(0, visibleCount);
  const hasMore = visibleCount < tracks.length;
  const visibleIds = visibleTracks.map(t => t.spotify_id);
  const allChecked = visibleIds.length > 0 && visibleIds.every(id => selected[id]);
  const selectedIds = React.useMemo(
    () => Object.keys(selected).filter(id => selected[id]),
    [selected]
  );

  // Sorting logic
  const sortedTracks = React.useMemo(() => {
    if (!sortField) return visibleTracks;
    
    return [...visibleTracks].sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'track':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'artist':
          aValue = a.artist_primary_name?.toLowerCase() || '';
          bValue = b.artist_primary_name?.toLowerCase() || '';
          break;
        case 'bpm':
          aValue = typeof a.audio?.bpm === 'number' ? a.audio.bpm : (typeof a.bpm === 'number' ? a.bpm : 0);
          bValue = typeof b.audio?.bpm === 'number' ? b.audio.bpm : (typeof b.bpm === 'number' ? b.bpm : 0);
          break;
        case 'key':
          aValue = a.audio?.key || a.key_str || '';
          bValue = b.audio?.key || b.key_str || '';
          break;
        case 'source':
          aValue = a.metaSource || 'deezer';
          bValue = b.metaSource || 'deezer';
          break;
        case 'genre':
          aValue = a.genres?.join(', ') || '';
          bValue = b.genres?.join(', ') || '';
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [visibleTracks, sortField, sortDirection]);

  // Sorting handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Event handlers
  const onShowMore = async () => {
    setVisibleCount(prev => Math.min(prev + 25, tracks.length));
  };

  // Selection handlers
  const toggleRow = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));
  const toggleAll = (checked: boolean) =>
    setSelected(s => {
      const next = { ...s };
      visibleIds.forEach(id => (next[id] = checked));
      return next;
    });
  const clearSelection = () => setSelected({});

  // Header menu handlers
  function openHeaderMenu(el: HTMLElement) {
    setHeaderAnchor(el);
    setShowCollections(false);
    // reset menu state
    const init: Record<string, boolean> = {};
    Object.values(collections).forEach(c => (init[c.id] = false));
    setChecks(init);
  }

  function applyAddToCollections() {
    const chosen = Object.keys(checks).filter(id => checks[id]);
    selectedIds.forEach(id => addToCollections(id, chosen));
    closeMenu();
  }

  function closeMenu() {
    setHeaderAnchor(null);
    setShowCollections(false);
    setNewName("");
  }

  function bulkDelete() {
    // Delete selected tracks from library
    const { toggleLibrary } = useLibraryStore.getState();
    selectedIds.forEach(id => {
      const track = libraryById[id];
      if (track) {
        toggleLibrary(track);
      }
    });
    clearSelection();
  }

  return (
    <section className="rounded-2xl border shadow-[0_8px_24px_rgba(0,0,0,0.25)] px-5 md:px-8 pt-5 pb-4 overflow-auto" style={{ background: colors.panel, borderColor: colors.panelBorder, scrollbarGutter: "stable both-edges" }}>
      {/* Header */}
      <div className="pb-4 border-b" style={{ borderColor: colors.divider }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: colors.text }}>Library</h1>
            <p className="text-sm" style={{ color: colors.muted }}>{tracks.length} tracks</p>
          </div>
          <button
            aria-label="Actions"
            className="h-9 w-9 rounded-full border border-[#8A7CFF] bg-[rgba(138,124,255,0.12)] text-[#E8EDFF] text-[18px] leading-none hover:brightness-110 disabled:opacity-50"
            onClick={(e) => openHeaderMenu(e.currentTarget)}
            disabled={selectedIds.length === 0}
          >
            +
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="relative">
        <div 
          className={`grid ${GRID} py-3 border-b pr-2 sticky top-0 z-10`}
          style={{ 
            borderColor: colors.divider,
            background: colors.panel
          }}
        >
          <div className="text-[#6F7BA6] font-semibold text-[13px]">#</div>
          <button 
            className="text-[#6F7BA6] font-semibold text-[13px] hover:text-[#8A7CFF] transition-colors text-left flex items-center gap-1"
            onClick={() => handleSort('track')}
          >
            Track {sortField === 'track' ? (sortDirection === 'asc' ? '▲' : '▼') : '◆'}
          </button>
          <button 
            className="text-[#6F7BA6] font-semibold text-[13px] hover:text-[#8A7CFF] transition-colors text-left flex items-center gap-1"
            onClick={() => handleSort('artist')}
          >
            Artist {sortField === 'artist' ? (sortDirection === 'asc' ? '▲' : '▼') : '◆'}
          </button>
          <button 
            className="text-[#6F7BA6] font-semibold text-[13px] hover:text-[#8A7CFF] transition-colors text-left flex items-center gap-1"
            onClick={() => handleSort('bpm')}
          >
            BPM {sortField === 'bpm' ? (sortDirection === 'asc' ? '▲' : '▼') : '◆'}
          </button>
          <button 
            className="text-[#6F7BA6] font-semibold text-[13px] hover:text-[#8A7CFF] transition-colors text-left flex items-center gap-1"
            onClick={() => handleSort('key')}
          >
            Key {sortField === 'key' ? (sortDirection === 'asc' ? '▲' : '▼') : '◆'}
          </button>
          <button 
            className="text-[#6F7BA6] font-semibold text-[13px] hover:text-[#8A7CFF] transition-colors text-left flex items-center gap-1"
            onClick={() => handleSort('source')}
          >
            Source {sortField === 'source' ? (sortDirection === 'asc' ? '▲' : '▼') : '◆'}
          </button>
          <button 
            className="text-[#6F7BA6] font-semibold text-[13px] hover:text-[#8A7CFF] transition-colors text-left flex items-center gap-1"
            onClick={() => handleSort('genre')}
          >
            Genre {sortField === 'genre' ? (sortDirection === 'asc' ? '▲' : '▼') : '◆'}
          </button>

          {/* Select-all checkbox */}
          <div className="flex justify-end pr-1">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={(e) => toggleAll(e.target.checked)}
              aria-label="Select all"
              className="w-4 h-4 rounded border-2"
              style={{ borderColor: colors.accent }}
            />
          </div>
        </div>

        {/* Table Body */}
        <div className="max-h-[60vh] overflow-y-auto">
          <ul className="divide-y" style={{ borderColor: colors.divider }}>
            {sortedTracks.map((track, index) => (
              <li 
                key={track.spotify_id}
                className={`grid ${GRID} items-center px-2 hover:bg-[#121A3A] rounded-md`}
                style={{ height: 68 }}
              >
                {/* # */}
                <div className="text-[13px] font-semibold text-[#6F7BA6]">{index + 1}</div>

                {/* Track */}
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={track.cover_url || "https://placehold.co/88x88/png"} 
                    className="h-10 w-10 rounded-[10px] object-cover" 
                    alt="" 
                  />
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-[16px] truncate">{track.name}</div>
                    <div className="text-[13px] font-medium text-[#96A0C2] truncate">{track.album_name}</div>
                  </div>
                </div>

                {/* Artist */}
                <div className="text-white text-[14px] font-medium truncate">{track.artist_primary_name}</div>

                {/* BPM */}
                <EditableBpm track={track} />

                {/* Key */}
                <div className="text-white text-[14px] font-medium">
                  {track.audio?.key || track.key_str || "—"}
                </div>

                {/* Source */}
                <div className="text-[14px] font-medium">
                  {(() => {
                    const source = track.metaSource || 'deezer';

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

                {/* narrower Genre */}
                <div className="text-white text-[14px] font-medium truncate">
                  {track.genres?.length ? track.genres.slice(0, 2).join(", ") + (track.genres.length > 2 ? ` +${track.genres.length - 2}` : "") : "—"}
                </div>

                {/* Select checkbox with inner padding so it's not on the edge */}
                <div className="flex justify-end pr-1">
                  <input
                    type="checkbox"
                    checked={!!selected[track.spotify_id]}
                    onChange={() => toggleRow(track.spotify_id)}
                    aria-label={`Select ${track.name}`}
                    className="w-4 h-4 rounded border-2"
                    style={{ borderColor: colors.accent }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Show More */}
        {hasMore && (
          <div className="flex justify-center py-6">
            <button 
              className="h-10 px-4 rounded-full border transition border-[#8A7CFF] bg-[rgba(138,124,255,0.12)] text-[#E8EDFF] hover:brightness-110"
              onClick={onShowMore}
            >
              Show More
            </button>
          </div>
        )}
      </div>

      {/* Header Menu Popover */}
      <Popover anchorEl={headerAnchor} onClose={closeMenu}>
        {!showCollections ? (
          <div className="min-w-[240px]">
            <button
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#121A3A] text-white"
              onClick={() => setShowCollections(true)}
            >
              Add to Collection…
            </button>

            <button
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#121A3A] text-white disabled:opacity-50"
              onClick={() => { /* remove from active collection context */ closeMenu(); }}
              disabled={true} /* wire if you have collection context */
            >
              Remove from Collection
            </button>

            <div className="border-t my-2 border-white/10" />

            <button
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-200"
              onClick={() => { bulkDelete(); closeMenu(); }}
            >
              Delete from Library
            </button>
          </div>
        ) : (
          <div className="w-[300px]">
            <div className="px-2 py-1 text-[12px] text-[#6F7BA6]">Add selected to collections</div>
            <div className="max-h-[240px] overflow-auto">
              {Object.values(collections).map(c => (
                <label key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#121A3A]">
                  <input
                    type="checkbox"
                    checked={!!checks[c.id]}
                    onChange={(e) => setChecks(s => ({ ...s, [c.id]: e.target.checked }))}
                  />
                  <span className="text-white text-[14px]">{c.name}</span>
                  <span className="ml-auto text-[12px] text-[#6F7BA6]">{c.trackIds.length}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 border-t border-white/10" />
            <div className="flex gap-2 p-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New collection name"
                className="flex-1 h-9 rounded-[10px] px-3 text-[14px] outline-none border bg-[#0F1836] border-[#222C55] text-[#E8EDFF]"
              />
              <button
                className="h-9 px-3 rounded-full border border-[#8A7CFF] bg-[rgba(138,124,255,0.12)] text-[#E8EDFF]"
                onClick={() => { 
                  if (!newName.trim()) return; 
                  const id = createCollection(newName.trim()); 
                  setChecks(s => ({ ...s, [id]: true })); 
                  setNewName(""); 
                }}
              >
                Create
              </button>
            </div>
            <div className="flex justify-end p-2 pt-0">
              <button
                className="h-9 px-3 rounded-full border border-[#8A7CFF] bg-[#8A7CFF] text-[#0B0F22]"
                onClick={applyAddToCollections}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </Popover>
    </section>
  );
}

function CollectionsGrid({ className = "" }: { className?: string }) {
  const { collections } = useLibraryStore();
  const [selectedCollection, setSelectedCollection] = React.useState<string | null>(null);

  // Collections grid shows actual counts
  const collectionCards = Object.values(collections).map(c => ({
    ...c,
    count: c.trackIds.length
  }));

  return (
    <section className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold" style={{ color: colors.text }}>Collections</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {collectionCards.map(collection => (
          <div
            key={collection.id}
            className="rounded-xl border cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg aspect-square relative overflow-hidden"
            style={{ borderColor: colors.panelBorder }}
            onClick={() => setSelectedCollection(collection.id)}
          >
            {/* Cover photo fills entire square */}
            <div className="absolute inset-0">
              <CollectionCover collectionId={collection.id} size="full" />
            </div>
            
            {/* Dark overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/40" />
            
            {/* Collection title in top left */}
            <div className="absolute top-3 left-3 z-10">
              <h3 
                className="font-bold text-base leading-tight" 
                style={{ color: colors.text }}
              >
                {collection.name}
              </h3>
            </div>
            
            {/* Track count in top right */}
            <div className="absolute top-3 right-3 z-10">
              <span 
                className="text-xs font-medium px-1.5 py-0.5 rounded" 
                style={{ 
                  color: colors.text,
                  background: 'rgba(0,0,0,0.6)'
                }}
              >
                {collection.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Collection Modal */}
      {selectedCollection && (
        <CollectionModal 
          id={selectedCollection} 
          onClose={() => setSelectedCollection(null)} 
        />
      )}
    </section>
  );
}

export default function LibraryPage() {
  return (
    <div className="w-full">
      {/* 1) Library card (table) */}
      <LibraryTable />

      {/* 2) Collections grid */}
      <CollectionsGrid className="mt-8" />
    </div>
  );
}
