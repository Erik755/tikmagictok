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

    // Wait for the file input to be present
    console.log('Locating file input element...');
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    if (!fileInput) {
      throw new Error('Could not find file input element on the page.');
    }

    const videoPath = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\scratch\\tikmagictok\\output\\trend_9.mp4';
    console.log(`Uploading video file from path: ${videoPath}...`);
    await fileInput.uploadFile(videoPath);
    console.log('File uploaded successfully to browser. Waiting for upload details page to load...');

    // Wait for the details page to transition
    console.log('Waiting 10 seconds for the details form to render...');
    await delay(10000);

    // Let's inspect the page inputs and elements to find the description field
    console.log('Inspecting inputs on the details page...');
    const detailsInputs = await page.evaluate(() => {
      const elInputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"]'));
      return elInputs.map(el => ({
        tagName: el.tagName,
        type: el.type,
        className: el.className,
        role: el.getAttribute('role'),
        contentEditable: el.getAttribute('contenteditable'),
        outerHTML: el.outerHTML.substring(0, 150)
      }));
    });
    console.log('Found detail form inputs:', JSON.stringify(detailsInputs, null, 2));

    // Take screenshot of details page to visually debug
    const detailScreenshot = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\tiktok_details.png';
    await page.screenshot({ path: detailScreenshot });
    console.log('Details page screenshot saved to:', detailScreenshot);

    // Look for the caption editor
    console.log('Looking for the caption editor...');
    let editorSelector = '[contenteditable="true"], div[role="textbox"], textarea';
    const editor = await page.waitForSelector(editorSelector, { timeout: 15000 });
    if (!editor) {
      throw new Error('Could not find caption editor element.');
    }

    console.log('Focusing caption editor...');
    await editor.click();
    
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

    // Look for the publish button. It usually has text like "Publicar", "Post", or a button with primary class.
    console.log('Locating the Publish button...');
    const publishButtonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(b => ({
        text: b.innerText || b.textContent || '',
        className: b.className,
        disabled: b.disabled || b.getAttribute('aria-disabled') === 'true'
      }));
    });
    console.log('Available buttons on page:', JSON.stringify(publishButtonInfo, null, 2));

    // Find button containing "Publicar" or "Post"
    const btnTextToFind = 'Publicar';
    const postBtnIndex = publishButtonInfo.findIndex(b => b.text.includes(btnTextToFind) || b.text.toLowerCase().includes('post'));

    if (postBtnIndex === -1) {
      console.log('Could not find button with exact text "Publicar" or "Post". Let\'s look for any primary/active buttons.');
    } else {
      console.log(`Found candidate publish button: "${publishButtonInfo[postBtnIndex].text}" at index ${postBtnIndex}`);
    }

    // Let's click the button in page context to be super reliable
    console.log('Clicking the Publish button...');
    const clickSuccess = await page.evaluate((btnText) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.innerText.includes(btnText) || b.textContent.includes(btnText) || b.innerText.toLowerCase().includes('post'));
      if (btn) {
        if (btn.getAttribute('aria-disabled') === 'true' || btn.disabled) {
          return { success: false, reason: 'Button is disabled' };
        }
        btn.click();
        return { success: true };
      }
      return { success: false, reason: 'Button not found' };
    }, btnTextToFind);

    console.log('Click action result:', clickSuccess);

    console.log('Waiting 15 seconds for upload and publishing to finalize...');
    await delay(15000);

    // Take a final confirmation screenshot
    const finalScreenshot = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\tiktok_published.png';
    await page.screenshot({ path: finalScreenshot });
    console.log('Final screenshot saved to:', finalScreenshot);

    await browser.disconnect();
    console.log('Successfully completed automated upload!');
  } catch (err) {
    console.error('Error during automated upload:', err);
    process.exit(1);
  }
})();
