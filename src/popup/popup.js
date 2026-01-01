/**
 * Discotify Popup Script
 * Handles extension settings and Spotify API configuration
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const enabledToggle = document.getElementById('enabled-toggle');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const clientIdInput = document.getElementById('client-id');
  const clientSecretInput = document.getElementById('client-secret');
  const toggleSecretBtn = document.getElementById('toggle-secret');
  const saveCredentialsBtn = document.getElementById('save-credentials');
  const redirectUriEl = document.getElementById('redirect-uri');
  const copyRedirectUriBtn = document.getElementById('copy-redirect-uri');

  // Debounce timer
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

    clientIdInput.addEventListener('input', autoSaveCredentials);
    clientSecretInput.addEventListener('input', autoSaveCredentials);
    clientIdInput.addEventListener('blur', saveCredentialsToStorage);
    clientSecretInput.addEventListener('blur', saveCredentialsToStorage);
  }

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['enabled'], (result) => {
        enabledToggle.checked = result.enabled !== false;
        resolve();
      });
    });
  }

  async function loadCredentials() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['spotifyClientId', 'spotifyClientSecret'], (result) => {
        if (result.spotifyClientId) clientIdInput.value = result.spotifyClientId;
        if (result.spotifyClientSecret) clientSecretInput.value = result.spotifyClientSecret;
        resolve();
      });
    });
  }

  function autoSaveCredentials() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCredentialsToStorage, 500);
  }

  async function saveCredentialsToStorage() {
    await chrome.storage.local.set({
      spotifyClientId: clientIdInput.value.trim(),
      spotifyClientSecret: clientSecretInput.value.trim()
    });
  }

  function displayRedirectUri() {
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    redirectUriEl.textContent = redirectUri;
  }

  async function copyRedirectUri() {
    const redirectUri = `https://${chrome.runtime.id}.chromiumapp.org/`;
    try {
      await navigator.clipboard.writeText(redirectUri);
      const iconCopy = copyRedirectUriBtn.querySelector('.icon-copy');
      const iconCheck = copyRedirectUriBtn.querySelector('.icon-check');
      iconCopy.style.display = 'none';
      iconCheck.style.display = 'block';
      copyRedirectUriBtn.classList.add('copied');
      setTimeout(() => {
        iconCopy.style.display = 'block';
        iconCheck.style.display = 'none';
        copyRedirectUriBtn.classList.remove('copied');
      }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function toggleSecretVisibility() {
    const isPassword = clientSecretInput.type === 'password';
    clientSecretInput.type = isPassword ? 'text' : 'password';
    toggleSecretBtn.querySelector('.icon-show').style.display = isPassword ? 'none' : 'block';
    toggleSecretBtn.querySelector('.icon-hide').style.display = isPassword ? 'block' : 'none';
  }

  function handleToggleChange(e) {
    chrome.storage.sync.set({ enabled: e.target.checked });
    chrome.tabs.query({ url: ['*://www.discogs.com/*', '*://discogs.com/*', '*://*.discogs.com/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_CHANGED', enabled: e.target.checked }).catch(() => {});
      });
    });
  }

  async function saveAndConnect() {
    const clientId = clientIdInput.value.trim();
    const clientSecret = clientSecretInput.value.trim();

    if (!clientId || !clientSecret) {
      showStatus('error', 'Missing credentials');
      return;
    }

    if (clientId.length < 10 || clientSecret.length < 10) {
      showStatus('error', 'Invalid format');
      return;
    }

    saveCredentialsBtn.disabled = true;
    const btnIcon = saveCredentialsBtn.querySelector('.btn-icon');
    const btnText = saveCredentialsBtn.querySelector('.btn-text');
    if (btnIcon) btnIcon.outerHTML = '<svg class="btn-icon spinner" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>';
    if (btnText) btnText.textContent = 'Connecting...';
    showStatus('checking', 'Connecting...');

    await chrome.storage.local.set({ spotifyClientId: clientId, spotifyClientSecret: clientSecret });

    chrome.runtime.sendMessage({ type: 'AUTHENTICATE' }, (response) => {
      saveCredentialsBtn.disabled = false;
      const icon = saveCredentialsBtn.querySelector('.btn-icon');
      if (icon) icon.outerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
      const text = saveCredentialsBtn.querySelector('.btn-text');
      if (text) text.textContent = 'Save & Connect';

      if (response?.success) {
        showStatus('connected', 'Connected');
      } else {
        showStatus('error', response?.error || 'Failed');
      }
    });
  }

  function checkAuthStatus() {
    showStatus('checking', 'Checking...');
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATUS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        showStatus('error', 'Error');
        return;
      }
      if (response.isAuthenticated) {
        showStatus('connected', 'Connected');
      } else if (response.isConfigured) {
        showStatus('not-connected', 'Not connected');
      } else {
        showStatus('not-configured', 'Setup needed');
      }
    });
  }

  function showStatus(type, message) {
    statusDot.className = 'status-dot ' + type;
    statusText.className = 'status-text ' + type;
    statusText.textContent = message;
  }
});
