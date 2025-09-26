import React, { useEffect, useState, useCallback } from 'react';
import { useCopilotLab } from '../../state/copilotLab';
import { getCopilotConfig, getSeeds, getRecommendations, saveMashupSession, exportCSV } from '../../lib/spotifyCoPilot';
import { apiFetch } from '../../lib/apiClient';

const colors = {
  bg: "#0c1020",
  surface: "#141a33",
  accentPrimary: "#7aa7ff",
  accentSecondary: "#9a6bff",
  text: "#E8EEFF",
  muted: "#9AA6C3",
  border: "rgba(255,255,255,0.1)",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444"
};

interface CoPilotConfig {
  unauthenticated: {
    headline: string;
    bullets: string[];
    cta: {
      label: string;
      action: string;
    };
  };
  panels: {
    left: any[];
    middle: any[];
    right: any[];
  };
  layout?: {
    columns: Array<{ id: string; width: string }>;
  };
}

export default function CoPilotLab() {
  console.log('🚀 CoPilotLab component rendering...');
  
  const [config, setConfig] = useState<CoPilotConfig | null>(null);
  
  const {
    auth,
    seed,
    settings,
    filters,
    results,
    queue,
    loading,
    error,
    setAuth,
    setSeed,
    setSettings,
    setFilters,
    setResults,
    addToQueue,
    removeFromQueue,
    moveQueueItem,
    setLoading,
    setError,
    reset
  } = useCopilotLab();
  
  // Debug info (always render, but show debug view when needed)
  const showDebugView = true;
  
  const [seedQuery, setSeedQuery] = useState('');
  const [selectedSeedType, setSelectedSeedType] = useState<'track' | 'playlist' | 'artist'>('track');
  const [seedSuggestions, setSeedSuggestions] = useState<any[]>([]);
  
  // Load config on mount
  useEffect(() => {
    getCopilotConfig().then(setConfig).catch(console.error);
  }, []);

  // Check for existing auth status
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await apiFetch('/api/auth/spotify/status');
        const data = await response.json();
        setAuth({ accessToken: data.authenticated ? 'authenticated' : null });
      } catch (error) {
        console.error('Failed to check auth status:', error);
        setAuth({ accessToken: null });
      }
    };
    
    checkAuthStatus();
  }, [setAuth]);

  // Handle seed search
  const handleSeedSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSeedSuggestions([]);
      return;
    }
    
    try {
      const seeds = await getSeeds(query, selectedSeedType);
      setSeedSuggestions(seeds);
    } catch (error) {
      console.error('Seed search failed:', error);
      setError('Failed to search for seeds');
    }
  }, [selectedSeedType, setError]);

  // Handle generate recommendations
  const handleGenerate = useCallback(async () => {
    if (!seed) {
      setError('Please select a seed first');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const { results: newResults } = await getRecommendations({
        seed,
        settings,
        filters
      });
      
      setResults(newResults);
    } catch (error) {
      console.error('Generate failed:', error);
      setError('Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  }, [seed, settings, filters, setResults, setLoading, setError]);

  // Handle save session
  const handleSaveSession = useCallback(async () => {
    if (!seed || results.length === 0) {
      setError('Nothing to save');
      return;
    }

    try {
      const { success } = await saveMashupSession({
        seed,
        settings,
        results,
        queue
      });
      
      if (success) {
        console.log('✅ Session saved successfully');
      }
    } catch (error) {
      console.error('Save failed:', error);
      setError('Failed to save session');
    }
  }, [seed, settings, results, queue, setError]);

  // Handle export CSV
  const handleExportCSV = useCallback(async () => {
    if (results.length === 0) {
      setError('No results to export');
      return;
    }

    try {
      const { success, url } = await exportCSV({
        seed: seed!,
        results,
        queue
      });
      
      if (success && url) {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'copilot-results.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setError('Failed to export CSV');
    }
  }, [seed, results, queue, setError]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            handleSaveSession();
            break;
        }
      } else {
        switch (e.key) {
          case 'g':
            e.preventDefault();
            handleGenerate();
            break;
          case ' ':
            e.preventDefault();
            // Toggle preview on focused row (placeholder for now)
            console.log('Space pressed - toggle preview');
            break;
          case 'a':
            e.preventDefault();
            // Add focused row to queue (placeholder for now)
            console.log('A pressed - add to queue');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleGenerate, handleSaveSession]);
  
  console.log('🔍 CoPilotLab state:', { auth, config: !!config, loading, error });

  // Show debug view if enabled
  if (showDebugView) {
    return (
      <div style={{ 
        backgroundColor: colors.bg, 
        color: colors.text, 
        padding: '2rem',
        minHeight: '400px',
        border: '2px solid red' // Debug border
      }}>
        <h1 style={{ color: colors.accentPrimary, marginBottom: '1rem' }}>
          🚀 Co-Pilot (Lab Mode) - Component is Loading!
        </h1>
        <p style={{ color: colors.muted }}>
          This is a temporary debug view. The component is rendering correctly.
        </p>
        <p style={{ color: colors.muted }}>
          Auth status: {auth.accessToken ? 'Authenticated' : 'Not authenticated'}
        </p>
        <p style={{ color: colors.muted }}>
          Config loaded: {config ? 'Yes' : 'No'}
        </p>
      </div>
    );
  }

  // Unauthenticated state
  if (!auth.accessToken) {
    if (!config) return <div className="flex items-center justify-center h-screen" style={{ backgroundColor: colors.bg }}>
      <div style={{ color: colors.muted }}>Loading Co-Pilot configuration...</div>
    </div>;

    return (
      <div 
        className="flex items-center justify-center min-h-screen p-8"
        style={{ backgroundColor: colors.bg }}
      >
        <div 
          className="max-w-md text-center space-y-8"
          style={{ backgroundColor: colors.surface, padding: '3rem', borderRadius: '1rem', border: `1px solid ${colors.border}` }}
        >
          <div className="space-y-4">
            <h1 
              className="text-3xl font-bold"
              style={{ color: colors.text }}
            >
              {config.unauthenticated.headline}
            </h1>
            
            <ul className="space-y-3 text-left">
              {config.unauthenticated.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start space-x-3">
                  <span 
                    className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                    style={{ backgroundColor: colors.accentPrimary }}
                  />
                  <span style={{ color: colors.muted }}>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <button
            onClick={async () => {
              try {
                const response = await apiFetch('/api/auth/spotify/login');
                const data = await response.json();
                window.location.href = data.authUrl;
              } catch (error) {
                console.error('Login failed:', error);
                setError('Failed to initiate login');
              }
            }}
            className="w-full py-3 px-6 rounded-lg font-semibold transition-colors"
            style={{ 
              backgroundColor: colors.accentPrimary, 
              color: '#000',
              border: 'none'
            }}
          >
            {config.unauthenticated.cta.label}
          </button>
        </div>
      </div>
    );
  }

  // Authenticated state - 3-column layout
  return (
    <div 
      className="flex h-screen"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Left Column - Inputs */}
      <div 
        className="w-1/4 border-r overflow-y-auto"
        style={{ 
          backgroundColor: colors.surface,
          borderColor: colors.border
        }}
      >
        <div className="p-6 space-y-6">
          {/* Seed Selector */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>Seed</h3>
            
            <div className="space-y-3">
              <select
                value={selectedSeedType}
                onChange={(e) => setSelectedSeedType(e.target.value as any)}
                className="w-full p-2 rounded border text-sm"
                style={{ 
                  backgroundColor: 'rgba(255,255,255,0.1)', 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
              >
                <option value="track">Track</option>
                <option value="playlist">Playlist</option>
                <option value="artist">Artist</option>
              </select>
              
              <input
                type="text"
                placeholder={`Search ${selectedSeedType}...`}
                value={seedQuery}
                onChange={(e) => {
                  setSeedQuery(e.target.value);
                  handleSeedSearch(e.target.value);
                }}
                className="w-full p-2 rounded border text-sm"
                style={{ 
                  backgroundColor: 'rgba(255,255,255,0.1)', 
                  borderColor: colors.border, 
                  color: colors.text 
                }}
              />
              
              {/* Seed Suggestions */}
              {seedSuggestions.length > 0 && (
                <div className="space-y-2">
                  {seedSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => {
                        setSeed(suggestion);
                        setSeedSuggestions([]);
                        setSeedQuery(suggestion.name);
                      }}
                      className="w-full p-3 rounded border text-left hover:bg-opacity-20 transition-colors"
                      style={{ 
                        backgroundColor: 'rgba(255,255,255,0.05)', 
                        borderColor: colors.border, 
                        color: colors.text 
                      }}
                    >
                      <div className="font-medium">{suggestion.name}</div>
                      <div className="text-xs" style={{ color: colors.muted }}>
                        {suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Blend Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold" style={{ color: colors.text }}>Blend Settings</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: colors.muted }}>
                  BPM Range: {settings.bpmRange[0]} - {settings.bpmRange[1]}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="range"
                    min="60"
                    max="200"
                    value={settings.bpmRange[0]}
                    onChange={(e) => setSettings({ bpmRange: [parseInt(e.target.value), settings.bpmRange[1]] })}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="60"
                    max="200"
                    value={settings.bpmRange[1]}
                    onChange={(e) => setSettings({ bpmRange: [settings.bpmRange[0], parseInt(e.target.value)] })}
                    className="flex-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm mb-1" style={{ color: colors.muted }}>Key Mode</label>
                <select
                  value={settings.keyMode}
                  onChange={(e) => setSettings({ keyMode: e.target.value as any })}
                  className="w-full p-2 rounded border text-sm"
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.1)', 
                    borderColor: colors.border, 
                    color: colors.text 
                  }}
                >
                  <option value="exact">Exact</option>
                  <option value="compatible">Compatible</option>
                  <option value="any">Any</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleGenerate}
              disabled={!seed || loading}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: colors.accentPrimary, 
                color: '#000' 
              }}
            >
              {loading ? 'Generating...' : 'Generate Matches'}
            </button>
            
            <button
              onClick={reset}
              className="w-full py-2 px-4 rounded-lg border transition-colors"
              style={{ 
                backgroundColor: 'transparent', 
                borderColor: colors.border, 
                color: colors.text 
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Middle Column - Results */}
      <div 
        className="w-1/2 border-r overflow-y-auto"
        style={{ 
          backgroundColor: colors.surface,
          borderColor: colors.border
        }}
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
            Recommendations ({results.length})
          </h3>
          
          {error && (
            <div 
              className="p-3 rounded mb-4 text-sm"
              style={{ backgroundColor: `${colors.error}20`, color: colors.error }}
            >
              {error}
            </div>
          )}
          
          {results.length === 0 ? (
            <div 
              className="text-center py-12"
              style={{ color: colors.muted }}
            >
              No results yet — choose a seed and Generate.
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={result.id}
                  className="flex items-center space-x-4 p-3 rounded border hover:bg-opacity-20 transition-colors"
                  style={{ 
                    backgroundColor: 'rgba(255,255,255,0.05)', 
                    borderColor: colors.border 
                  }}
                >
                  <img
                    src={result.art}
                    alt={result.title}
                    className="w-12 h-12 rounded object-cover"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" style={{ color: colors.text }}>
                      {result.title}
                    </div>
                    <div className="text-sm truncate" style={{ color: colors.muted }}>
                      {result.artist}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm">
                    <span style={{ color: colors.text }}>{result.bpm}</span>
                    <span style={{ color: colors.text }}>{result.key}</span>
                    <span style={{ color: colors.accentPrimary }}>{result.score}</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => addToQueue(result, 'A')}
                      className="px-3 py-1 rounded text-xs border transition-colors"
                      style={{ 
                        backgroundColor: 'transparent', 
                        borderColor: colors.border, 
                        color: colors.text 
                      }}
                    >
                      Preview A
                    </button>
                    <button
                      onClick={() => addToQueue(result, 'B')}
                      className="px-3 py-1 rounded text-xs border transition-colors"
                      style={{ 
                        backgroundColor: 'transparent', 
                        borderColor: colors.border, 
                        color: colors.text 
                      }}
                    >
                      Preview B
                    </button>
                    <button
                      onClick={() => addToQueue(result)}
                      className="px-3 py-1 rounded text-xs transition-colors"
                      style={{ 
                        backgroundColor: colors.accentPrimary, 
                        color: '#000' 
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column - Session */}
      <div 
        className="w-1/4 overflow-y-auto"
        style={{ backgroundColor: colors.surface }}
      >
        <div className="p-6 space-y-6">
          {/* Session Queue */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: colors.text }}>
              Session Queue ({queue.length})
            </h3>
            
            {queue.length === 0 ? (
              <div 
                className="text-center py-8 text-sm"
                style={{ color: colors.muted }}
              >
                No items in queue
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((item) => (
                  <div
                    key={`${item.id}_${item.order}`}
                    className="flex items-center space-x-3 p-2 rounded border"
                    style={{ 
                      backgroundColor: 'rgba(255,255,255,0.05)', 
                      borderColor: colors.border 
                    }}
                  >
                    <img
                      src={item.art}
                      alt={item.title}
                      className="w-8 h-8 rounded object-cover"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: colors.text }}>
                        {item.title}
                      </div>
                      <div className="text-xs truncate" style={{ color: colors.muted }}>
                        {item.artist}
                      </div>
                    </div>
                    
                    {item.role && (
                      <span 
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: colors.accentPrimary, 
                          color: '#000' 
                        }}
                      >
                        {item.role}
                      </span>
                    )}
                    
                    <button
                      onClick={() => removeFromQueue(item.order)}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ 
                        backgroundColor: `${colors.error}20`, 
                        color: colors.error 
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Export Actions */}
          <div className="space-y-3">
            <button
              onClick={handleSaveSession}
              disabled={!seed || results.length === 0}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: colors.accentPrimary, 
                color: '#000' 
              }}
            >
              Save to Mashups
            </button>
            
            <button
              onClick={handleExportCSV}
              disabled={results.length === 0}
              className="w-full py-2 px-4 rounded-lg border transition-colors disabled:opacity-50"
              style={{ 
                backgroundColor: 'transparent', 
                borderColor: colors.border, 
                color: colors.text 
              }}
            >
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
