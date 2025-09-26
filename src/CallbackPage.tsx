import React, { useEffect } from 'react';
import { apiUrl } from './lib/apiClient';

export default function CallbackPage() {
  useEffect(() => {
    // Handle the OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (error) {
      // Authentication failed
      window.location.href = '/?auth=error';
    } else if (code) {
      // Exchange code for token
      const params = new URLSearchParams();
      params.append('code', code);
      if (urlParams.get('state')) {
        params.append('state', urlParams.get('state')!);
      }
      
      fetch(apiUrl('/api/auth/spotify/callback?' + params.toString()))
        .then(response => {
          if (response.ok) {
            // Redirect to the React app
            window.location.href = '/?auth=success';
          } else {
            window.location.href = '/?auth=error';
          }
        })
        .catch(() => {
          window.location.href = '/?auth=error';
        });
    } else {
      // No code or error, redirect to home
      window.location.href = '/';
    }
  }, []);

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#0C1022',
      color: '#E8EDFF',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      margin: 0
    }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{
          border: '3px solid #1A2348',
          borderTop: '3px solid #8A7CFF',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 1rem'
        }}></div>
        <h2>Completing Spotify Authentication...</h2>
        <p>Please wait while we complete your login.</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
