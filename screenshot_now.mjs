import puppeteer from 'puppeteer-core';
import http from 'http';

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
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null
    });

    const pages = await browser.pages();
    for (const page of pages) {
      if (page.url().includes('tiktok.com')) {
        console.log('Taking screenshot of page:', page.url());
        await page.screenshot({ path: 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\debug_tiktok.png' });
        console.log('Saved to debug_tiktok.png');
        break;
      }
    }
    await browser.disconnect();
  } catch (err) {
    console.error(err);
  }
})();
