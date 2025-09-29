import React from 'react';
import { useMashups } from './store/mashups';
import { useLibraryStore } from './store/library';
import FilterRail from './components/mashups/FilterRail';
import ResultsTable from './components/mashups/ResultsTable';
import SavedList from './components/mashups/SavedList';
import ControlBar from './components/mashups/ControlBar';

const colors = {
  bgPanel: "#0E1530",
  bgHover: "#121A3A",
  border: "#1A2348",
  text: "#E8EDFF",
  muted: "#96A0C2",
  muted2: "#6F7BA6",
  pillBorder: "#8A7CFF",
  pillBg: "rgba(138,124,255,0.12)",
  pillSolid: "#8A7CFF",
  pillSolidText: "#0B0F22",
  divider: "rgba(255,255,255,0.08)"
};

export default function MashupsPage() {
  const [activeTab, setActiveTab] = React.useState<'build' | 'saved'>('build');
  const savedCount = useMashups((s) => s.saved.length);
  const { syncWithServer } = useLibraryStore();

  // Sync library with server on mount
  React.useEffect(() => {
    syncWithServer();
  }, [syncWithServer]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Internal Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg h-11" style={{ background: colors.border }}>
        <button
          onClick={() => setActiveTab('build')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'build'
              ? 'text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          style={{
            background: activeTab === 'build' ? colors.pillSolid : 'transparent'
          }}
        >
          Build
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'saved'
              ? 'text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          style={{
            background: activeTab === 'saved' ? colors.pillSolid : 'transparent'
          }}
        >
          Saved ({savedCount})
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'build' ? (
        <BuildTab onTabChange={setActiveTab} />
      ) : (
        <SavedTab />
      )}
    </div>
  );
}

function BuildTab({ onTabChange }: { onTabChange: (tab: 'build' | 'saved') => void }) {
  const { seed, saved } = useMashups();
  
  return (
    <div className="flex flex-col gap-6">
      {/* Control Bar */}
      <ControlBar onTabChange={onTabChange} />

      {/* Two-Pane Body */}
      {seed && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6 items-start">
          {/* Left Filter Rail */}
          <FilterRail />
          
          {/* Right Results Panel */}
          <div className="rounded-2xl border overflow-hidden" style={{ background: colors.bgPanel, borderColor: colors.border }}>
            <ResultsTable />
          </div>
        </div>
      )}

      {/* Saved Mashups Section */}
      {saved.length > 0 && (
        <div className="rounded-2xl border px-4 md:px-6 py-4" style={{ background: colors.bgPanel, borderColor: colors.border }}>
          <div className="text-[18px] font-semibold mb-3" style={{ color: colors.text }}>
            Saved Mashups
          </div>
          <SavedList />
        </div>
      )}
    </div>
  );
}

function SavedTab() {
  return (
    <div className="rounded-2xl border px-4 md:px-6 py-4" style={{ background: colors.bgPanel, borderColor: colors.border }}>
      <SavedList />
    </div>
  );
}
