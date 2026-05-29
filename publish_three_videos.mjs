import videoGenerator from './server/videoGenerator.js';
import tiktokApi from './server/tiktokApi.js';
import db from './server/db.js';
import puppeteer from 'puppeteer-core';
import http from 'http';

const { createVideo } = videoGenerator;
const { uploadVideo } = tiktokApi;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

(async () => {
  try {
    console.log('--- STARTING TRIPLE VIDEO AUTO-PUBLISHING ENGINE ---');

    // Define the three different trends
    const trends = [
      { id: 9, hashtag: 'techtips', description: 'Tech Tips and AI Autonomy' },
      { id: 11, hashtag: 'funnycats', description: 'Funny Cats Compilation' },
      { id: 10, hashtag: 'dancechallenge', description: 'Viral Dance Challenge' }
    ];

    for (let i = 0; i < trends.length; i++) {
      const trend = trends[i];
      console.log(`\n========================================`);
      console.log(`PROCESSING VIDEO ${i + 1}/3: #${trend.hashtag}`);
      console.log(`========================================`);

      // Step 1: Render the vertical mobile video with premium overlays
      console.log(`[Step 1] Rendering vertical video for #${trend.hashtag}...`);
      const videoPath = await createVideo(trend);
      console.log(`[Step 1] Video rendered successfully at: ${videoPath}`);

      // Step 2: Upload to TikTok Studio via remote control
      console.log(`[Step 2] Auto-publishing to TikTok Studio...`);
      const caption = `#${trend.hashtag} #TikMagicTok`;
      const result = await uploadVideo(videoPath, caption);
      console.log(`[Step 2] Video ${i + 1} published successfully! Video ID: ${result.id}`);

      // Record in SQLite DB
      await db.recordPost(trend.id, videoPath, 'published', result.id);

      // Wait a moment before the next one
      console.log('Waiting 10 seconds before initiating the next upload...');
      await delay(10000);
    }

    console.log('\n========================================');
    console.log('ALL THREE VIDEOS UPLOADED. GENERATING FINAL EVIDENCE...');
    console.log('========================================');

    // Step 3: Connect to the browser to take the final confirmation evidence screenshot
    console.log('Connecting to browser for final verification...');
    const wsUrl = await getBrowserWS();
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null
    });

    const pages = await browser.pages();
    let page = null;
    for (const p of pages) {
      if (p.url().includes('tiktok.com/tiktokstudio')) {
        page = p;
        break;
      }
    }

    if (!page) {
      throw new Error('TikTok Studio page not found.');
    }

    console.log('Navigating to content manager to verify all posts...');
    await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(8000);

    const evidencePath = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\three_videos_published.png';
    await page.screenshot({ path: evidencePath });
    console.log('FINAL PROOF SCREENSHOT SAVED TO:', evidencePath);

    await browser.disconnect();
    console.log('--- TRIPLE PUBLISHING PROCESS SUCCESSFULLY COMPLETED ---');
  } catch (err) {
    console.error('CRITICAL ERROR in triple auto-publisher:', err);
    process.exit(1);
  }
})();
