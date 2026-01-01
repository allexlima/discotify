# Privacy Policy for Discotify

**Last Updated:** December 31, 2025

## Overview

Discotify is a browser extension that replaces Apple Music embeds with Spotify players on Discogs.com. This privacy policy explains how we handle your data.

## Data Collection

### What We Collect

Discotify collects and stores the following data **locally on your device only**:

- **Spotify API Credentials**: Your Spotify Client ID and Client Secret (entered manually by you)
- **Authentication Tokens**: OAuth access tokens and refresh tokens from Spotify
- **Extension Preferences**: Your enabled/disabled preference

### What We Do NOT Collect

- We do **not** collect personal information
- We do **not** collect browsing history
- We do **not** collect any data from Discogs pages
- We do **not** track your listening habits
- We do **not** use analytics or tracking tools

## Data Storage

All data is stored locally in your browser using Chrome's `storage.sync` API. Your data:

- Remains on your device
- Is never transmitted to our servers (we don't have any)
- Is only sent to official Spotify API endpoints for authentication and music playback
- Can be deleted at any time by removing the extension

## Third-Party Services

Discotify interacts with the following third-party services:

### Spotify
- **Purpose**: Authentication and music playback
- **Data Sent**: Your Spotify API credentials and OAuth tokens
- **Privacy Policy**: [Spotify Privacy Policy](https://www.spotify.com/legal/privacy-policy/)

### Discogs
- **Purpose**: Content script injection to replace music players
- **Data Sent**: None
- **Privacy Policy**: [Discogs Privacy Policy](https://www.discogs.com/privacy)

## Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `activeTab` | To detect Discogs pages and inject the Spotify player |
| `storage` | To save your Spotify credentials locally |
| `identity` | To handle Spotify OAuth authentication |
| `host_permissions` | To access Discogs pages and communicate with Spotify API |

## Data Security

- Your Spotify Client Secret is stored locally and never shared
- All communication with Spotify uses HTTPS
- No data is ever sent to any server we control

## Your Rights

You can:
- **View** your stored data via Chrome's extension storage
- **Delete** all data by uninstalling the extension
- **Revoke** Spotify access at any time via [Spotify Account Settings](https://www.spotify.com/account/apps/)

## Children's Privacy

Discotify is not directed at children under 13 and does not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be reflected in the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our [GitHub repository](https://github.com/allexlima/discotify).

## Open Source

Discotify is open source. You can review the complete source code to verify our privacy practices.
