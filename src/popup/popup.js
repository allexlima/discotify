/**
 * Discotify Popup Script
 * Handles extension settings and Spotify API configuration
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const enabledToggle = document.getElementById('enabled-toggle');
  const statusCard = document.getElementById('status-card');
  const clientIdInput = document.getElementById('client-id');
  const clientSecretInput = document.getElementById('client-secret');
  const toggleSecretBtn = document.getElementById('toggle-secret');
  const saveCredentialsBtn = document.getElementById('save-credentials');
  const redirectUriEl = document.getElementById('redirect-uri');
  const copyRedirectUriBtn = document.getElementById('copy-redirect-uri');
  const closePopupBtn = document.getElementById('close-popup');

  // Debounce timer for auto-save
  let saveTimer = null;

  // Initialize
  init();

  async function init() {
    await loadSettings();
    await loadCredentials();
    displayRedirectUri();
    checkAuthStatus();
    setupEventListeners();
  }

  function setupEventListeners() {
    enabledToggle.addEventListener('change', handleToggleChange);
    toggleSecretBtn.addEventListener('click', toggleSecretVisibility);
    saveCredentialsBtn.addEventListener('click', saveAndConnect);
    copyRedirectUriBtn.addEventListener('click', copyRedirectUri);
    closePopupBtn.addEventListener('click', () => window.close());

    // Auto-save credentials as user types (with debounce)
    clientIdInput.addEventListener('input', autoSaveCredentials);
    clientSecretInput.addEventListener('input', autoSaveCredentials);

    // Save on blur as well
    clientIdInput.addEventListener('blur', saveCredentialsToStorage);
    clientSecretInput.addEventListener('blur', saveCredentialsToStorage);
  }

  /**
   * Load extension settings
   */
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['enabled'], (result) => {
        enabledToggle.checked = result.enabled !== false;
        resolve();
      });
    });
  }

  /**
   * Load saved credentials from storage
   */
  async function loadCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['spotifyClientId', 'spotifyClientSecret'], (result) => {
        if (result.spotifyClientId) {
          clientIdInput.value = result.spotifyClientId;
        }
        if (result.spotifyClientSecret) {
          clientSecretInput.value = result.spotifyClientSecret;
        }
        resolve();
      });
    });
  }

  /**
   * Auto-save credentials with debounce
   */
  function autoSaveCredentials() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCredentialsToStorage, 500);
  }

  /**
   * Save credentials to storage (without connecting)
   */
  async function saveCredentialsToStorage() {
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();

    await chrome.storage.local.set({
      spotifyClientId: clientId,
      spotifyClientSecret: clientSecret
    });
  }

  /**
   * Display full redirect URI
   */
  function displayRedirectUri() {
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;
    redirectUriEl.textContent = redirectUri;
  }

  /**
   * Copy redirect URI to clipboard
   */
  async function copyRedirectUri() {
    const extensionId = chrome.runtime.id;
    const redirectUri = `https://${extensionId}.chromiumapp.org/`;

    try {
      await navigator.clipboard.writeText(redirectUri);

      // Visual feedback
      const iconCopy = copyRedirectUriBtn.querySelector('.icon-copy');
      const iconCheck = copyRedirectUriBtn.querySelector('.icon-check');

      iconCopy.style.display = 'none';
      iconCheck.style.display = 'block';
      copyRedirectUriBtn.classList.add('copied');

      setTimeout(() => {
        iconCopy.style.display = 'block';
        iconCheck.style.display = 'none';
        copyRedirectUriBtn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  /**
   * Toggle secret visibility
   */
  function toggleSecretVisibility() {
    const isPassword = clientSecretInput.type === 'password';
    clientSecretInput.type = isPassword ? 'text' : 'password';

    const iconShow = toggleSecretBtn.querySelector('.icon-show');
    const iconHide = toggleSecretBtn.querySelector('.icon-hide');

    iconShow.style.display = isPassword ? 'none' : 'block';
    iconHide.style.display = isPassword ? 'block' : 'none';
    toggleSecretBtn.classList.toggle('active', isPassword);
  }

  /**
   * Handle enable/disable toggle
   */
  function handleToggleChange(e) {
    const enabled = e.target.checked;
    chrome.storage.sync.set({ enabled });

    // Notify content scripts
    chrome.tabs.query({ url: ['*://www.discogs.com/*', '*://discogs.com/*', '*://*.discogs.com/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED', enabled }).catch(() => {});
      });
    });
  }

  /**
   * Save credentials and connect to Spotify
   */
  async function saveAndConnect() {
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();

    if (!clientId || !clientSecret) {
      showStatus('error', 'Please enter both Client ID and Secret');
      return;
    }

    if (clientId.length < 10 || clientSecret.length < 10) {
      showStatus('error', 'Invalid credentials format');
      return;
    }

    saveCredentialsBtn.disabled = true;
    saveCredentialsBtn.innerHTML = `
      <svg class="spinner" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
      </svg>
      Connecting...
    `;
    showStatus('checking', 'Validating credentials...');

    // Save to storage first
    await chrome.storage.local.set({
      spotifyClientId: clientId,
      spotifyClientSecret: clientSecret
    });

    // Tell background to authenticate
    chrome.runtime.sendMessage({ type: 'AUTHENTICATE' }, (response) => {
      saveCredentialsBtn.disabled = false;
      saveCredentialsBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        Save & Connect
      `;

      if (response && response.success) {
        showStatus('connected', 'Connected to Spotify API');
      } else {
        const errorMsg = response?.error || 'Connection failed';
        showStatus('error', errorMsg);
      }
    });
  }

  /**
   * Check authentication status
   */
  function checkAuthStatus() {
    showStatus('checking', 'Checking connection...');

    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('error', 'Extension error');
        return;
      }

      if (!response) {
        showStatus('error', 'No response from background');
        return;
      }

      if (response.isAuthenticated) {
        showStatus('connected', 'Connected to Spotify API');
      } else if (response.isConfigured) {
        showStatus('not-connected', 'Not connected - click Save & Connect');
      } else {
        showStatus('not-configured', 'Enter your credentials above');
      }
    });
  }

  /**
   * Show status message
   */
  function showStatus(type, message) {
    const indicator = statusCard.querySelector('.status-indicator');
    const label = statusCard.querySelector('.status-label');

    // Reset classes
    statusCard.className = 'status-card';
    indicator.className = 'status-indicator';

    // Set message
    label.textContent = message;

    // Set styles based on type
    switch (type) {
      case 'connected':
        indicator.classList.add('connected');
        statusCard.classList.add('connected');
        break;
      case 'checking':
        indicator.classList.add('checking');
        break;
      case 'error':
        indicator.classList.add('error');
        statusCard.classList.add('error');
        break;
      default:
        indicator.classList.add('not-connected');
    }
  }
});

// Spinner animation is now defined in popup.css
