/**
 * Spotcogs Popup Script
 * Handles extension settings and Spotify authentication UI
 */

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabled-toggle');
  const authStatus = document.getElementById('auth-status');
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');

  // Load current settings
  loadSettings();
  checkAuthStatus();

  // Event listeners
  enabledToggle.addEventListener('change', handleToggleChange);
  connectBtn.addEventListener('click', handleConnect);
  disconnectBtn.addEventListener('click', handleDisconnect);

  /**
   * Load extension settings from storage
   */
  function loadSettings() {
    chrome.storage.sync.get(['enabled'], (result) => {
      enabledToggle.checked = result.enabled !== false;
    });
  }

  /**
   * Handle enable/disable toggle change
   */
  function handleToggleChange(e) {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ enabled });

    // Notify content scripts about the change (includes all translated pages)
    chrome.tabs.query({ url: ['*://www.discogs.com/*', '*://discogs.com/*', '*://*.discogs.com/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED', enabled }).catch(() => {
          // Tab might not have content script loaded
        });
      });
    });
  }

  /**
   * Check Spotify authentication status
   */
  function checkAuthStatus() {
    const statusIndicator = authStatus.querySelector('.status-indicator');
    const statusText = authStatus.querySelector('span');

    statusIndicator.className = 'status-indicator checking';
    statusText.textContent = 'Checking...';

    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
      if (response && response.isAuthenticated) {
        showConnectedState();
      } else {
        showDisconnectedState();
      }
    });
  }

  /**
   * Show connected state UI
   */
  function showConnectedState() {
    const statusIndicator = authStatus.querySelector('.status-indicator');
    const statusText = authStatus.querySelector('span');

    statusIndicator.className = 'status-indicator connected';
    statusText.textContent = 'Connected to Spotify';

    connectBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
  }

  /**
   * Show disconnected state UI
   */
  function showDisconnectedState() {
    const statusIndicator = authStatus.querySelector('.status-indicator');
    const statusText = authStatus.querySelector('span');

    statusIndicator.className = 'status-indicator not-connected';
    statusText.textContent = 'Not connected';

    connectBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
  }

  /**
   * Handle connect button click
   */
  function handleConnect() {
    const statusIndicator = authStatus.querySelector('.status-indicator');
    const statusText = authStatus.querySelector('span');

    connectBtn.disabled = true;
    connectBtn.textContent = 'Connecting...';
    statusIndicator.className = 'status-indicator checking';
    statusText.textContent = 'Authenticating...';

    chrome.runtime.sendMessage({ type: 'AUTHENTICATE' }, (response) => {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Connect to Spotify';

      if (response && response.success) {
        showConnectedState();
      } else {
        showDisconnectedState();
        if (response && response.error) {
          statusText.textContent = `Error: ${response.error}`;
        }
      }
    });
  }

  /**
   * Handle disconnect button click
   */
  function handleDisconnect() {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => {
      showDisconnectedState();
    });
  }
});
