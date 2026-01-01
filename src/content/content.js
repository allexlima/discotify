/**
 * Spotcogs Content Script
 * Detects Apple Music embeds on Discogs and replaces them with Spotify players
 */

class Spotcogs {
  constructor() {
    this.isEnabled = true;
    // Selectors for Apple Music elements on Discogs
    // Discogs uses MusicKit JS widgets, not iframes
    this.appleMusicSelectors = [
      // Discogs-specific selectors for the Apple Music section
      '.audio_player_apple',
      '#release-apple-music',
      '[class*="AppleMusic"]',
      '[class*="apple-music"]',
      '[class*="appleMusic"]',
      // MusicKit JS elements
      'apple-music-card-player',
      'apple-music-artwork',
      '[data-apple-music]',
      // Generic iframe selectors (fallback)
      'iframe[src*="embed.music.apple.com"]',
      'iframe[src*="tools.applemusic.com"]',
      'iframe[src*="music.apple.com"]'
    ];
    this.processed = false;
    this.processing = false; // Lock to prevent concurrent processing
    this.currentUrl = window.location.href;
    this.init();
  }

  async init() {
    // Check if extension is enabled
    const settings = await this.getSettings();
    this.isEnabled = settings.enabled !== false;

    if (!this.isEnabled) {
      console.log('[Spotcogs] Extension is disabled');
      return;
    }

    console.log('[Spotcogs] Initializing on:', window.location.href);

    // Wait a bit for dynamic content to load
    setTimeout(() => this.processPage(), 1000);

    // Also watch for dynamically added content
    this.observeDOM();

    // Watch for SPA navigation (URL changes without page reload)
    this.observeUrlChanges();
  }

