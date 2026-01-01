/**
 * Discotify Background Service Worker
 * Handles Spotify API authentication and album search
 */

'use strict';

// Spotify API configuration
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

/**
 * Credentials loaded from chrome.storage.local
 *
 * SECURITY NOTE: Client credentials are stored in the browser's local storage.
 * This is necessary for the extension to function but users should be aware
 * that these credentials are accessible to anyone with access to the browser.
 * The credentials are only used to authenticate with Spotify's API and are
 * never transmitted elsewhere.
 */
let clientId = null;
let clientSecret = null;

// Token storage
let accessToken = null;
let tokenExpiresAt = null;

// =============================================================================
// Message Handling
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_SPOTIFY') {
    handleSpotifySearch(message.payload)
      .then(sendResponse)
      .catch((error) => {
        console.error('[Discotify] Search error:', error);
        sendResponse(null);
      });
    return true;
  }

  if (message.type === 'GET_AUTH_STATUS') {
    const isConfigured = !!(clientId && clientSecret);
    const isAuthenticated = isConfigured && !!accessToken && Date.now() < tokenExpiresAt;
    sendResponse({ isAuthenticated, isConfigured });
    return true;
  }

  if (message.type === 'AUTHENTICATE') {
    // Reload credentials from storage and authenticate
    loadCredentialsAndAuthenticate()
      .then((success) => sendResponse({ success }))
      .catch((error) => {
        console.error('[Discotify] Auth error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'LOGOUT') {
    accessToken = null;
    tokenExpiresAt = null;
    chrome.storage.local.remove(['spotifyToken', 'spotifyTokenExpires']);
    sendResponse({ success: true });
    return true;
  }
});

// =============================================================================
// Initialization
// =============================================================================

async function initialize() {
  console.log('[Discotify] Initializing background service...');

  // Load credentials from storage
  const stored = await chrome.storage.local.get([
    'spotifyClientId',
    'spotifyClientSecret',
    'spotifyToken',
    'spotifyTokenExpires'
  ]);

  clientId = stored.spotifyClientId || null;
  clientSecret = stored.spotifyClientSecret || null;

  // Try to restore existing token
  if (stored.spotifyToken && stored.spotifyTokenExpires > Date.now()) {
    accessToken = stored.spotifyToken;
    tokenExpiresAt = stored.spotifyTokenExpires;
    console.log('[Discotify] Restored Spotify token from storage');
    return;
  }

  // If we have credentials but no valid token, get a new one
  if (clientId && clientSecret) {
    console.log('[Discotify] Getting new token...');
    await getClientCredentialsToken();
  } else {
    console.log('[Discotify] No credentials configured yet');
  }
}

initialize();

// =============================================================================
// Credentials & Authentication
// =============================================================================

/**
 * Load credentials from storage and authenticate
 */
async function loadCredentialsAndAuthenticate() {
  const stored = await chrome.storage.local.get(['spotifyClientId', 'spotifyClientSecret']);

  clientId = stored.spotifyClientId || null;
  clientSecret = stored.spotifyClientSecret || null;

  if (!clientId || !clientSecret) {
    throw new Error('Credentials not configured');
  }

  return await getClientCredentialsToken();
}

/**
 * Get an access token using Client Credentials Flow
 */
async function getClientCredentialsToken() {
  if (!clientId || !clientSecret) {
    console.error('[Discotify] No credentials available');
    return false;
  }

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const response = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Discotify] Token request failed:', response.status, errorText);
      throw new Error(`Authentication failed (${response.status})`);
    }

    const data = await response.json();

    accessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 min early

    // Save to storage
    await chrome.storage.local.set({
      spotifyToken: accessToken,
      spotifyTokenExpires: tokenExpiresAt
    });

    console.log('[Discotify] Successfully obtained Spotify token');
    return true;
  } catch (error) {
    console.error('[Discotify] Failed to get token:', error);
    throw error;
  }
}

/**
 * Ensure we have a valid token
 */
async function ensureValidToken() {
  if (!clientId || !clientSecret) {
    return false;
  }

  if (!accessToken || Date.now() >= tokenExpiresAt) {
    return await getClientCredentialsToken();
  }
  return true;
}

// =============================================================================
// Album Search
// =============================================================================

/**
 * Search Spotify for an album matching the given metadata
 */
async function handleSpotifySearch(metadata) {
  console.log('[Discotify] Searching for album:', metadata);

  const hasToken = await ensureValidToken();

  if (!hasToken) {
    console.log('[Discotify] No valid token available');
    return null;
  }

  const { artist, album } = metadata;

  if (!artist && !album) {
    console.log('[Discotify] No search terms provided');
    return null;
  }

  // Clean search terms
  const cleanArtist = cleanSearchTerm(artist);
  const cleanAlbum = cleanSearchTerm(album);

  // Try search strategies in order of specificity
  const strategies = [
    // Strategy 1: Exact album + artist search
    () => searchAlbums(`album:"${cleanAlbum}" artist:"${cleanArtist}"`, cleanArtist, cleanAlbum),
    // Strategy 2: Album + artist without quotes
    () => searchAlbums(`album:${cleanAlbum} artist:${cleanArtist}`, cleanArtist, cleanAlbum),
    // Strategy 3: Simple combined search
    () => searchAlbums(`${cleanArtist} ${cleanAlbum}`, cleanArtist, cleanAlbum),
    // Strategy 4: Just album with artist filter in results
    () => searchAlbums(`"${cleanAlbum}"`, cleanArtist, cleanAlbum),
  ];

  for (const strategy of strategies) {
    const result = await strategy();
    if (result) {
      console.log('[Discotify] Found album:', result.name, 'by', result.artist);
      return result;
    }
  }

  console.log('[Discotify] No album match found');
  return null;
}

