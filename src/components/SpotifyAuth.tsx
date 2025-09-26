import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../lib/apiClient';

interface SpotifyAuthProps {
  onAuthChange?: (authenticated: boolean) => void;
}

export default function SpotifyAuth({ onAuthChange }: SpotifyAuthProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await apiFetch('/api/auth/spotify/status');
      const data = await response.json();
      setIsAuthenticated(data.authenticated);
      onAuthChange?.(data.authenticated);
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setIsAuthenticated(false);
      onAuthChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const response = await apiFetch('/api/auth/spotify/login');
      const data = await response.json();
      
      // Redirect to Spotify authorization page
      window.location.href = data.authUrl;
    } catch (error) {
      console.error('Login failed:', error);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      await apiFetch('/api/auth/spotify/logout');
      setIsAuthenticated(false);
      onAuthChange?.(false);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check for auth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success') {
      // Get token from URL if present
      const accessToken = urlParams.get('access_token');
      const refreshToken = urlParams.get('refresh_token');
      const expiresIn = urlParams.get('expires_in');
      
      if (accessToken) {
        // Store token in the backend
        storeToken(accessToken, refreshToken || '', expiresIn || '3600');
      }
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      // Check auth status again
      checkAuthStatus();
    } else if (authStatus === 'error') {
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      alert('Authentication failed. Please try again.');
    }
  }, []);

  const storeToken = async (accessToken: string, refreshToken: string, expiresIn: string) => {
    try {
      const response = await apiFetch('/api/auth/spotify/store-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: parseInt(expiresIn)
        })
      });
      
      if (response.ok) {
        console.log('✅ Token stored successfully');
      } else {
        console.error('❌ Failed to store token');
      }
    } catch (error) {
      console.error('❌ Error storing token:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span className="text-sm text-gray-300">Checking...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-3">
      {isAuthenticated ? (
        <>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-400">Authenticated</span>
          </div>
          <button
            onClick={handleLogout}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            Logout
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-yellow-400">Not authenticated</span>
          </div>
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            Login with Spotify
          </button>
        </>
      )}
    </div>
  );
}