  observeUrlChanges() {
    // Check for URL changes periodically (handles pushState/replaceState)
    setInterval(() => {
      if (window.location.href !== this.currentUrl) {
        console.log('[Spotcogs] URL changed, resetting...');
        this.handleNavigation();
      }
    }, 500);

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      console.log('[Spotcogs] Popstate detected, resetting...');
      this.handleNavigation();
    });
  }

  handleNavigation() {
    this.currentUrl = window.location.href;
    this.processed = false;
    this.processing = false;

    // Remove existing Spotify players from the previous page
    this.cleanupPlayers();

    // Process the new page after a delay for content to load
    setTimeout(() => this.processPage(), 1000);
  }

  cleanupPlayers() {
    const existingPlayers = document.querySelectorAll('.spotcogs-player-container, .spotcogs-no-match');
    existingPlayers.forEach(player => {
      console.log('[Spotcogs] Removing old player');
      player.remove();
    });
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['enabled', 'spotifyToken'], (result) => {
        resolve(result);
      });
    });
  }

  processPage() {
    // Check if already processed or currently processing
    if (this.processed || this.processing) return;

    // Check if we already have a Spotify player on the page
    if (document.querySelector('.spotcogs-player-container')) {
      this.processed = true;
      return;
    }

    // Set processing lock immediately
    this.processing = true;

    // First, try to find Apple Music embeds with selectors
    let embeds = this.findAppleMusicEmbeds();
    console.log(`[Spotcogs] Found ${embeds.length} Apple Music embed(s) via selectors`);

    // If no embeds found via selectors, try to find the Audio section on Discogs
    if (embeds.length === 0) {
      const audioSection = this.findDiscogsAudioSection();
      if (audioSection) {
        console.log('[Spotcogs] Found Discogs audio section');
        embeds = [audioSection];
      }
    }

    if (embeds.length === 0) {
      console.log('[Spotcogs] No Apple Music content found on this page');
      // Still try to add Spotify player if we're on a release page
      if (this.isReleasePage()) {
        console.log('[Spotcogs] This is a release page, adding Spotify player');
        this.processed = true;
        this.addSpotifyPlayerToPage();
      } else {
        this.processing = false; // Release lock if not processing
      }
      return;
    }

    // Mark as processed
    this.processed = true;

    // Only process the FIRST embed to avoid duplicates
    this.replaceEmbed(embeds[0]);
  }

  findAppleMusicEmbeds() {
    const embeds = [];
    this.appleMusicSelectors.forEach((selector) => {
      try {
        document.querySelectorAll(selector).forEach((el) => {
          if (!embeds.includes(el)) {
            embeds.push(el);
          }
        });
      } catch (e) {
        // Invalid selector, skip
      }
    });
    return embeds;
  }

  findDiscogsAudioSection() {
    // Look for the "Áudio" / "Audio" section on Discogs release pages
    // This section contains the Apple Music widget

    // Try to find by section header text
    const headers = document.querySelectorAll('h3, h4, .header, [class*="header"]');
    for (const header of headers) {
      const text = header.textContent.toLowerCase().trim();
      if (text === 'audio' || text === 'áudio' || text === 'オーディオ') {
        // Found audio header, look for the parent section or next sibling
        const section = header.closest('section') ||
                        header.closest('[class*="section"]') ||
                        header.parentElement;
        if (section) {
          // Check if it contains Apple Music content
          const hasAppleMusic = section.innerHTML.toLowerCase().includes('apple') ||
                                section.innerHTML.toLowerCase().includes('music.apple');
          if (hasAppleMusic) {
            return section;
          }
        }
      }
    }

    // Try to find by looking for Apple Music logo/branding
    const appleElements = document.querySelectorAll('[class*="apple"], [class*="Apple"], img[src*="apple"], img[alt*="Apple"]');
    for (const el of appleElements) {
      const container = el.closest('section') ||
                        el.closest('[class*="section"]') ||
                        el.closest('aside') ||
                        el.parentElement?.parentElement;
      if (container && container.innerHTML.toLowerCase().includes('music')) {
        return container;
      }
    }

    // Look for MusicKit specific elements
    const musicKitElements = document.querySelectorAll('[class*="musickit"], [class*="MusicKit"]');
    if (musicKitElements.length > 0) {
      return musicKitElements[0].closest('section') || musicKitElements[0].parentElement;
    }

    return null;
  }

  isReleasePage() {
    // Check if we're on a Discogs release page
    const url = window.location.pathname;
    return url.includes('/release/') || url.includes('/master/');
  }

  async addSpotifyPlayerToPage() {
    // Add Spotify player even if no Apple Music embed was found
    const metadata = this.extractDiscogsMetadata();

    if (!metadata.artist || !metadata.album) {
      console.log('[Spotcogs] Could not extract metadata from page');
      return;
    }

    console.log(`[Spotcogs] Searching Spotify for: ${metadata.artist} - ${metadata.album}`);

    const spotifyData = await this.searchSpotify(metadata);

    if (spotifyData && spotifyData.uri) {
      // Find a good place to insert the Spotify player
      const targetLocation = this.findInsertLocation();
      if (targetLocation) {
        this.insertSpotifyPlayer(targetLocation, spotifyData);
      }
    } else {
      console.log('[Spotcogs] No Spotify match found');
    }
  }

  findInsertLocation() {
    // Find the best location to insert the Spotify player
    // Priority: sidebar, after release info, etc.

    // Look for the sidebar/right column
    const sidebar = document.querySelector('.body aside') ||
                    document.querySelector('[class*="sidebar"]') ||
                    document.querySelector('[class*="Sidebar"]') ||
                    document.querySelector('.right');

    if (sidebar) return { element: sidebar, position: 'prepend' };

    // Look for after the main release info
    const releaseInfo = document.querySelector('#release-stats') ||
                        document.querySelector('[class*="release-stats"]') ||
                        document.querySelector('[class*="statistics"]');

    if (releaseInfo) return { element: releaseInfo, position: 'after' };

    return null;
  }

  insertSpotifyPlayer(location, spotifyData) {
    // Final check to prevent duplicates
    if (document.querySelector('.spotcogs-player-container')) {
      console.log('[Spotcogs] Player already exists, skipping insert');
      return;
    }

    const container = this.createSpotifyContainer(spotifyData);

    if (location.position === 'prepend') {
      location.element.prepend(container);
    } else if (location.position === 'after') {
      location.element.after(container);
    } else {
      location.element.appendChild(container);
    }

    console.log('[Spotcogs] Inserted Spotify player');
  }

  async replaceEmbed(embed) {
    try {
      const metadata = this.extractDiscogsMetadata();

      if (!metadata.artist || !metadata.album) {
        console.log('[Spotcogs] Could not extract metadata from page');
        console.log('[Spotcogs] Page title:', document.title);
        return;
      }

      console.log(`[Spotcogs] Searching Spotify for: ${metadata.artist} - ${metadata.album}`);

      const spotifyData = await this.searchSpotify(metadata);

      if (spotifyData && spotifyData.uri) {
        this.createSpotifyPlayer(embed, spotifyData);
      } else {
        console.log('[Spotcogs] No Spotify match found');
        this.showNoMatchMessage(embed, metadata);
      }
    } catch (error) {
      console.error('[Spotcogs] Error replacing embed:', error);
    }
  }

  extractDiscogsMetadata() {
    const metadata = {
      artist: null,
      album: null,
      year: null
    };

    console.log('[Spotcogs] Extracting metadata...');

    // Method 1: Try profile_title structure (older Discogs layout)
    const profileTitle = document.querySelector('#profile_title');
    if (profileTitle) {
      const artistLink = profileTitle.querySelector('a[href*="/artist/"]');
      if (artistLink) {
        metadata.artist = artistLink.textContent.trim();
      }

      const titleSpan = profileTitle.querySelector('span[itemprop="name"]');
      if (titleSpan) {
        metadata.album = titleSpan.textContent.trim();
      }
    }

    // Method 2: Try the page header (modern Discogs layout)
    if (!metadata.artist) {
      // Look for artist in the page title area
      const artistLinks = document.querySelectorAll('a[href*="/artist/"]');
      for (const link of artistLinks) {
        // Get the first artist link that's likely the main artist
        if (link.closest('h1, h2, [class*="title"], [class*="header"]')) {
          metadata.artist = link.textContent.trim();
          break;
        }
      }
      // Fallback: first artist link on page
      if (!metadata.artist && artistLinks.length > 0) {
        metadata.artist = artistLinks[0].textContent.trim();
      }
    }

    // Method 3: Try to get album from title element
    if (!metadata.album) {
      const titleElement = document.querySelector('h1[class*="title"], h1.title, [class*="release_title"]');
      if (titleElement) {
        let title = titleElement.textContent.trim();
        // Remove artist name if present (format: "Artist – Album")
        if (metadata.artist && title.includes('–')) {
          title = title.split('–').pop().trim();
        } else if (metadata.artist && title.includes('-')) {
          title = title.split('-').pop().trim();
        }
        metadata.album = title;
      }
    }

    // Method 4: Parse from document title (last resort)
    if (!metadata.artist || !metadata.album) {
      const docTitle = document.title;
      // Discogs title format: "Artist - Album | Discogs" or "Artist – Album | Discogs"
      const match = docTitle.match(/^(.+?)\s*[-–]\s*(.+?)\s*\|/);
      if (match) {
        if (!metadata.artist) metadata.artist = match[1].trim();
        if (!metadata.album) metadata.album = match[2].trim();
      }
    }

    // Get year
    const yearLink = document.querySelector('a[href*="/year/"]');
    if (yearLink) {
      metadata.year = yearLink.textContent.trim();
    }

    console.log('[Spotcogs] Extracted metadata:', metadata);
    return metadata;
  }

  async searchSpotify(metadata) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'SEARCH_SPOTIFY',
          payload: metadata
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Spotcogs] Message error:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  createSpotifyContainer(spotifyData) {
    const container = document.createElement('div');
    container.className = 'spotcogs-player-container';

    const spotifyId = spotifyData.uri.split(':').pop();
    const embedType = spotifyData.type || 'album';

    // Add header
    const header = document.createElement('div');
    header.className = 'spotcogs-header';
    header.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#1DB954">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
      </svg>
      <span>Listen on Spotify</span>
    `;

    const iframe = document.createElement('iframe');
    iframe.src = `https://open.spotify.com/embed/${embedType}/${spotifyId}?utm_source=generator&theme=0`;
    iframe.width = '100%';
    iframe.height = '352';
    iframe.frameBorder = '0';
    iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    iframe.loading = 'lazy';
    iframe.className = 'spotcogs-spotify-embed';

    container.appendChild(header);
    container.appendChild(iframe);

    return container;
  }

  createSpotifyPlayer(originalEmbed, spotifyData) {
    // Final check to prevent duplicates
    if (document.querySelector('.spotcogs-player-container')) {
      console.log('[Spotcogs] Player already exists, skipping replace');
      return;
    }

    const container = this.createSpotifyContainer(spotifyData);

    // Replace the original embed
    originalEmbed.parentNode.replaceChild(container, originalEmbed);
    console.log('[Spotcogs] Successfully replaced Apple Music embed with Spotify player');
  }

  showNoMatchMessage(originalEmbed, metadata) {
    const container = document.createElement('div');
    container.className = 'spotcogs-no-match';
    container.innerHTML = `
      <div class="spotcogs-no-match-content">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="#1DB954">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
        <p>No Spotify match found for:</p>
        <p class="spotcogs-search-term">${metadata.artist} - ${metadata.album}</p>
        <a href="https://open.spotify.com/search/${encodeURIComponent(`${metadata.artist} ${metadata.album}`)}"
           target="_blank"
           class="spotcogs-search-link">
          Search on Spotify
        </a>
      </div>
    `;

    originalEmbed.parentNode.replaceChild(container, originalEmbed);
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      // Skip if already processed, currently processing, or player exists
      if (this.processed || this.processing) return;
      if (document.querySelector('.spotcogs-player-container')) return;

      let shouldProcess = false;

      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if any Apple Music related content was added
              const html = node.innerHTML || '';
              if (html.toLowerCase().includes('apple') &&
                  html.toLowerCase().includes('music')) {
                shouldProcess = true;
              }

              // Also check our selectors
              const hasEmbed = this.appleMusicSelectors.some((selector) => {
                try {
                  return node.matches?.(selector) || node.querySelector?.(selector);
                } catch {
                  return false;
                }
              });
              if (hasEmbed) shouldProcess = true;
            }
          });
        }
      });

      if (shouldProcess) {
        setTimeout(() => this.processPage(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new Spotcogs());
} else {
  new Spotcogs();
}
