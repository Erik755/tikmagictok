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

    console.log('Searching for TikTok Studio upload page...');
    const pages = await browser.pages();
    let page = null;
    for (const p of pages) {
      const url = p.url();
      if (url.includes('tiktok.com/tiktokstudio/upload')) {
        page = p;
        break;
      }
    }

    if (!page) {
      throw new Error('TikTok Studio upload page not found in open browser tabs.');
    }

    const pageTitle = await page.title();
    console.log(`Connected to page: "${pageTitle}" -> ${page.url()}`);

    // Check if "¿Seguir con la publicación?" popup is visible, and click "Cancelar" to go back to edit the description
    console.log('Checking for "¿Seguir con la publicación?" modal...');
    const canceledPopup = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const cancelBtn = buttons.find(b => b.innerText.includes('Cancelar') || b.textContent.includes('Cancelar'));
      if (cancelBtn) {
        cancelBtn.click();
        return true;
      }
      return false;
    });

    if (canceledPopup) {
      console.log('Canceled the active publishing confirmation popup to fix description.');
      await delay(2000);
    } else {
      console.log('No confirmation popup was active. Proceeding...');
    }

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
    console.log('Waiting 4 seconds for confirmation popup...');
    await delay(4000);

    // Click "Publicar ahora" on the confirmation modal
    console.log('Clicking "Publicar ahora" on confirmation modal...');
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
    const finalScreenshot = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\tiktok_published_done.png';
    await page.screenshot({ path: finalScreenshot });
    console.log('Final screenshot saved to:', finalScreenshot);

    await browser.disconnect();
    console.log('Successfully completed automated upload and publishing!');
  } catch (err) {
    console.error('Error during final automated upload:', err);
    process.exit(1);
  }
})();
