import React from "react";
import type { AppProps } from "next/app";
import Navigation from "../src/components/Navigation";
import SearchPage from "../src/SearchPage";
import LibraryPage from "../src/LibraryPage";
import MashupsPage from "../src/MashupsPage";
import CallbackPage from "../src/CallbackPage";
import "../src/index.css";

export default function App({ Component, pageProps }: AppProps) {
  // COMPLETELY NEW APPROACH - Direct state management
  const [currentPage, setCurrentPage] = React.useState<string>("search");

  // Initialize from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mashlab-current-page');
      if (saved) {
        setCurrentPage(saved);
      }
    }
  }, []);

  // Direct tab change function
  const changePage = React.useCallback((page: string) => {
    console.log('🎯 DIRECT PAGE CHANGE:', page);
    setCurrentPage(page);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mashlab-current-page', page);
    }
  }, []);

  // Handle URL routing - only on client side
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path === '/callback') {
      // Don't change page for callback
      return;
    }
    if (path === '/recommender' || path === '/mashups') {
      changePage('mashups');
    } else if (path === '/library') {
      changePage('library');
    } else {
      changePage('search');
    }
  }, [changePage]);

  // Render content based on current page
  const renderPage = () => {
    console.log('🎨 RENDERING PAGE:', currentPage);
    switch (currentPage) {
      case 'library':
        return <LibraryPage />;
      case 'mashups':
        return <MashupsPage />;
      case 'search':
      default:
        return <SearchPage />;
    }
  };

  // Special handling for callback page - only on client side
  if (typeof window !== 'undefined' && window.location.pathname === '/callback') {
    return <CallbackPage />;
  }

  console.log('🚀 _app.tsx rendering with currentPage:', currentPage);

  return (
    <div className="min-h-screen" style={{ background: "#0C1022" }}>
      <div className="mx-auto max-w-[1280px] px-6 py-6">
        <div className="mb-8">
          <Navigation 
            activeTab={currentPage as "search" | "library" | "mashups"} 
            onTabChange={changePage} 
          />
        </div>
        
        {/* DEBUG INFO - Hidden but available for debugging */}
        {false && (
          <div style={{
            color: 'white',
            marginBottom: '10px',
            fontSize: '14px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '8px',
            borderRadius: '4px'
          }}>
            🔍 CURRENT PAGE: <strong>{currentPage}</strong>
          </div>
        )}
        
        {renderPage()}
        
        {/* Footer with GetSongBPM backlink */}
        <footer className="mt-16 pt-8 border-t border-gray-800 text-center">
          <p className="text-gray-400 text-sm">
            BPM data by{" "}
            <a 
              href="https://getsongbpm.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              GetSongBPM
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
