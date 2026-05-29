import puppeteer from 'puppeteer-core';
import http from 'http';

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
    const wsUrl = await getBrowserWS();
    console.log('Connecting to browser at:', wsUrl);
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null
    });

    const pages = await browser.pages();
    let tiktokPage = null;
    for (const p of pages) {
      const url = p.url();
      console.log('Page:', url);
      if (url.includes('tiktok.com')) {
        tiktokPage = p;
      }
    }

    if (!tiktokPage) {
      console.log('No TikTok page found!');
      process.exit(1);
    }

    console.log('\nTikTok page URL:', tiktokPage.url());
    console.log('TikTok page title:', await tiktokPage.title());

    // Take a screenshot
    const screenshotPath = 'C:/Users/esanchez/.gemini/antigravity-ide/brain/057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea/scratch/tiktok_current_state.png';
    await tiktokPage.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Screenshot saved to:', screenshotPath);

    await browser.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
