#!/usr/bin/env node

/**
 * Chrome Web Store API - Refresh Token Generator
 *
 * This script helps you obtain a refresh token for the Chrome Web Store API.
 * Run this script once to get your refresh token, then store it in GitHub Secrets.
 *
 * Prerequisites:
 * 1. Enable Chrome Web Store API in Google Cloud Console
 * 2. Create OAuth 2.0 credentials (Desktop app or Web app)
 * 3. Have your Client ID and Client Secret ready
 *
 * Usage:
 *   node scripts/get-refresh-token.js
 */

const http = require('http');
const https = require('https');
const { URLSearchParams } = require('url');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function makeRequest(url, postData = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: postData ? 'POST' : 'GET',
      headers: postData ? {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      } : {}
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function startLocalServer(clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost:8080');

      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Chrome Web Store Auth</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .btn { display: inline-block; padding: 12px 24px; background: #4285f4; color: white;
                     text-decoration: none; border-radius: 4px; font-size: 16px; }
              .btn:hover { background: #357ae8; }
              h1 { color: #333; }
              p { color: #666; line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>🔐 Chrome Web Store API Authorization</h1>
            <p>Click the button below to authorize this application to publish to the Chrome Web Store.</p>
            <p><strong>Important:</strong> Make sure to check the box for "See, edit, create, and delete all your Chrome Web Store items" during authorization.</p>
            <a class="btn" href="https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=http://localhost:8080/oauth2callback&response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&prompt=consent">
              Authorize Application
            </a>
          </body>
          </html>
        `);
      } else if (url.pathname === '/oauth2callback') {
        const code = url.searchParams.get('code');

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>❌ Error: No authorization code received</h1>');
          server.close();
          reject(new Error('No authorization code received'));
          return;
        }

        try {
          // Exchange code for tokens
          const params = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: 'http://localhost:8080/oauth2callback',
            grant_type: 'authorization_code'
          });

          const tokenData = await makeRequest(
            'https://oauth2.googleapis.com/token',
            params.toString()
          );

          if (tokenData.error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>❌ Error: ${tokenData.error}</h1><p>${tokenData.error_description || ''}</p>`);
            server.close();
            reject(new Error(tokenData.error));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Success!</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
                .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; color: #155724; }
                .token { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px;
                         margin: 15px 0; font-family: monospace; word-break: break-all; }
                h1 { color: #28a745; }
              </style>
            </head>
            <body>
              <div class="success">
                <h1>✅ Authorization Successful!</h1>
                <p>Your refresh token has been generated. Copy the token below and save it securely.</p>
              </div>
              <h2>Refresh Token:</h2>
              <div class="token">${tokenData.refresh_token}</div>
              <p><strong>Next Steps:</strong></p>
              <ol>
                <li>Copy the refresh token above</li>
                <li>Add it to your GitHub repository secrets as <code>CHROME_REFRESH_TOKEN</code></li>
                <li>Also add <code>CHROME_CLIENT_ID</code> and <code>CHROME_CLIENT_SECRET</code></li>
                <li>Add your extension ID as <code>CHROME_EXTENSION_ID</code></li>
              </ol>
              <p>You can close this window now.</p>
            </body>
            </html>
          `);

          console.log('\n✅ Authorization successful!');
          console.log('\n📋 Your Refresh Token:');
          console.log('━'.repeat(80));
          console.log(tokenData.refresh_token);
          console.log('━'.repeat(80));
          console.log('\n📝 GitHub Secrets to add:');
          console.log(`   CHROME_CLIENT_ID: ${clientId}`);
          console.log(`   CHROME_CLIENT_SECRET: ${clientSecret}`);
          console.log(`   CHROME_REFRESH_TOKEN: ${tokenData.refresh_token}`);
          console.log(`   CHROME_EXTENSION_ID: ghbmjpggoefbcffdflkjnddhlibchlch`);
          console.log('\n');

          setTimeout(() => {
            server.close();
            resolve(tokenData.refresh_token);
          }, 1000);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>❌ Error: ${error.message}</h1>`);
          server.close();
          reject(error);
        }
      }
    });

    server.listen(8080, () => {
      console.log('\n🚀 Local server started at http://localhost:8080');
      console.log('📖 Open this URL in your browser to authorize the application\n');

      // Try to open browser automatically (best effort)
      const open = require('child_process').exec;
      const cmd = process.platform === 'darwin' ? 'open' :
        process.platform === 'win32' ? 'start' : 'xdg-open';
      open(`${cmd} http://localhost:8080`);
    });

    server.on('error', reject);
  });
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Chrome Web Store API - Refresh Token Generator              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log('This script will help you obtain a refresh token for the Chrome Web Store API.\n');
  console.log('Prerequisites:');
  console.log('  ✓ Chrome Web Store API enabled in Google Cloud Console');
  console.log('  ✓ OAuth 2.0 credentials created (Desktop or Web app)');
  console.log('  ✓ Client ID and Client Secret ready\n');

  try {
    const clientId = await question('Enter your Client ID: ');
    const clientSecret = await question('Enter your Client Secret: ');

    if (!clientId || !clientSecret) {
      console.error('\n❌ Error: Client ID and Client Secret are required');
      rl.close();
      process.exit(1);
    }

    console.log('\n📡 Starting authorization flow...');
    await startLocalServer(clientId.trim(), clientSecret.trim());

    console.log('✅ Done! You can now use these credentials in your GitHub Actions workflow.\n');
    rl.close();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

main();
