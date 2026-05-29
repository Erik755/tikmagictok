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
    console.log('Fetching active browser DevTools WebSocket URL...');
    const wsUrl = await getBrowserWS();
    console.log('WS URL found:', wsUrl);

    console.log('Connecting to Chrome...');
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null
    });

    console.log('Fetching pages...');
    const pages = await browser.pages();
    let page = null;
    for (const p of pages) {
      if (p.url().includes('tiktok.com')) {
        page = p;
        break;
      }
    }

    if (!page) {
      console.error('No active TikTok tab found.');
      await browser.disconnect();
      return;
    }

    console.log(`Attached to page: "${await page.title()}" -> ${page.url()}`);

    // Attach robust dialog listener to dismiss any blocking alerts/confirms
    page.on('dialog', async dialog => {
      console.log(`[Dialog Handler] Captured active dialog: "${dialog.message()}" (${dialog.type()})`);
      await dialog.dismiss();
      console.log('[Dialog Handler] Dialog dismissed successfully.');
    });

    console.log('Checking page elements and loading status...');
    const domInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(el => el.outerHTML);
      const buttons = Array.from(document.querySelectorAll('button')).map(el => el.innerText || el.textContent);
      return {
        inputsCount: inputs.length,
        buttonsCount: buttons.length,
        bodyText: document.body.innerText.substring(0, 300),
        htmlLength: document.documentElement.outerHTML.length
      };
    });
    console.log('DOM Info:', domInfo);

    // Take screenshot safely
    console.log('Taking visual screenshot...');
    await page.screenshot({ path: 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\debug_tiktok.png' });
    console.log('Screenshot saved successfully to debug_tiktok.png');

    await browser.disconnect();
    console.log('Robust page inspection done!');
  } catch (err) {
    console.error('Error during robust page inspection:', err);
    process.exit(1);
  }
})();
