# 🎵 Discotify

> Replace Apple Music player with Spotify on Discogs

<p align="center">
  <img src="icons/icon128.png" alt="Discotify Logo" width="128" height="128">
</p>

Discotify is a Chrome extension that automatically detects Apple Music embeds on [Discogs](https://www.discogs.com) release pages and replaces them with Spotify players, giving you seamless access to your preferred streaming service.

## ✨ Features

- **Automatic Detection**: Finds Apple Music embeds on Discogs release pages
- **Multi-language Support**: Works on all Discogs translated pages (`/de/`, `/ja/`, `/fr/`, etc.)
- **Smart Matching**: Uses Spotify's search API to find the matching album
- **Seamless Replacement**: Replaces Apple Music players with embedded Spotify players
- **Beautiful UI**: Dark-themed player that matches Discogs' aesthetic
- **Optional Authentication**: Works without login, but connects to Spotify for better results
- **Toggle On/Off**: Easily enable or disable the extension

## 📦 Installation

### From Source (Developer Mode)

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/discotify.git
   cd discotify
   ```

2. **Set up Spotify API credentials** (optional but recommended)
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create a new application
   - Copy your Client ID
   - Add the redirect URI (see step below)
   - Edit `src/background/background.js` and replace `YOUR_SPOTIFY_CLIENT_ID` with your Client ID

3. **Get your Chrome Extension redirect URI**
   - Load the extension first (step 4)
   - Open the extension popup and check the browser console
   - Or use: `chrome-extension://YOUR_EXTENSION_ID/`

4. **Load the extension in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top right)
   - Click **Load unpacked**
   - Select the `discotify` folder

5. **Pin the extension** (optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Pin Discotify for easy access

## 🔧 Configuration

### Spotify API Setup (Required)

The extension uses Spotify's API to search for albums. Setup takes ~2 minutes:

1. **Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)**
2. **Log in** with your Spotify account (free account works fine)
3. **Click the Discotify extension icon** to see your Redirect URI
4. **Click "Create App"** in Spotify Dashboard and fill in:
   - App name: `Discotify`
   - App description: `Chrome extension for Discogs`
   - Redirect URI: Copy from the extension popup (looks like `https://xxx.chromiumapp.org/`)
   - Check "Web API" under APIs
5. **Click "Save"** and then **"Settings"**
6. **Copy your Client ID and Client Secret**
7. **Paste your credentials** in the Discotify popup and click "Save & Connect"

> **Note**: Your credentials are stored locally in your browser and never sent anywhere except Spotify's API.

### Why API Keys?

Spotify requires authentication for all search requests. The Client Credentials flow:
- ✅ No user login required
- ✅ Works automatically in the background
- ✅ Free tier is sufficient (no premium needed)
- ✅ Your keys stay local in your browser
- ✅ Easy setup through the extension popup

## 🚀 Usage

1. **Navigate to any Discogs release page** that has an Apple Music embed
   - Example: `https://www.discogs.com/release/123456`

2. **Discotify will automatically**:
   - Detect the Apple Music player
   - Search for the album on Spotify
   - Replace the player with a Spotify embed

3. **If no match is found**, you'll see a search link to manually find the album on Spotify

### Extension Popup

Click the Discotify icon in your Chrome toolbar to:
- Enable/disable the extension
- Connect/disconnect your Spotify account
- View connection status

## 📁 Project Structure

```
discotify/
├── manifest.json           # Chrome extension manifest
├── package.json           # Node.js package file
├── README.md              # This file
├── icons/                 # Extension icons
│   ├── icon.svg          # Source SVG
│   ├── icon16.png        # 16x16 icon
│   ├── icon32.png        # 32x32 icon
│   ├── icon48.png        # 48x48 icon
│   └── icon128.png       # 128x128 icon
├── scripts/              # Build/utility scripts
│   └── generate-icons.js # Icon generation helper
└── src/
    ├── background/       # Service worker
    │   └── background.js # Spotify API & auth handling
    ├── content/          # Content scripts
    │   ├── content.js    # Main content script
    │   └── styles.css    # Injected styles
    └── popup/            # Extension popup
        ├── popup.html    # Popup HTML
        ├── popup.css     # Popup styles
        └── popup.js      # Popup logic
```

## 🛠️ Development

### Prerequisites

- Node.js 18+ (for development tools)
- Chrome browser

### Setup

```bash
# Install dev dependencies
npm install

# Lint code
npm run lint

# Format code
npm run format
```

### Making Changes

1. Edit files in the `src/` directory
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Discotify extension
4. Refresh the Discogs page to see changes

### Debugging

- **Content Script**: Open DevTools on a Discogs page, check Console for `[Discotify]` messages
- **Background Script**: Go to `chrome://extensions/`, click "Service Worker" under Discotify
- **Popup**: Right-click the extension icon → "Inspect Popup"

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This extension is not affiliated with, endorsed by, or connected to Spotify, Apple, or Discogs. All trademarks belong to their respective owners.

## 🙏 Acknowledgments

- [Discogs](https://www.discogs.com) - The music database
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/) - For music search
- Chrome Extensions documentation
