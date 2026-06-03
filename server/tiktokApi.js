// server/tiktokApi.js
require('dotenv').config();
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

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
// TikTok Content Posting API v2 endpoints
const VIDEO_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/video/init/';
const VIDEO_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';

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
    scope: 'user.info.profile,video.publish,video.upload', // v2 scopes
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

// Upload mutex to prevent concurrent upload collisions
let _uploadLock = Promise.resolve();
let _uploadQueueSize = 0;

async function uploadVideo(videoPath, caption) {
  if (process.env.SIMULATE_TIKTOK === 'true') {
    console.log('[TikTok API] (SIMULATION) Simulating video upload for:', videoPath);
    await new Promise(r => setTimeout(r, 2000));
    console.log('[TikTok API] (SIMULATION) Simulated video upload completed successfully!');
    return { id: `v_published_${Date.now()}` };
  }

  // Queue-based mutex: wait for any previous upload to finish before starting
  _uploadQueueSize++;
  if (_uploadQueueSize > 1) {
    console.log(`[TikTok API] ⏳ Upload queued (position ${_uploadQueueSize}). Waiting for previous upload...`);
  }

  let releaseLock;
  const myTurn = new Promise(resolve => { releaseLock = resolve; });
  const previousLock = _uploadLock;
  _uploadLock = myTurn;

  try {
    await previousLock;
  } catch (e) {
    // Previous upload failed, still proceed
  }

  console.log(`[TikTok API] 🔓 Lock acquired. Starting upload for: ${path.basename(videoPath)}`);

  try {
    const result = await _doUploadViaAPI(videoPath, caption);
    return result;
  } finally {
    _uploadQueueSize--;
    releaseLock();
    console.log(`[TikTok API] 🔓 Lock released. Queue remaining: ${_uploadQueueSize}`);
  }
}

/**
 * Upload video using the official TikTok Content Posting API v2.
 * This uses DIRECT_POST mode which directly publishes to the creator's profile.
 * No Chrome/browser automation required.
 */
async function _doUploadViaAPI(videoPath, caption) {
  // Check that we have a valid access token
  if (!global.tiktokTokens || !global.tiktokTokens.access_token) {
    throw new Error('No TikTok access token available. Please authenticate via /auth/login first.');
  }

  const accessToken = global.tiktokTokens.access_token;
  const videoStats = fs.statSync(videoPath);
  const videoSize = videoStats.size;
  const chunkSize = 10 * 1024 * 1024; // 10MB chunks
  const totalChunkCount = Math.ceil(videoSize / chunkSize);

  console.log(`[TikTok API] Starting Content Posting API v2 upload...`);
  console.log(`[TikTok API] Video: ${path.basename(videoPath)} | Size: ${(videoSize / 1024 / 1024).toFixed(2)}MB | Chunks: ${totalChunkCount}`);

  // Step 1: Initialize the upload session (DIRECT_POST)
  console.log('[TikTok API] Step 1: Initializing upload session...');
  const initPayload = {
    post_info: {
      title: caption.slice(0, 2200), // TikTok max caption length
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount
    }
  };

  let initResp;
  try {
    initResp = await axios.post(VIDEO_INIT_URL, initPayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      }
    });
  } catch (err) {
    const errData = err.response?.data;
    throw new Error(`TikTok upload init failed: ${JSON.stringify(errData) || err.message}`);
  }

  const { publish_id, upload_url } = initResp.data?.data || {};
  if (!publish_id || !upload_url) {
    throw new Error(`TikTok init response missing publish_id or upload_url: ${JSON.stringify(initResp.data)}`);
  }
  console.log(`[TikTok API] ✅ Upload session initialized. Publish ID: ${publish_id}`);
  console.log(`[TikTok API] Upload URL: ${upload_url}`);

  // Step 2: Upload video file in chunks
  console.log(`[TikTok API] Step 2: Uploading ${totalChunkCount} chunk(s)...`);
  const videoBuffer = fs.readFileSync(videoPath);

  for (let chunkIndex = 0; chunkIndex < totalChunkCount; chunkIndex++) {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, videoSize);
    const chunk = videoBuffer.slice(start, end);
    const contentRange = `bytes ${start}-${end - 1}/${videoSize}`;

    console.log(`[TikTok API] Uploading chunk ${chunkIndex + 1}/${totalChunkCount} | Range: ${contentRange}`);

    try {
      await axios.put(upload_url, chunk, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': contentRange,
          'Content-Length': chunk.length
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000
      });
      console.log(`[TikTok API] ✅ Chunk ${chunkIndex + 1}/${totalChunkCount} uploaded successfully`);
    } catch (chunkErr) {
      const errData = chunkErr.response?.data;
      throw new Error(`Chunk ${chunkIndex + 1} upload failed: ${JSON.stringify(errData) || chunkErr.message}`);
    }
  }

  console.log('[TikTok API] ✅ All chunks uploaded. Waiting for TikTok to process the video...');

  // Step 3: Poll for publish status
  let publishStatus = null;
  let pollAttempts = 0;
  const maxPollAttempts = 20;

  while (pollAttempts < maxPollAttempts) {
    await new Promise(r => setTimeout(r, 5000));
    pollAttempts++;

    try {
      const statusResp = await axios.post(VIDEO_STATUS_URL,
        { publish_id },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8'
          }
        }
      );

      const statusData = statusResp.data?.data;
      const status = statusData?.status;
      console.log(`[TikTok API] Poll ${pollAttempts}/${maxPollAttempts}: Status = ${status}`);

      if (status === 'PUBLISH_COMPLETE') {
        publishStatus = 'success';
        console.log(`[TikTok API] 🎉 Video published successfully! Publish ID: ${publish_id}`);
        break;
      } else if (status === 'FAILED' || status === 'SEND_MEDIA_RESPONSE_ERROR') {
        const failReason = statusData?.fail_reason || 'Unknown';
        throw new Error(`TikTok publish failed with status: ${status}, reason: ${failReason}`);
      }
      // Statuses like PROCESSING_UPLOAD, PROCESSING_DOWNLOAD continue polling
    } catch (pollErr) {
      if (pollErr.message.includes('TikTok publish failed')) throw pollErr;
      console.warn(`[TikTok API] Poll ${pollAttempts} error (retrying): ${pollErr.message}`);
    }
  }

  if (publishStatus !== 'success') {
    throw new Error(`TikTok video upload timed out after ${maxPollAttempts} polling attempts. Publish ID: ${publish_id}`);
  }

  return { id: publish_id };
}

module.exports = { login, callback, uploadVideo };
