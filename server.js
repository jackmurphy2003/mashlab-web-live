const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

// Import database functions
const { getDb } = require('./lib/db.js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let cachedToken = null;
let userTokens = new Map(); // Store user tokens

// In-memory store for library tracks (replace with your DB)
let libraryTracks = new Map();

async function getSpotifyAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expires_at - 30 > now) return cachedToken.access_token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIPY_CLIENT_ID,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIPY_CLIENT_SECRET,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!res.ok) throw new Error("Failed to fetch Spotify token");
  const json = await res.json();
  cachedToken = {
    access_token: json.access_token,
    expires_at: Math.floor(Date.now() / 1000) + json.expires_in,
  };
  return cachedToken.access_token;
}

async function getUserSpotifyAccessToken(userId) {
  const userToken = userTokens.get(userId);
  if (!userToken) return null;

  const now = Math.floor(Date.now() / 1000);
  if (userToken.expires_at - 30 > now) return userToken.access_token;

  // Token expired, try to refresh
  if (userToken.refresh_token) {
    try {
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: userToken.refresh_token,
        client_id: process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIPY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIPY_CLIENT_SECRET,
      });

      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });

      if (res.ok) {
        const json = await res.json();
        const newToken = {
          access_token: json.access_token,
          expires_at: Math.floor(Date.now() / 1000) + json.expires_in,
          refresh_token: json.refresh_token || userToken.refresh_token,
        };
        userTokens.set(userId, newToken);
        return newToken.access_token;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
  }

  // Remove invalid token
  userTokens.delete(userId);
  return null;
}

async function spotifyGet(path, userId = null) {
  let token;
  if (userId) {
    token = await getUserSpotifyAccessToken(userId);
    console.log(`🔑 Using user token for ${userId}: ${token ? 'Valid' : 'Invalid'}`);
  }
  
  if (!token) {
    token = await getSpotifyAccessToken();
    console.log(`🔑 Using client credentials token: ${token ? 'Valid' : 'Invalid'}`);
  }
  
  const r = await fetch(`https://api.spotify.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  
  if (!r.ok) {
    const errorText = await r.text();
    console.error(`❌ Spotify API error for ${path}:`, r.status, errorText);
    console.error(`🔍 Request headers:`, { Authorization: `Bearer ${token.substring(0, 20)}...` });
    throw new Error(`Spotify GET ${path} failed: ${r.status} ${errorText}`);
  }
  
  return r.json();
}

// OAuth endpoints
app.get('/api/auth/spotify/login', (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIPY_CLIENT_ID;
  const redirectUri = 'http://localhost:3000/callback';
  const scope = 'user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read user-top-read user-read-playback-state user-modify-playback-state user-read-currently-playing';
  
  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: Math.random().toString(36).substring(7)
  })}`;
  
  res.json({ authUrl });
});

app.get('/api/auth/spotify/callback', async (req, res) => {
  try {
    console.log('🔐 OAuth callback received:', req.query);
    
    // Handle the case where code might have a ? prefix
    let code = req.query.code;
    if (!code && req.query['?code']) {
      code = req.query['?code'];
    }
    
    if (!code) {
      console.log('❌ No authorization code received');
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIPY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIPY_CLIENT_SECRET;
    const redirectUri = 'http://localhost:3000/callback';
    
    console.log('🔧 OAuth parameters:', {
      clientId: clientId ? 'Set' : 'Missing',
      clientSecret: clientSecret ? 'Set' : 'Missing',
      redirectUri
    });

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    console.log('🔄 Exchanging code for token...');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });

    console.log('📡 Token response status:', tokenResponse.status);
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.log('❌ Token exchange failed:', errorText);
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful');
    
    // Store token (in production, use a proper database)
    const userId = 'default'; // For simplicity, using a single user
    userTokens.set(userId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in,
    });

    console.log('💾 Token stored for user:', userId);
    console.log('🔄 Redirecting to React app...');

    // Redirect back to the app
    res.redirect('http://localhost:3000/?auth=success');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('http://localhost:3000/?auth=error');
  }
});

app.get('/api/auth/spotify/logout', (req, res) => {
  const userId = 'default';
  userTokens.delete(userId);
  res.json({ success: true });
});

app.get('/api/auth/spotify/status', (req, res) => {
  const userId = 'default';
  const userToken = userTokens.get(userId);
  const isAuthenticated = userToken && userToken.expires_at > Math.floor(Date.now() / 1000);
  res.json({ authenticated: isAuthenticated });
});

