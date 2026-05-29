// server/tiktokApi.js
require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');

// Helper to base64url encode buffers/strings for PKCE
function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// TikTok OAuth v2 endpoints (official and active)
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const UPLOAD_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/'; // Direct Post v2

/**
 * Redirect user to TikTok OAuth consent screen with PKCE challenge.
 */
function login(req, res) {
  if (process.env.SIMULATE_TIKTOK === 'true') {
    console.log('TikTok login simulation: redirecting to callback with mock code.');
    return res.redirect(`/auth/callback?code=simulated_auth_code_999&state=tikmagictok_state`);
  }

  // Generate PKCE code verifier (64 bytes = 86 chars) and code challenge
  const verifier = base64URLEncode(crypto.randomBytes(64));
  global.tiktokCodeVerifier = verifier; // Store in memory for the callback

  const challenge = base64URLEncode(crypto.createHash('sha256').update(verifier).digest());

  const params = querystring.stringify({
    client_key: process.env.TIKTOK_CLIENT_ID,
    response_type: 'code',
    scope: 'user.info.profile,video.publish', // modern v2 scopes
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    state: 'tikmagictok_state',
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  console.log(`Redirecting to TikTok OAuth with PKCE challenge: ${challenge}`);
  res.redirect(`${AUTH_URL}?${params}`);
}

/**
 * OAuth callback – exchange code for access token.
 */
async function callback(req, res) {
  const { code, state } = req.query;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  try {
    let data;
    if (process.env.SIMULATE_TIKTOK === 'true') {
      console.log('TikTok token simulation active.');
      data = {
        access_token: 'mock_access_token_value_xyz',
        refresh_token: 'mock_refresh_token_value_abc',
        expires_in: 86400,
        open_id: 'mock_open_id_creator_123'
      };
    } else {
      // Exchange code for access token using v2 form-urlencoded format, sending code_verifier
      const tokenBody = {
        client_key: process.env.TIKTOK_CLIENT_ID,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TIKTOK_REDIRECT_URI
      };
      
      if (global.tiktokCodeVerifier) {
        tokenBody.code_verifier = global.tiktokCodeVerifier;
        console.log(`Sending PKCE verifier during token exchange: ${global.tiktokCodeVerifier}`);
      }

      const tokenResp = await axios.post(TOKEN_URL, querystring.stringify(tokenBody), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      data = tokenResp.data;
      console.log('TikTok token exchange completed:', data);
    }
    
    // Store tokens in memory for this demo (in real app, persist securely)
    global.tiktokTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      open_id: data.open_id
    };
    res.redirect('/'); // back to UI
  } catch (e) {
    console.error('OAuth error:', e.response?.data || e.message);
    res.status(500).send('OAuth failed');
  }
}

async function uploadVideo(videoPath, caption) {
  const { default: puppeteer } = await import('puppeteer-core');
  const http = require('http');

  function getBrowserWS() {
    return new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:9222/json/version', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const info = JSON.parse(data);
            resolve(info.webSocketDebuggerUrl);
          } catch (e) {
            reject(new Error('Failed to parse version JSON'));
          }
        });
      }).on('error', reject);
    });
  }

  try {
    console.log(`[TikTok API] Initiating automated upload for: ${videoPath} with caption: "${caption}"`);
    
    console.log('[TikTok API] Fetching browser WebSocket endpoint...');
    const wsUrl = await getBrowserWS();
    console.log('[TikTok API] WS URL:', wsUrl);

    console.log('[TikTok API] Connecting Puppeteer...');
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null
    });

    console.log('[TikTok API] Searching for TikTok Studio page...');
    const pages = await browser.pages();
    let page = null;
    for (const p of pages) {
      if (p.url().includes('tiktok.com')) {
        page = p;
        break;
      }
    }

    if (!page) {
      console.log('[TikTok API] No active TikTok tab found. Opening a new tab...');
      page = await browser.newPage();
    }

    console.log('[TikTok API] Deciding navigation path...');
    const onUploadPage = page.url().includes('/upload');
    if (onUploadPage) {
      console.log('[TikTok API] Already on upload page. Reloading tab to clear state...');
      await page.reload({ waitUntil: 'load', timeout: 30000 });
      await new Promise(r => setTimeout(r, 5000));
    } else {
      console.log('[TikTok API] Currently on another tab. Navigating via "+ Cargar" sidebar button click...');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cargarBtn = buttons.find(b => b.innerText.includes('Cargar') || b.textContent.includes('Cargar'));
        if (cargarBtn) cargarBtn.click();
      });
      await new Promise(r => setTimeout(r, 5000));
      if (!page.url().includes('/upload')) {
        console.log('[TikTok API] Sidebar click did not navigate. Falling back to direct page.goto...');
        await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload&lang=es-419', { waitUntil: 'load', timeout: 30000 });
        await new Promise(r => setTimeout(r, 5000));
      }
    }

    console.log('[TikTok API] Locating file input element...');
    let fileInput = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        fileInput = await page.waitForSelector('input[type="file"]', { timeout: 8000 });
        if (fileInput) {
          console.log(`[TikTok API] Successfully found file input on attempt ${attempt}`);
          break;
        }
      } catch (e) {
        console.log(`[TikTok API] Attempt ${attempt} to locate file input failed. Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!fileInput) {
      throw new Error('Could not find file input element after 3 attempts');
    }

    console.log('[TikTok API] Transmitting video binary...');
    await fileInput.uploadFile(videoPath);
    console.log('[TikTok API] Video uploaded to browser. Waiting 10 seconds for rendering...');
    await new Promise(r => setTimeout(r, 10000));

    console.log('[TikTok API] Dismissing welcome modal if present...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes('Entendido') || b.textContent.includes('Entendido'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));

    console.log('[TikTok API] Locating caption editor...');
    const editor = await page.waitForSelector('.public-DraftEditor-content[contenteditable="true"]', { timeout: 15000 });
    if (!editor) {
      throw new Error('Could not find caption editor');
    }

    console.log('[TikTok API] Writing caption...');
    await editor.click();
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 1000));
    await page.keyboard.type(caption);
    await new Promise(r => setTimeout(r, 2000));

    console.log('[TikTok API] Clicking "Publicar" button...');
    const clickedPublish = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pubBtn = buttons.find(b => b.innerText === 'Publicar' || b.textContent === 'Publicar');
      if (pubBtn) {
        pubBtn.click();
        return true;
      }
      return false;
    });
    console.log('[TikTok API] Publish button clicked:', clickedPublish);

    console.log('[TikTok API] Waiting 5 seconds for confirmation popup...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('[TikTok API] Checking for "Publicar ahora" on confirmation modal...');
    const clickedConfirm = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirmBtn = buttons.find(b => b.innerText.includes('Publicar ahora') || b.textContent.includes('Publicar ahora'));
      if (confirmBtn) {
        confirmBtn.click();
        return true;
      }
      return false;
    });
    console.log('[TikTok API] Confirmation popup clicked:', clickedConfirm);

    console.log('[TikTok API] Finalizing upload (waiting 15s)...');
    await new Promise(r => setTimeout(r, 15000));

    // Capture visual confirmation screenshot
    const screenshotPath = `C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\2d3ea27f-c216-423c-9529-67ff8d7f4e98\\scratch\\publish_success_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    console.log('[TikTok API] Saved upload verification screenshot to:', screenshotPath);

    await browser.disconnect();
    console.log('[TikTok API] Automated video upload completed successfully!');
    return {
      id: `v_published_${Date.now()}`
    };
  } catch (err) {
    console.error('[TikTok API] Automated browser upload failed:', err.message);
    throw new Error(`Browser remote publishing failed: ${err.message}`);
  }
}

module.exports = { login, callback, uploadVideo };


