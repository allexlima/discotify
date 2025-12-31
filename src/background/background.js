/**
 * Spotcogs Background Service Worker
 * Handles Spotify API authentication and search requests
 */

// Spotify API configuration
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';

// You'll need to register your app at https://developer.spotify.com/dashboard
// and replace these with your actual credentials
const CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID';

// Lazily get redirect URI to avoid errors during service worker initialization
function getRedirectUri() {
  return chrome.identity.getRedirectURL('spotify');
}

let accessToken = null;
let tokenExpiresAt = null;

// Message listener for content script requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SEARCH_SPOTIFY') {
    handleSpotifySearch(message.payload)
      .then(sendResponse)
      .catch((error) => {
        console.error('[Spotcogs] Search error:', error);
        sendResponse(null);
      });
    return true; // Keep the message channel open for async response
  }

  if (message.type === 'GET_AUTH_STATUS') {
    sendResponse({ isAuthenticated: !!accessToken && Date.now() < tokenExpiresAt });
    return true;
  }

  if (message.type === 'AUTHENTICATE') {
    authenticateSpotify()
      .then((success) => sendResponse({ success }))
      .catch((error) => {
        console.error('[Spotcogs] Auth error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (message.type === 'LOGOUT') {
    accessToken = null;
    tokenExpiresAt = null;
    chrome.storage.sync.remove(['spotifyToken', 'spotifyTokenExpires']);
    sendResponse({ success: true });
    return true;
  }
});

// Initialize: try to restore token from storage
chrome.storage.sync.get(['spotifyToken', 'spotifyTokenExpires'], (result) => {
  if (result.spotifyToken && result.spotifyTokenExpires > Date.now()) {
    accessToken = result.spotifyToken;
    tokenExpiresAt = result.spotifyTokenExpires;
    console.log('[Spotcogs] Restored Spotify token from storage');
  }
});

/**
 * Authenticate with Spotify using OAuth 2.0
 */
async function authenticateSpotify() {
  const scopes = ['user-read-private'];
  const state = generateRandomString(16);

  const authUrl = new URL(SPOTIFY_AUTH_URL);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', getRedirectUri());
  authUrl.searchParams.set('scope', scopes.join(' '));
  authUrl.searchParams.set('state', state);

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      {
        url: authUrl.toString(),
        interactive: true
      },
      (redirectUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!redirectUrl) {
          reject(new Error('No redirect URL received'));
          return;
        }

        // Extract token from URL hash
        const url = new URL(redirectUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);

        const token = params.get('access_token');
        const expiresIn = parseInt(params.get('expires_in'), 10);

        if (token) {
          accessToken = token;
          tokenExpiresAt = Date.now() + expiresIn * 1000;

          // Save to storage
          chrome.storage.sync.set({
            spotifyToken: accessToken,
            spotifyTokenExpires: tokenExpiresAt
          });

          console.log('[Spotcogs] Successfully authenticated with Spotify');
          resolve(true);
        } else {
          reject(new Error('No access token in response'));
        }
      }
    );
  });
}

/**
 * Search Spotify for an album matching the given metadata
 */
async function handleSpotifySearch(metadata) {
  // Ensure we have a valid token
  if (!accessToken || Date.now() >= tokenExpiresAt) {
    console.log('[Spotcogs] No valid token, searching without auth (limited)');
    return searchSpotifyWithoutAuth(metadata);
  }

  const { artist, album, year } = metadata;

  // Build search query
  let query = `album:${album}`;
  if (artist) {
    query += ` artist:${artist}`;
  }

  try {
    const response = await fetch(
      `${SPOTIFY_API_URL}/search?q=${encodeURIComponent(query)}&type=album&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear it
        accessToken = null;
        tokenExpiresAt = null;
        chrome.storage.sync.remove(['spotifyToken', 'spotifyTokenExpires']);
        return searchSpotifyWithoutAuth(metadata);
      }
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data = await response.json();
    return findBestMatch(data.albums?.items || [], metadata);
  } catch (error) {
    console.error('[Spotcogs] Spotify search error:', error);
    return null;
  }
}

/**
 * Search Spotify without authentication (uses embed endpoint)
 * This is a fallback that has more limited functionality
 */
async function searchSpotifyWithoutAuth(metadata) {
  const { artist, album } = metadata;
  const searchQuery = `${artist} ${album}`;

  try {
    // Use the Spotify oEmbed endpoint which doesn't require auth
    const response = await fetch(
      `https://open.spotify.com/oembed?url=https://open.spotify.com/search/${encodeURIComponent(searchQuery)}`
    );

    if (!response.ok) {
      return null;
    }

    // The oEmbed doesn't give us search results directly
    // We need to return a search link instead
    return null;
  } catch (error) {
    console.error('[Spotcogs] Fallback search error:', error);
    return null;
  }
}

/**
 * Find the best matching album from search results
 */
function findBestMatch(albums, metadata) {
  if (!albums || albums.length === 0) {
    return null;
  }

  const normalizedArtist = normalizeString(metadata.artist);
  const normalizedAlbum = normalizeString(metadata.album);

  // Score each album
  const scored = albums.map((album) => {
    let score = 0;

    // Check artist match
    const albumArtists = album.artists.map((a) => normalizeString(a.name));
    if (albumArtists.some((a) => a.includes(normalizedArtist) || normalizedArtist.includes(a))) {
      score += 50;
    }

    // Check album name match
    const albumName = normalizeString(album.name);
    if (albumName === normalizedAlbum) {
      score += 50;
    } else if (albumName.includes(normalizedAlbum) || normalizedAlbum.includes(albumName)) {
      score += 30;
    }

    // Bonus for release year match
    if (metadata.year && album.release_date) {
      const albumYear = album.release_date.split('-')[0];
      if (albumYear === metadata.year) {
        score += 20;
      }
    }

    return { album, score };
  });

  // Sort by score and get the best match
  scored.sort((a, b) => b.score - a.score);

  // Only return if we have a reasonable match (score > 50)
  if (scored[0].score >= 50) {
    const bestMatch = scored[0].album;
    return {
      uri: bestMatch.uri,
      type: 'album',
      name: bestMatch.name,
      artist: bestMatch.artists[0]?.name,
      image: bestMatch.images[0]?.url,
      url: bestMatch.external_urls?.spotify
    };
  }

  return null;
}

/**
 * Normalize a string for comparison
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a random string for OAuth state
 */
function generateRandomString(length) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Spotcogs] Extension installed');
    // Set default settings
    chrome.storage.sync.set({ enabled: true });
  } else if (details.reason === 'update') {
    console.log('[Spotcogs] Extension updated to version', chrome.runtime.getManifest().version);
  }
});