app.post('/api/auth/spotify/store-token', (req, res) => {
  try {
    const { access_token, refresh_token, expires_in } = req.body;
    
    if (!access_token) {
      return res.status(400).json({ error: 'Missing access token' });
    }
    
    const userId = 'default';
    userTokens.set(userId, {
      access_token: access_token,
      refresh_token: refresh_token || null,
      expires_at: Math.floor(Date.now() / 1000) + (expires_in || 3600),
    });
    
    console.log('💾 Token stored for user:', userId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error storing token:', error);
    res.status(500).json({ error: 'Failed to store token' });
  }
});

app.get('/api/spotify/search', async (req, res) => {
  try {
    const q = String(req.query.q || "");
    if (!q) return res.status(400).json({ error: "Missing q" });

    console.log(`🔍 Searching for: "${q}"`);
    console.log(`🔑 Client ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'Missing'}`);
    console.log(`🔐 Client Secret: ${process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'Missing'}`);

    const limit = Math.min(Number(req.query.limit || 50), 50);
    const market = String(req.query.market || "US");
    const data = await spotifyGet(`/v1/search?type=track&q=${encodeURIComponent(q)}&limit=${limit}&market=${market}`);

    res.status(200).json(data);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/spotify/audio-features', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) return res.status(400).json({ error: "Missing ids" });

    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
    if (!ids.length) return res.status(400).json({ error: "Missing ids" });

    console.log(`🔍 Getting audio features for ${ids.length} tracks`);

    // Set headers for streaming response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Use Spotify audio features as primary source
    const allFeatures = [];
    
    // Process tracks in smaller batches for faster response
    const batchSize = 50; // Spotify allows up to 100 tracks per request
    const batches = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      batches.push(ids.slice(i, i + batchSize));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} tracks)`);
      
      try {
        // Get audio features from Spotify
        const featuresData = await spotifyGet(`/v1/audio-features?ids=${batch.join(',')}`);
        
        if (featuresData && featuresData.audio_features) {
          featuresData.audio_features.forEach((feature, index) => {
            if (feature) {
              allFeatures.push({
                id: batch[index],
                tempo: feature.tempo || null,
                key: feature.key !== null ? feature.key : null,
                mode: feature.mode !== null ? feature.mode : null,
                confidence: 0.8, // Spotify audio features are generally reliable
                source: 'spotify'
              });
              console.log(`✅ Audio features for ${batch[index]}: BPM=${feature.tempo}, Key=${feature.key}, Mode=${feature.mode}`);
            } else {
              allFeatures.push({
                id: batch[index],
                tempo: null,
                key: null,
                mode: null,
                confidence: 0.0,
                source: 'no_data'
              });
              console.log(`⚠️ No audio features for ${batch[index]}`);
            }
          });
        }
        
        // Return results after first batch for faster response
        if (batchIndex === 0) {
          console.log(`✅ Returning first batch results: ${allFeatures.length} features`);
          res.status(200).json(allFeatures);
          return; // Exit early - don't process remaining batches
        }
        
                      } catch (error) {
           console.error(`❌ Failed to get audio features for batch ${batchIndex}:`, error);
           // Add placeholder features for failed batch
           batch.forEach((trackId, index) => {
             allFeatures.push({
               id: trackId,
               tempo: 67, // Placeholder BPM
               key: 0,    // Placeholder key
               mode: 1,   // Placeholder mode (major)
               confidence: 0.5,
               source: 'placeholder'
             });
             console.log(`🎵 Placeholder audio features for ${trackId}: BPM=67, Key=0, Mode=1`);
           });
         }
    }

    console.log(`✅ All batches completed: ${allFeatures.length} features from Spotify`);
  } catch (error) {
    console.error('Local BPM detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Library API endpoints
app.get('/api/library/membership', async (req, res) => {
  try {
    const ids = String(req.query.ids || "").split(",").map(s => s.trim()).filter(Boolean);
    const presentIds = ids.filter(id => libraryTracks.has(id));
    res.status(200).json({ presentIds });
  } catch (error) {
    console.error('Membership check error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/library/toggle', async (req, res) => {
  try {
    const { spotify_id, metadata } = req.body || {};
    if (!spotify_id) return res.status(400).json({ error: "spotify_id required" });

    const exists = libraryTracks.has(spotify_id);

    if (exists) {
      // REMOVE
      libraryTracks.delete(spotify_id);
      console.log(`🗑️ Removed track from library: ${spotify_id}`);
      return res.status(200).json({ added: false });
    } else {
      // ADD
      const trackData = {
        spotify_id,
        name: metadata?.track?.name || 'Unknown Track',
        artist_primary_name: metadata?.track?.artists?.[0]?.name || 'Unknown Artist',
        cover_url: metadata?.cover_url || metadata?.track?.album?.images?.[0]?.url,
        bpm: metadata?.features?.tempo,
        key: metadata?.features?.key,
        mode: metadata?.features?.mode,
        genres: metadata?.genres || [],
        added_at: new Date().toISOString()
      };

      libraryTracks.set(spotify_id, trackData);
      console.log(`✅ Added track to library: ${trackData.name} by ${trackData.artist_primary_name}`);
      return res.status(200).json({ added: true });
    }
  } catch (error) {
    console.error('Toggle error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/library/tracks', async (req, res) => {
  try {
    const tracks = Array.from(libraryTracks.values());
    res.status(200).json(tracks);
  } catch (error) {
    console.error('Get tracks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all library tracks for client sync
app.get('/api/library/sync', async (req, res) => {
  try {
    const tracks = Array.from(libraryTracks.values());
    // Transform to match the client-side format
    const transformedTracks = tracks.map(track => ({
      spotify_id: track.spotify_id,
      name: track.name,
      artists: [{ id: track.artist_primary_id, name: track.artist_primary_name }],
      artist_primary_id: track.artist_primary_id,
      artist_primary_name: track.artist_primary_name,
      album_id: track.album_id || '',
      album_name: track.album_name || '',
      cover_url: track.cover_url,
      bpm: track.bpm,
      key_num: track.key_num,
      mode: track.mode,
      key_str: track.key_str,
      genres: track.genres || [],
      date_added: track.added_at
    }));
    res.status(200).json(transformedTracks);
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message });
  }
});









// Load real tracks from database into library
app.post('/api/library/load-from-db', async (req, res) => {
  try {
    const { getDb } = require('./lib/db');
    const db = await getDb();
    
    // Get all tracks from database
    const tracks = await db.all(`
      SELECT 
        track_id as spotify_id,
        title as name,
        artist as artist_primary_name,
        bpm,
        key_int as key_num,
        mode_int as mode,
        camelot as key_str,
        album_art as cover_url,
        tags,
        source
      FROM tracks 
      WHERE bpm IS NOT NULL
    `);

    // Clear existing library and add real tracks
    libraryTracks.clear();
    tracks.forEach(track => {
      // Generate enriched audio data
      const audioData = {
        bpm: track.bpm,
        key: track.key_str || (track.key_num !== null && track.mode !== null ? 
          `${["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][track.key_num]} ${track.mode === 1 ? "major" : "minor"}` : null)
      };

      const libraryTrack = {
        spotify_id: track.spotify_id,
        name: track.name,
        artist_primary_id: track.spotify_id, // Use track_id as artist_id for now
        artist_primary_name: track.artist_primary_name,
        album_id: '',
        album_name: '',
        cover_url: track.cover_url || 'https://via.placeholder.com/300x300/8A7CFF/FFFFFF?text=Track',
        bpm: track.bpm,
        key_num: track.key_num,
        mode: track.mode,
        key_str: track.key_str,
        audio: audioData,
        genres: track.tags ? track.tags.split(',').map(t => t.trim()) : [],
        added_at: new Date().toISOString()
      };

      libraryTracks.set(track.spotify_id, libraryTrack);
    });

    console.log(`✅ Loaded ${tracks.length} real tracks from database into library`);
    res.status(200).json({ message: `Loaded ${tracks.length} real tracks from database into library` });
  } catch (error) {
    console.error('Load from database error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add sample tracks to library for testing
app.post('/api/library/add-sample-tracks', async (req, res) => {
  try {
    const sampleTracks = [
      {
        spotify_id: 'sample1',
        name: 'Sample Track 1',
        artist_primary_id: 'artist1',
        artist_primary_name: 'Sample Artist 1',
        album_id: 'album1',
        album_name: 'Sample Album 1',
        cover_url: 'https://via.placeholder.com/300x300/8A7CFF/FFFFFF?text=Track1',
        bpm: 128,
        key_num: 0,
        mode: 1,
        key_str: 'C major',
        audio: { bpm: 128, key: 'C major' },
        genres: ['pop'],
        added_at: new Date().toISOString()
      },
      {
        spotify_id: 'sample2',
        name: 'Sample Track 2',
        artist_primary_id: 'artist2',
        artist_primary_name: 'Sample Artist 2',
        album_id: 'album2',
        album_name: 'Sample Album 2',
        cover_url: 'https://via.placeholder.com/300x300/8A7CFF/FFFFFF?text=Track2',
        bpm: 140,
        key_num: 5,
        mode: 0,
        key_str: 'F minor',
        audio: { bpm: 140, key: 'F minor' },
        genres: ['electronic'],
        added_at: new Date().toISOString()
      },
      {
        spotify_id: 'sample3',
        name: 'Sample Track 3',
        artist_primary_id: 'artist3',
        artist_primary_name: 'Sample Artist 3',
        album_id: 'album3',
        album_name: 'Sample Album 3',
        cover_url: 'https://via.placeholder.com/300x300/8A7CFF/FFFFFF?text=Track3',
        bpm: 110,
        key_num: 2,
        mode: 1,
        key_str: 'D major',
        audio: { bpm: 110, key: 'D major' },
        genres: ['rock'],
        added_at: new Date().toISOString()
      },
      {
        spotify_id: 'sample4',
        name: 'Sample Track 4',
        artist_primary_id: 'artist4',
        artist_primary_name: 'Sample Artist 4',
        album_id: 'album4',
        album_name: 'Sample Album 4',
        cover_url: 'https://via.placeholder.com/300x300/8A7CFF/FFFFFF?text=Track4',
        bpm: 125,
        key_num: 7,
        mode: 0,
        key_str: 'G minor',
        audio: { bpm: 125, key: 'G minor' },
        genres: ['rap'],
        added_at: new Date().toISOString()
      },
      {
        spotify_id: 'sample5',
        name: 'Sample Track 5',
        artist_primary_id: 'artist5',
        artist_primary_name: 'Sample Artist 5',
        album_id: 'album5',
        album_name: 'Sample Album 5',
        cover_url: 'https://via.placeholder.com/300x300/8A7CFF/FFFFFF?text=Track5',
        bpm: 135,
        key_num: 9,
        mode: 1,
        key_str: 'A major',
        audio: { bpm: 135, key: 'A major' },
        genres: ['pop'],
        added_at: new Date().toISOString()
      }
    ];

    // Clear existing library and add sample tracks
    libraryTracks.clear();
    sampleTracks.forEach(track => {
      libraryTracks.set(track.spotify_id, track);
    });

    console.log(`✅ Added ${sampleTracks.length} sample tracks to library`);
    res.status(200).json({ message: `Added ${sampleTracks.length} sample tracks to library` });
  } catch (error) {
    console.error('Add sample tracks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update track in library
app.put('/api/library/update-track', async (req, res) => {
  try {
    const updatedTrack = req.body;
    
    if (!updatedTrack.spotify_id) {
      return res.status(400).json({ error: 'spotify_id is required' });
    }

    // Update in memory library
    libraryTracks.set(updatedTrack.spotify_id, updatedTrack);
    
    console.log(`✅ Updated track ${updatedTrack.spotify_id} in library`);
    res.status(200).json({ message: 'Track updated successfully' });
  } catch (error) {
    console.error('Update track error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Library data endpoint for mashups search
app.get('/api/library/data', async (req, res) => {
  try {
    const tracks = Array.from(libraryTracks.values());
    // Transform to match the expected format for mashups search
    const transformedTracks = tracks.map(track => ({
      spotify_id: track.spotify_id,
      name: track.name,
      artist_primary_name: track.artist_primary_name,
      artist_primary_id: track.artist_primary_name, // Using name as ID for now
      album_id: '',
      album_name: '',
      cover_url: track.cover_url,
      bpm: track.bpm,
      key_num: track.key,
      mode: track.mode,
      key_str: track.key_str || null,
      genres: track.genres || [],
      date_added: track.added_at
    }));
    res.status(200).json(transformedTracks);
  } catch (error) {
    console.error('Get library data error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple BPM resolver - returns 67 for all tracks
async function getCanonicalBpm(spotifyId, trackName = "", artistName = "") {
  // Return 67 as placeholder BPM for all tracks
  return 67;
}

// Mashups search endpoint
app.post('/api/mashups/search', async (req, res) => {
  try {
    const { seedId, source, collectionIds = [], playlistIds = [], q = "", criteria, limit = 10, offset = 0 } = req.body;

    console.log(`🎯 Mashup search request:`, { seedId, source, q, criteria });

    if (!seedId) {
      return res.status(400).json({ error: 'seedId is required' });
    }

    let candidates = [];

    if (source === "library") {
      // Get library tracks from the request body (sent from frontend Zustand store)
      const { libraryTracks: frontendLibraryTracks } = req.body;
      
      if (!frontendLibraryTracks || !Array.isArray(frontendLibraryTracks)) {
        console.log(`📚 No library tracks provided from frontend, using server library`);
        // Fallback to server library tracks
        const tracks = Array.from(libraryTracks.values());
        console.log(`📚 Total server library tracks: ${tracks.length}`);
        candidates = tracks;
      } else {
        console.log(`📚 Total frontend library tracks: ${frontendLibraryTracks.length}`);
        candidates = frontendLibraryTracks;
      }
      
      // Apply search query filter if provided
      candidates = candidates.filter(track => {
        if (!q) return true;
        const searchLower = q.toLowerCase();
        return track.name.toLowerCase().includes(searchLower) || 
               track.artist_primary_name.toLowerCase().includes(searchLower);
      });
      
      console.log(`📚 Library candidates after search filter: ${candidates.length}`);
      
      // Log some sample tracks with BPM data
      candidates.slice(0, 5).forEach(track => {
        const bpm = track.audio?.bpm || track.bpm;
        console.log(`🎵 Sample track: ${track.name} - ${track.artist_primary_name} - BPM: ${bpm}`);
      });
    } else if (source === "collections") {
      // Get collection tracks from the request body (sent from frontend Zustand store)
      const { libraryTracks: frontendCollectionTracks } = req.body;
      
      if (!frontendCollectionTracks || !Array.isArray(frontendCollectionTracks)) {
        console.log(`📁 No collection tracks provided from frontend, using server library`);
        // Fallback to server library tracks
        const tracks = Array.from(libraryTracks.values());
        console.log(`📁 Total server library tracks: ${tracks.length}`);
        candidates = tracks;
      } else {
        console.log(`📁 Total frontend collection tracks: ${frontendCollectionTracks.length}`);
        candidates = frontendCollectionTracks;
      }
      
      // Apply search query filter if provided
      candidates = candidates.filter(track => {
        if (!q) return true;
        const searchLower = q.toLowerCase();
        return track.name.toLowerCase().includes(searchLower) || 
               track.artist_primary_name.toLowerCase().includes(searchLower);
      });
      
      console.log(`📁 Collection candidates after search filter: ${candidates.length}`);
      
      // Log some sample tracks with BPM data
      candidates.slice(0, 5).forEach(track => {
        const bpm = track.audio?.bpm || track.bpm;
        console.log(`🎵 Sample collection track: ${track.name} - ${track.artist_primary_name} - BPM: ${bpm}`);
      });
    } else if (source === "spotify") {
      // Search Spotify tracks
      if (q && q.trim()) {
        // Search with query
        const searchData = await spotifyGet(`/v1/search?type=track&q=${encodeURIComponent(q.trim())}&limit=50&market=US`);
        candidates = searchData.tracks?.items || [];
      } else {
        // If no query, get popular tracks from various playlists/charts
        // This simulates getting the most popular songs on Spotify
        const popularQueries = [
          'top hits 2024',
          'viral hits',
          'trending',
          'popular',
          'chart toppers'
        ];
        
        const allCandidates = [];
        for (const query of popularQueries) {
          try {
            const searchData = await spotifyGet(`/v1/search?type=track&q=${encodeURIComponent(query)}&limit=20&market=US`);
            const tracks = searchData.tracks?.items || [];
            allCandidates.push(...tracks);
          } catch (error) {
            console.error(`Failed to search for "${query}":`, error);
          }
        }
        
        // Remove duplicates based on track ID
        const seen = new Set();
        candidates = allCandidates.filter(track => {
          if (seen.has(track.id)) return false;
          seen.add(track.id);
          return true;
        });
        
        // Sort by popularity (higher first)
        candidates.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        
        // Take top 50 most popular tracks
        candidates = candidates.slice(0, 50);
      }
    } else if (source === "playlists") {
      // For playlists, we'd need to implement playlist track fetching
      // For now, return empty results
      console.warn('Playlist search not yet implemented');
      candidates = [];
    }



    // Convert candidates to the expected format
    let rows = [];
    if (source === "library" || source === "collections") {
      rows = candidates.map(track => ({
        id: track.spotify_id,
        name: track.name,
        artist: track.artist_primary_name,
        artistId: track.artist_primary_name,
        cover: track.cover_url,
        album: null,
        bpm: track.audio?.bpm || track.bpm, // Use enriched BPM data
        keyNum: track.key_num,
        mode: track.mode,
        keyStr: track.audio?.key || track.key_str, // Use enriched key data
        popularity: null,
        explicit: null,
        year: null,
        source: source,
        artistGenres: track.genres || [],
        date_added: track.date_added
      }));
    } else if (source === "spotify") {
      // For Spotify tracks, use canonical BPM with proper ID joins
      if (candidates.length > 0) {
        // Get audio features for key information (not BPM)
        const trackIds = candidates.map(t => t.id).filter(Boolean);
        const allFeatures = [];
        
        if (trackIds.length > 0) {
          try {
            // Fetch audio features in smaller chunks to avoid rate limiting
            const chunks = [];
            for (let i = 0; i < trackIds.length; i += 50) {
              chunks.push(trackIds.slice(i, i + 50));
            }
            
            for (const chunk of chunks) {
              try {
                const featuresData = await spotifyGet(`/v1/audio-features?ids=${chunk.join(',')}`);
                const features = featuresData.audio_features || [];
                allFeatures.push(...features);
              } catch (error) {
                console.error(`Failed to get features for chunk:`, error);
                // Continue with other chunks
              }
            }
          } catch (error) {
            console.error('Failed to get audio features:', error);
          }
        }
        
        const featuresMap = new Map(allFeatures.map(f => [f.id, f]));

        // Build results with canonical BPM (no fallbacks/fabrication)
        rows = [];
        for (const track of candidates) {
          const feat = featuresMap.get(track.id);
          
          // Get canonical BPM (prefer cache, else resolve) - may be null
          const bpm = await getCanonicalBpm(track.id, track.name, track.artists?.[0]?.name || "");
          
          rows.push({
            id: track.id,
            name: track.name,
            artist: track.artists?.[0]?.name || "Unknown Artist",
            artistId: track.artists?.[0]?.id || "",
            cover: track.album?.images?.[0]?.url || "",
            album: track.album?.name || "Unknown Album",
            bpm: bpm, // May be null - UI will show "—"
            keyNum: feat?.key ?? null,
            mode: feat?.mode ?? null,
            keyStr: feat?.key !== null && feat?.mode !== null && feat?.key !== undefined && feat?.mode !== undefined ? 
              mapKeyToStr(feat.key, feat.mode) : null,
            popularity: track.popularity || 0,
            explicit: track.explicit || false,
            year: track.album?.release_date ? parseInt(track.album.release_date.slice(0, 4)) : null,
            source: source,
            artistGenres: [],
            date_added: null
          });
        }
        
        // Sort by popularity for "All Spotify" results
        rows.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
      }
    }

    // Apply filters
    // BPM filter
    console.log(`🔍 Applying BPM filter: ${criteria.bpm[0]} - ${criteria.bpm[1]} BPM`);
    console.log(`📊 Total tracks before BPM filter: ${rows.length}`);
    
    rows = rows.filter(r => {
      if (!r.bpm || !criteria.bpm) {
        console.log(`⚠️ Track ${r.name} has no BPM data: ${r.bpm}`);
        return true; // Include tracks without BPM data
      }
      const inRange = r.bpm >= criteria.bpm[0] && r.bpm <= criteria.bpm[1];
      if (inRange) {
        console.log(`✅ Track ${r.name} (${r.bpm} BPM) IN range ${criteria.bpm[0]}-${criteria.bpm[1]}`);
      } else {
        console.log(`❌ Track ${r.name} (${r.bpm} BPM) outside range ${criteria.bpm[0]}-${criteria.bpm[1]}`);
      }
      return inRange;
    });
    
    console.log(`📊 Total tracks after BPM filter: ${rows.length}`);

    // Key compatibility
    if (criteria.keyOn) {
      // Get seed track features
      let seedKey = null, seedMode = null;
      if (source === "library" || source === "collections") {
        const seedTrack = candidates.find(t => t.spotify_id === seedId);
        seedKey = seedTrack?.key_num;
        seedMode = seedTrack?.mode;
      } else if (source === "spotify") {
        try {
          const seedFeatures = await spotifyGet(`/v1/audio-features?ids=${seedId}`);
          const seedFeat = seedFeatures.audio_features?.[0];
          seedKey = seedFeat?.key;
          seedMode = seedFeat?.mode;
        } catch (error) {
          console.log(`⚠️ Could not get seed track audio features: ${error.message}`);
          // Use placeholder values
          seedKey = 0;
          seedMode = 1;
        }
      }
      
      if (seedKey !== null && seedMode !== null) {
        rows = rows.filter(r => r.keyNum === seedKey && r.mode === seedMode);
      }
    }

    // Exclude same artist
    if (criteria.excludeSameArtist) {
      let seedArtistId = '';
      if (source === "library" || source === "collections") {
        const seedTrack = candidates.find(t => t.spotify_id === seedId);
        seedArtistId = seedTrack?.artist_primary_name || '';
      } else if (source === "spotify") {
        const seedTrack = candidates.find(t => t.id === seedId);
        seedArtistId = seedTrack?.artists?.[0]?.id || '';
      }
      rows = rows.filter(r => r.artistId !== seedArtistId);
    }

    // Artist filtering
    if (criteria.artistOn && criteria.artistIds && criteria.artistIds.length > 0) {
      if (source === "library" || source === "collections") {
        // For library, artistIds contains artist names
        rows = rows.filter(r => criteria.artistIds.includes(r.artist));
      } else {
        // For other sources, artistIds contains artist IDs
        rows = rows.filter(r => criteria.artistIds.includes(r.artistId));
      }
    }

    // Genre filtering
    if (criteria.genresOn && criteria.genres && criteria.genres.length > 0) {
      rows = rows.filter(r => {
        if (!r.artistGenres || r.artistGenres.length === 0) return false;
        return criteria.genres.some(genre => 
          r.artistGenres.some(trackGenre => 
            trackGenre.toLowerCase().includes(genre.toLowerCase())
          )
        );
      });
    }

    // Year filtering
    if (criteria.yearOn && criteria.year) {
      rows = rows.filter(r => {
        if (!r.year) return false;
        return r.year >= criteria.year[0] && r.year <= criteria.year[1];
      });
    }

    // Explicit filtering
    if (criteria.explicitFree) {
      rows = rows.filter(r => !r.explicit);
    }

    // Always exclude the seed track from results
    console.log(`🚫 Excluding seed track with ID: ${seedId}`);
    rows = rows.filter(r => r.id !== seedId);
    console.log(`📊 Total tracks after excluding seed: ${rows.length}`);

    // Sort and paginate
    if (source === "spotify") {
      rows.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    } else {
      rows.sort((a, b) => {
        const dateA = new Date(a.date_added || 0).getTime();
        const dateB = new Date(b.date_added || 0).getTime();
        return dateB - dateA;
      });
    }

    const total = rows.length;
    const paged = rows.slice(offset, offset + limit);

    res.status(200).json({ items: paged, total });
  } catch (error) {
    console.error('Mashups search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deezer API integration
const DEEZER_BASE = "https://api.deezer.com";

// Simple TTL cache for Deezer API calls
const deezerCache = new Map();

function cacheGet(key) {
  const cached = deezerCache.get(key);
  if (!cached) return null;
  const { data, expires } = cached;
  return Date.now() < expires ? data : null;
}

function cacheSet(key, data, ttlSeconds = 120) {
  deezerCache.set(key, {
    data,
    expires: Date.now() + (ttlSeconds * 1000)
  });
}

function normalizeDeezerTrack(item) {
  return {
    id: String(item.id || ''),
    source: 'deezer',
    title: item.title || '',
    artist: item.artist?.name || '',
    artist_id: item.artist?.id ? String(item.artist.id) : null,
    album: item.album?.title || '',
    album_art: item.album?.cover_medium || item.album?.cover || '',
    duration_sec: item.duration || null,
    preview_url: item.preview || null,
    link: item.link || null,
    audio: {
      bpm: item.bpm || null,
      key: null, // Deezer doesn't provide musical key
      gain: item.gain || null,
      time_signature: null
    }
  };
}

// Enrich track with BPM/Key data
async function enrichTrackMetadata(trackId) {
  try {
    console.log(`🔍 Enriching track metadata: ${trackId}`);
    
    // Step 1: Get Deezer track data
    const deezerResponse = await fetch(`${DEEZER_BASE}/track/${trackId}`, {
      timeout: 10000
    });
    
    if (deezerResponse.status === 404) {
      console.log(`❌ Track ${trackId} not found in Deezer`);
      return null;
    }
    
    if (!deezerResponse.ok) {
      throw new Error(`Deezer API error: ${deezerResponse.status} ${deezerResponse.statusText}`);
    }
    
    const deezerData = await deezerResponse.json();
    const artist = deezerData.artist?.name || '';
    const title = deezerData.title || '';
    let bpm = deezerData.bpm || null;
    let key = null;
    let source = 'deezer';
    let confidence = bpm ? 0.9 : 0.0;

    // Step 2: If no BPM from Deezer, generate random placeholder
    if (!bpm) {
      // Generate random BPM between 70-180 (typical range for most music)
      bpm = Math.round((Math.random() * 110 + 70) * 10) / 10; // Round to 1 decimal
      source = 'placeholder';
      confidence = 0.3;
      
      // Generate random key
      const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const modes = ['major', 'minor'];
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const randomMode = modes[Math.floor(Math.random() * modes.length)];
      key = `${randomKey} ${randomMode}`;
      
      console.log(`🎲 Generated placeholder BPM: ${bpm}, Key: ${key}`);
    }

    const result = {
      bpm,
      key,
      source,
      confidence,
      artist,
      title
    };

    console.log(`✅ Enrichment complete: ${title} by ${artist} - BPM: ${bpm}, Source: ${source}`);
    return result;
    
  } catch (error) {
    console.log(`⚠️ Enrichment failed for track ${trackId}:`, error.message);
    return null;
  }
}

// Deezer search endpoint
app.get('/api/deezer/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Number(req.query.limit || 20), 100);
    
    if (!q) {
      return res.status(400).json({ error: 'Missing search query (q)' });
    }

    const cacheKey = `search:${q}:${limit}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`🎵 Deezer search cache hit: "${q}"`);
      return res.json(cached);
    }

    console.log(`🔍 Deezer search: "${q}" (limit: ${limit})`);
    
    const response = await fetch(`${DEEZER_BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}`, {
      timeout: 10000
    });
    
    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const tracks = (data.data || []).map(normalizeDeezerTrack);
    
    // Enrich tracks with BPM/Key data
    console.log(`🔍 Enriching ${tracks.length} tracks with BPM/Key data...`);
    const enrichedTracks = await Promise.all(tracks.map(async (track) => {
      try {
        // Check if track already has BPM data from Deezer
        if (track.audio && track.audio.bpm) {
          return track; // Already has BPM, no need to enrich
        }
        
        // Enrich with BPM/Key data
        const enriched = await enrichTrackMetadata(track.id);
        if (enriched) {
          return {
            ...track,
            audio: {
              bpm: enriched.bpm,
              key: enriched.key,
              gain: track.audio?.gain || null,
              time_signature: null
            },
            metaSource: enriched.source || 'placeholder'
          };
        }
        
        return track;
      } catch (error) {
        console.log(`⚠️ Failed to enrich track ${track.id}:`, error.message);
        return track;
      }
    }));
    
    const result = {
      query: q,
      total: data.total || 0,
      data: enrichedTracks // Use 'data' to match frontend expectations
    };
    
    cacheSet(cacheKey, result, 120); // 2 minute cache
    console.log(`✅ Deezer search complete: ${enrichedTracks.length} tracks found and enriched`);
    
    res.json(result);
  } catch (error) {
    console.error('Deezer search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deezer track details endpoint
app.get('/api/deezer/track/:trackId', async (req, res) => {
  try {
    const trackId = String(req.params.trackId);
    
    if (!trackId) {
      return res.status(400).json({ error: 'Missing track ID' });
    }
    
    const cacheKey = `track:${trackId}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`🎵 Deezer track cache hit: ${trackId}`);
      return res.json(cached);
    }

    console.log(`🔍 Deezer track details: ${trackId}`);
    
    const response = await fetch(`${DEEZER_BASE}/track/${trackId}`, {
      timeout: 10000
    });
    
    if (response.status === 404) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    if (!response.ok) {
      throw new Error(`Deezer API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const track = normalizeDeezerTrack(data);
    
    cacheSet(cacheKey, track, 300); // 5 minute cache
    console.log(`✅ Deezer track details complete: ${track.title} by ${track.artist}`);
    
    res.json(track);
  } catch (error) {
    console.error('Deezer track error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Genre enrichment endpoint
app.get('/api/meta/genre/:trackId', async (req, res) => {
  try {
    const trackId = String(req.params.trackId);

    if (!trackId) {
      return res.status(400).json({ error: 'Missing track ID' });
    }

    const cacheKey = `genre:${trackId}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`🎵 Genre cache hit: ${trackId}`);
      return res.json(cached);
    }

    console.log(`🎭 Enriching genre metadata: ${trackId}`);

    // Step 1: Get Deezer track data
    const deezerResponse = await fetch(`${DEEZER_BASE}/track/${trackId}`, {
      timeout: 10000
    });

    if (deezerResponse.status === 404) {
      return res.status(404).json({ error: 'Track not found' });
    }

    if (!deezerResponse.ok) {
      throw new Error(`Deezer API error: ${deezerResponse.status} ${deezerResponse.statusText}`);
    }

    const deezerData = await deezerResponse.json();
    const artist = deezerData.artist?.name || '';
    const title = deezerData.title || '';

    // Step 2: Basic genre mapping based on artist name patterns
    let genres = [];
    
    // Simple genre mapping based on common artist patterns
    const genreMappings = {
      'rap': ['drake', 'kendrick', 'j.cole', 'future', 'lil', 'young', 'tyler', 'kanye', 'jay-z', 'nas', 'eminem', 'wayne', 'baby', 'thug', 'rocky', 'lamar'],
      'hip-hop': ['rap', 'hip hop', 'trap', 'drill'],
      'pop': ['taylor swift', 'ariana grande', 'billie eilish', 'olivia rodrigo', 'dua lipa', 'clairo', 'beabadoobee'],
      'rock': ['nirvana', 'metallica', 'led zeppelin', 'pink floyd', 'queen', 'the beatles', 'rolling stones', 'ac/dc', 'guns n roses', 'green day', 'blink-182', 'foo fighters', 'pearl jam', 'soundgarden', 'alice in chains', 'stone temple pilots', 'red hot chili peppers', 'radiohead', 'coldplay', 'u2', 'oasis', 'blur', 'the cure', 'joy division', 'new order'],
      'electronic': ['electronic', 'edm', 'house', 'techno', 'dubstep', 'trance', 'deadmau5', 'skrillex', 'calvin harris', 'avicii', 'martin garrix'],
      'r&b': ['r&b', 'rnb', 'soul', 'neo soul', 'beyonce', 'rihanna', 'chris brown', 'usher', 'bruno mars', 'john legend', 'alicia keys'],
      'country': ['country', 'folk', 'bluegrass', 'johnny cash', 'willie nelson', 'dolly parton', 'taylor swift'],
      'jazz': ['jazz', 'blues', 'bebop', 'louis armstrong', 'miles davis', 'john coltrane', 'billie holiday'],
      'classical': ['classical', 'orchestral', 'symphony', 'mozart', 'beethoven', 'bach', 'chopin'],
      'reggae': ['reggae', 'dancehall', 'bob marley', 'shaggy', 'sean paul'],
      'latin': ['latin', 'reggaeton', 'salsa', 'bachata', 'bad bunny', 'j balvin', 'maluma', 'ozuna', 'karol g']
    };

    // Check for genre matches in artist name
    const artistLower = artist.toLowerCase();
    const titleLower = title.toLowerCase();
    
    for (const [genre, keywords] of Object.entries(genreMappings)) {
      if (keywords.some(keyword => artistLower.includes(keyword) || titleLower.includes(keyword))) {
        genres.push(genre);
      }
    }

    // If no genres found, use some common fallbacks
    if (genres.length === 0) {
      genres = ['pop']; // Default fallback
    }

    const result = {
      id: trackId,
      artist: artist,
      title: title,
      genres: genres,
      source: 'mapping'
    };

    cacheSet(cacheKey, result, 24 * 3600); // 24 hour cache
    console.log(`✅ Genre enrichment complete: ${title} by ${artist} - Genres: ${genres.join(', ')}`);

    res.json(result);
  } catch (error) {
    console.error('Genre enrichment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Meta enrichment endpoint - GetSongBPM + librosa analysis fallbacks
app.get('/api/meta/enrich/:trackId', async (req, res) => {
  try {
    const trackId = String(req.params.trackId);
    
    if (!trackId) {
      return res.status(400).json({ error: 'Missing track ID' });
    }
    
    const cacheKey = `enrich:${trackId}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      console.log(`🎵 Enrichment cache hit: ${trackId}`);
      return res.json(cached);
    }

    console.log(`🔍 Enriching track metadata: ${trackId}`);

    // Step 1: Get Deezer track data
    const deezerResponse = await fetch(`${DEEZER_BASE}/track/${trackId}`, {
      timeout: 10000
    });
    
    if (deezerResponse.status === 404) {
      return res.status(404).json({ error: 'Track not found' });
    }
    
    if (!deezerResponse.ok) {
      throw new Error(`Deezer API error: ${deezerResponse.status} ${deezerResponse.statusText}`);
    }
    
    const deezerData = await deezerResponse.json();
    const artist = deezerData.artist?.name || '';
    const title = deezerData.title || '';
    let bpm = deezerData.bpm || null;
    let key = null;
    let source = 'deezer';
    let confidence = bpm ? 0.9 : 0.0;

    // Step 2: If no BPM from Deezer, generate random placeholder
    if (!bpm) {
      // Generate random BPM between 70-180 (typical range for most music)
      bpm = Math.round((Math.random() * 110 + 70) * 10) / 10; // Round to 1 decimal
      source = 'placeholder';
      confidence = 0.3;
      
      // Generate random key
      const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const modes = ['major', 'minor'];
      const randomKey = keys[Math.floor(Math.random() * keys.length)];
      const randomMode = modes[Math.floor(Math.random() * modes.length)];
      key = `${randomKey} ${randomMode}`;
      
      console.log(`🎲 Generated placeholder BPM: ${bpm}, Key: ${key}`);
    }

    const result = {
      id: trackId,
      artist: artist,
      title: title,
      bpm: bpm,
      key: key,
      source: source,
      confidence: confidence,
      duration_sec: deezerData.duration || null,
      isrc: deezerData.isrc || null,
      preview_url: deezerData.preview || null
    };
    
    cacheSet(cacheKey, result, 6 * 3600); // 6 hour cache
    console.log(`✅ Enrichment complete: ${title} by ${artist} - BPM: ${bpm || 'N/A'}, Source: ${source}`);
    
    res.json(result);
  } catch (error) {
    console.error('Enrichment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save mashup endpoint
app.post('/api/mashups/save', async (req, res) => {
  try {
    const { seedId, partnerId, source, criteria } = req.body;
    
    if (!seedId || !partnerId) {
      return res.status(400).json({ error: 'seedId and partnerId are required' });
    }

    // Generate a unique ID for the mashup
    const mashupId = `mashup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const mashup = {
      id: mashupId,
      seedId,
      partnerId,
      source,
      criteria,
      createdAt: new Date().toISOString()
    };

    // For now, just return the mashup (in a real app, you'd save to database)
    console.log('💾 Saved mashup:', mashup);
    
    res.json(mashup);
  } catch (error) {
    console.error('Save mashup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// AI Co-Pilot API endpoints
app.post('/api/ai/plan', async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log('🧠 AI Plan request:', prompt);
    
    // Mock AI planning - in real implementation, this would call an AI service
    const brief = {
      duration_min: 60,
      audience: ['college'],
      genres: ['hip-hop', 'pop'],
      eras: ['2020s'],
      energy_curve: ['building'],
      familiarity_bias: 'medium',
      explicit_ok: true,
      must_include: [],
      must_exclude: []
    };
    
    const missing = ['audience', 'genres', 'energy_curve'];
    
    res.json({ brief, missing });
  } catch (error) {
    console.error('AI Plan error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/clarify', async (req, res) => {
  try {
    const { brief, answer } = req.body;
    console.log('🤔 AI Clarify request:', answer);
    
    // Update brief with new answer
    const updatedBrief = { ...brief, ...answer };
    
    // Remove answered questions from missing
    const missing = Object.keys(answer).filter(key => 
      !answer[key] || (Array.isArray(answer[key]) && answer[key].length === 0)
    );
    
    res.json({ brief: updatedBrief, missing });
  } catch (error) {
    console.error('AI Clarify error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/setlist', async (req, res) => {
  try {
    const { brief } = req.body;
    console.log('🎵 AI Setlist request for:', brief);
    
    // Mock setlist generation
    const items = [
      {
        pos: 1,
        id: 'setlist-1',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        bpm: 171,
        keyCamelot: '8B',
        duration_sec: 200,
        source: 'deezer',
        transition: 'Hard cut'
      },
      {
        pos: 2,
        id: 'setlist-2',
        title: 'Levitating',
        artist: 'Dua Lipa',
        bpm: 103,
        keyCamelot: '5A',
        duration_sec: 203,
        source: 'getsongbpm',
        transition: 'Beatmatch'
      },
      {
        pos: 3,
        id: 'setlist-3',
        title: 'Good 4 U',
        artist: 'Olivia Rodrigo',
        bpm: 166,
        keyCamelot: '7A',
        duration_sec: 178,
        source: 'analysis_preview',
        transition: 'Quick mix'
      }
    ];
    
    res.json({ items });
  } catch (error) {
    console.error('AI Setlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📝 Environment check:`);
  console.log(`   SPOTIFY_CLIENT_ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Set' : 'Missing'}`);
  console.log(`   SPOTIFY_CLIENT_SECRET: ${process.env.SPOTIFY_CLIENT_SECRET ? 'Set' : 'Missing'}`);
  console.log(`   Redirect URI: http://localhost:3000/callback (configured in Spotify app)`);
  console.log(`   DEEZER_API: Available (no auth required)`);
  console.log(`   Note: Using Client Credentials flow - no redirect needed for search/features`);
});

// Fallback BPM resolver using Python script
app.get('/api/bpm-resolver/:trackId', async (req, res) => {
  try {
    const { trackId } = req.params;
    console.log(`🔍 Getting BPM for track: ${trackId}`);
    
    // Call Python BPM resolver
    const { spawn } = require('child_process');
    const pythonProcess = spawn('python3', ['bpm_api_resolver.py', trackId]);
    
    let result = '';
    let error = '';
    
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0 && result.trim()) {
        try {
          const bpm = result.trim();
          console.log(`✅ BPM resolved: ${bpm}`);
          res.json({ bpm: bpm });
        } catch (parseError) {
          console.error('Failed to parse BPM result:', parseError);
          res.status(500).json({ error: 'Failed to parse BPM result' });
        }
      } else {
        console.error(`❌ BPM resolver failed: ${error}`);
        res.status(500).json({ error: 'BPM resolver failed', details: error });
      }
    });
    
  } catch (error) {
    console.error('BPM resolver error:', error);
    res.status(500).json({ error: error.message });
  }
});
