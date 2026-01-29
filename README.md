# 🎵 Discotify

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-Install-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/discotify/ghbmjpggoefbcffdflkjnddhlibchlch)
[![Chrome](https://img.shields.io/badge/Chrome-supported-4285F4?logo=googlechrome&logoColor=white)](https://chrome.google.com)
[![Edge](https://img.shields.io/badge/Edge-supported-0078D7?logo=microsoftedge&logoColor=white)](https://www.microsoft.com/edge)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Replace Apple Music with Spotify on Discogs release pages

<p align="center">
  <img src="icons/icon128.png" alt="Discotify" width="100" height="100">
</p>

**Discotify** is a Chrome extension that automatically replaces Apple Music embeds on [Discogs](https://www.discogs.com) with Spotify players. Browse vinyl releases and listen instantly on your preferred streaming service.

---

## ✨ Features

| Feature              | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| 🔄 **Auto-Replace**   | Detects Apple Music players and swaps them with Spotify     |
| 🎯 **Smart Matching** | Fuzzy search algorithm finds the right album                |
| 🌍 **Multi-language** | Works on all Discogs locales (`/de/`, `/ja/`, `/fr/`, etc.) |
| 🎨 **Native Look**    | Dark-themed player matches Discogs aesthetic                |
| ⚡ **SPA Support**    | Works with Discogs' client-side navigation                  |
| 🔒 **Privacy First**  | Credentials stored locally, never shared                    |

---

## 🚀 Quick Start

### 1. Install the Extension

#### Option A: Chrome Web Store (Recommended)

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/discotify/ghbmjpggoefbcffdflkjnddhlibchlch)

#### Option B: Manual Installation (Development)

```bash
git clone https://github.com/allexlima/discotify.git
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `discotify` folder

### 2. Get Spotify API Credentials (~2 min)

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **Create App**
3. Fill in:
   - **Name**: `Discotify`
   - **Redirect URI**: Copy from the extension popup
   - Check **Web API**
4. Save → **Settings** → Copy **Client ID** and **Client Secret**

### 3. Connect

1. Click the Discotify extension icon
2. Paste your credentials
3. Click **Save & Connect**

✅ Done! Visit any [Discogs release page](https://www.discogs.com/release/9322620-Pink-Floyd-Meddle) to see it in action.

---

## 📖 How It Works

```
Discogs Page → Detect Apple Music → Extract Metadata → Search Spotify → Embed Player
```

1. **Detection**: Scans for Apple Music widgets or audio sections
2. **Extraction**: Parses artist and album from page metadata
3. **Search**: Queries Spotify API with multiple search strategies
4. **Matching**: Scores results using fuzzy matching algorithm
5. **Display**: Embeds the best match as a Spotify player

---

## 🔧 Configuration

### Extension Popup

| Status         | Meaning                     |
| -------------- | --------------------------- |
| 🟢 Connected    | Ready to use                |
| 🟡 Checking     | Validating credentials      |
| 🔴 Error        | Check your Client ID/Secret |
| ⚪ Setup needed | Enter credentials           |

### Why API Keys?

Spotify requires authentication for search. The extension uses **Client Credentials Flow**:

- ✅ No Spotify login required
- ✅ Free account works
- ✅ Keys stay in your browser
- ✅ Auto-refreshes tokens

---

## 🗂️ Project Structure

```
discotify/
├── manifest.json          # Extension manifest (V3)
├── package.json           # Dev dependencies
├── icons/                 # Extension icons (SVG + PNGs)
└── src/
    ├── background/
    │   └── background.js  # Spotify API, auth, search
    ├── content/
    │   ├── content.js     # Page detection & injection
    │   └── styles.css     # Player styles
    └── popup/
        ├── popup.html     # Settings UI
        ├── popup.css
        └── popup.js
```

---

## 🛠️ Development

### Setup (optional, for linting)

```bash
npm install          # Install dev dependencies
npm run lint         # ESLint check
npm run format       # Prettier format
```

### Workflow

1. Edit files in `src/`
2. Go to `chrome://extensions/` → Click 🔄 on Discotify
3. Refresh the Discogs page

### Debugging

| Component      | How to Debug                                       |
| -------------- | -------------------------------------------------- |
| Content Script | DevTools Console on Discogs → filter `[Discotify]` |
| Background     | `chrome://extensions/` → "Service Worker" link     |
| Popup          | Right-click extension icon → "Inspect Popup"       |

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 🚀 Automated Deployment

This project uses GitHub Actions to automatically deploy new versions to the Chrome Web Store.

### For Maintainers: How to Release a New Version

1. **Update the code** and ensure all changes are committed to the `main` branch

2. **Create and push a version tag**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

3. **Automatic deployment** happens via GitHub Actions:
   - Updates `manifest.json` with the new version
   - Creates a production-ready zip file
   - Uploads to Chrome Web Store
   - Publishes the extension
   - Creates a GitHub release

### Version Naming Convention

Follow [Semantic Versioning](https://semver.org/):
- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features, backward compatible)
- `v1.0.1` - Patch release (bug fixes)

### Setup Requirements (One-time)

To enable automated deployment, the following GitHub repository secrets must be configured:

| Secret                 | Description         | How to Get                                           |
| ---------------------- | ------------------- | ---------------------------------------------------- |
| `CHROME_CLIENT_ID`     | OAuth Client ID     | Google Cloud Console → APIs & Services → Credentials |
| `CHROME_CLIENT_SECRET` | OAuth Client Secret | Same as above                                        |
| `CHROME_REFRESH_TOKEN` | OAuth Refresh Token | Run `npm run get-refresh-token`                      |
| `CHROME_EXTENSION_ID`  | Extension ID        | `ghbmjpggoefbcffdflkjnddhlibchlch`                   |

#### Getting Chrome Web Store API Credentials

1. **Enable Chrome Web Store API**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Navigate to "APIs & Services" → "Enable APIs and Services"
   - Search for "Chrome Web Store API" and enable it

2. **Create OAuth Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Desktop app" or "Web application"
   - Add redirect URI: `http://localhost:8080/oauth2callback`
   - Save your Client ID and Client Secret

3. **Generate Refresh Token**:
   ```bash
   npm install
   npm run get-refresh-token
   ```
   Follow the prompts to authorize and obtain your refresh token.

4. **Add Secrets to GitHub**:
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add all four secrets listed above

### Manual Build & Testing

To test the build process locally:

```bash
npm install
npm run build
```

This creates `dist/extension.zip` ready for Chrome Web Store upload.

---

## ⚠️ Disclaimer

This extension is **not affiliated with** Spotify, Apple, or Discogs. All trademarks belong to their respective owners.

---

<p align="center">
  Vibecoded by <a href="https://github.com/allexlima">Allex</a> with 💚 for vinyl lovers
</p>
