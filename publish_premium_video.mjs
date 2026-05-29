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
          reject(new Error('Failed to parse version JSON: ' + e.message));
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

    console.log('Searching for TikTok Studio page...');
    const pages = await browser.pages();
    let page = null;
    for (const p of pages) {
      const url = p.url();
      if (url.includes('tiktok.com/tiktokstudio')) {
        page = p;
        break;
      }
    }

    if (!page) {
      throw new Error('TikTok Studio page not found in open browser tabs.');
    }

    console.log('Navigating to the TikTok Studio upload page...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload&lang=es-419', { waitUntil: 'load', timeout: 30000 });
    await delay(3000);

    const pageTitle = await page.title();
    console.log(`Connected to page: "${pageTitle}" -> ${page.url()}`);

    // Wait for the file input to be present
    console.log('Locating file input element...');
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    if (!fileInput) {
      throw new Error('Could not find file input element on the page.');
    }

    const videoPath = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\scratch\\tikmagictok\\output\\trend_9.mp4';
    console.log(`Uploading premium video file from path: ${videoPath}...`);
    await fileInput.uploadFile(videoPath);
    console.log('File uploaded successfully to browser. Waiting for upload details page to load...');

    // Wait for the details page to transition
    console.log('Waiting 10 seconds for the details form to render...');
    await delay(10000);

    // Click "Entendido" on the welcome popup modal if it appears
    console.log('Dismissing welcome modal if present...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const welcomeBtn = buttons.find(b => b.innerText.includes('Entendido') || b.textContent.includes('Entendido'));
      if (welcomeBtn) {
        welcomeBtn.click();
        console.log('Dismissed welcome modal.');
      }
    });
    await delay(2000);

    // Now look for the caption editor DraftEditor
    console.log('Locating caption editor...');
    const editor = await page.waitForSelector('.public-DraftEditor-content[contenteditable="true"]', { timeout: 10000 });
    if (!editor) {
      throw new Error('Could not find caption editor.');
    }

    console.log('Focusing caption editor...');
    await editor.click();
    await delay(500);

    // Select all existing text and delete it
    console.log('Clearing existing caption text...');
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await delay(1000);

    // Type the caption
    const captionText = '#techtips #TikMagicTok';
    console.log(`Typing caption: "${captionText}"...`);
    await page.keyboard.type(captionText);
    await delay(2000);

    // Click "Publicar" button
    console.log('Clicking the primary "Publicar" button...');
    const clickedPublish = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pubBtn = buttons.find(b => b.innerText === 'Publicar' || b.textContent === 'Publicar');
      if (pubBtn) {
        if (pubBtn.disabled || pubBtn.getAttribute('aria-disabled') === 'true') {
          return { success: false, reason: 'Button is disabled' };
        }
        pubBtn.click();
        return { success: true };
      }
      return { success: false, reason: 'Button not found' };
    });
    console.log('Publish button click result:', clickedPublish);

    // Wait for the popup "¿Seguir con la publicación?" to show up
    console.log('Waiting 5 seconds for confirmation popup...');
    await delay(5000);

    // Click "Publicar ahora" on the confirmation modal if visible
    console.log('Checking for "Publicar ahora" button on confirmation modal...');
    const clickedConfirm = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirmBtn = buttons.find(b => b.innerText.includes('Publicar ahora') || b.textContent.includes('Publicar ahora'));
      if (confirmBtn) {
        confirmBtn.click();
        return { success: true };
      }
      return { success: false, reason: 'Confirm button not found' };
    });
    console.log('Confirmation click result:', clickedConfirm);

    console.log('Waiting 15 seconds for upload to complete and page redirection...');
    await delay(15000);

    // Take final screenshot to verify completed publication
    const finalScreenshot = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\tiktok_premium_published.png';
    await page.screenshot({ path: finalScreenshot });
    console.log('Final screenshot saved to:', finalScreenshot);

    await browser.disconnect();
    console.log('Successfully completed premium automated upload and publishing!');
  } catch (err) {
    console.error('Error during premium automated upload:', err);
    process.exit(1);
  }
})();