/**
 * Clean a search term for better matching
 */
function cleanSearchTerm(term) {
  if (!term) return '';

  return term
    // Remove Discogs disambiguation numbers like (2), (3)
    .replace(/\s*\(\d+\)\s*$/g, '')
    // Remove edition/version info in brackets
    .replace(/\s*\[.*?\]\s*/g, '')
    .replace(/\s*\(.*?edition.*?\)\s*/gi, '')
    .replace(/\s*\(.*?remaster.*?\)\s*/gi, '')
    .replace(/\s*\(.*?version.*?\)\s*/gi, '')
    .replace(/\s*\(.*?deluxe.*?\)\s*/gi, '')
    .replace(/\s*\(.*?bonus.*?\)\s*/gi, '')
    // Normalize quotes
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    // Clean whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search for albums on Spotify
 */
async function searchAlbums(query, expectedArtist, expectedAlbum) {
  try {
    // Only search for albums
    const url = `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(query)}&type=album&limit=20&market=US`;

    console.log('[Discotify] Query:', query);

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        accessToken = null;
        tokenExpiresAt = null;
        const refreshed = await getClientCredentialsToken();
        if (refreshed) {
          return searchAlbums(query, expectedArtist, expectedAlbum);
        }
      }
      console.error('[Discotify] Search failed:', response.status);
      return null;
    }

    const data = await response.json();
    const albums = data.albums?.items || [];

    if (albums.length === 0) {
      return null;
    }

    // Find the best matching album
    return findBestAlbumMatch(albums, expectedArtist, expectedAlbum);
  } catch (error) {
    console.error('[Discotify] Search error:', error);
    return null;
  }
}

/**
 * Find the best matching album from results
 */
function findBestAlbumMatch(albums, expectedArtist, expectedAlbum) {
  const normalizedArtist = normalizeForComparison(expectedArtist);
  const normalizedAlbum = normalizeForComparison(expectedAlbum);

  // Score each album
  const scored = albums.map(album => {
    let score = 0;

    const albumName = normalizeForComparison(album.name);
    const artistNames = album.artists.map(a => normalizeForComparison(a.name));

    // Album name matching (most important)
    if (albumName === normalizedAlbum) {
      score += 100; // Exact match
    } else if (albumName.includes(normalizedAlbum) || normalizedAlbum.includes(albumName)) {
      score += 60; // Partial match
    } else if (fuzzyMatch(albumName, normalizedAlbum) > 0.7) {
      score += 40; // Fuzzy match
    }

    // Artist matching
    const artistMatch = artistNames.some(name =>
      name === normalizedArtist ||
      name.includes(normalizedArtist) ||
      normalizedArtist.includes(name)
    );

    if (artistMatch) {
      score += 50;
    } else if (artistNames.some(name => fuzzyMatch(name, normalizedArtist) > 0.7)) {
      score += 25;
    }

    // Prefer full albums over singles/compilations
    if (album.album_type === 'album') {
      score += 15;
    } else if (album.album_type === 'single') {
      score -= 10;
    } else if (album.album_type === 'compilation') {
      score -= 5;
    }

    // Prefer albums with more tracks (likely to be the full album)
    if (album.total_tracks >= 8) {
      score += 5;
    }

    return { album, score };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Log top matches for debugging
  console.log('[Discotify] Top matches:', scored.slice(0, 3).map(s =>
    `${s.album.name} by ${s.album.artists[0]?.name} (score: ${s.score})`
  ));

  // Return best match if score is good enough
  const best = scored[0];
  if (best && best.score >= 50) {
    return {
      uri: best.album.uri,
      id: best.album.id,
      type: 'album',
      name: best.album.name,
      artist: best.album.artists?.[0]?.name,
      image: best.album.images?.[0]?.url,
      url: best.album.external_urls?.spotify,
      totalTracks: best.album.total_tracks
    };
  }

  return null;
}

/**
 * Normalize string for comparison
 */
function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, ' ')        // Replace special chars with space
    .replace(/\s+/g, ' ')            // Collapse whitespace
    .trim();
}

/**
 * Simple fuzzy matching (Dice coefficient)
 */
function fuzzyMatch(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const bigrams1 = getBigrams(str1);
  const bigrams2 = getBigrams(str2);

  let matches = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      matches++;
    }
  }

  return (2 * matches) / (bigrams1.size + bigrams2.size);
}

function getBigrams(str) {
  const bigrams = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

// =============================================================================
// Extension Lifecycle
// =============================================================================

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Discotify] Extension installed');
    chrome.storage.sync.set({ enabled: true });
  } else if (details.reason === 'update') {
    console.log('[Discotify] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Listen for credential changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    if (changes.spotifyClientId || changes.spotifyClientSecret) {
      console.log('[Discotify] Credentials changed, will re-authenticate on next request');
      // Clear token so it will be refreshed
      accessToken = null;
      tokenExpiresAt = null;

      // Update local values
      if (changes.spotifyClientId) {
        clientId = changes.spotifyClientId.newValue;
      }
      if (changes.spotifyClientSecret) {
        clientSecret = changes.spotifyClientSecret.newValue;
      }
    }
  }
});

// Refresh token periodically (every 50 minutes)
setInterval(async () => {
  if (clientId && clientSecret && accessToken) {
    console.log('[Discotify] Refreshing token...');
    await getClientCredentialsToken();
  }
}, 50 * 60 * 1000);
