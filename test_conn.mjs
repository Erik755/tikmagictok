import puppeteer from 'puppeteer-core';

(async () => {
  try {
    console.log('Connecting to browser...');
    const browser = await puppeteer.connect({
      browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser/b01c94c3-f3f4-4bbd-bc90-2b350a95c703',
      defaultViewport: null
    });

    console.log('Fetching pages...');
    const pages = await browser.pages();
    console.log(`Found ${pages.length} pages.`);

    let tiktokPage = null;
    for (const page of pages) {
      const url = page.url();
      const title = await page.title();
      console.log(`- Page: "${title}" -> ${url}`);
      if (url.includes('tiktok.com/tiktokstudio/upload')) {
        tiktokPage = page;
      }
    }

    if (!tiktokPage) {
      console.error('TikTok Studio upload page not found!');
      await browser.disconnect();
      return;
    }

    console.log('TikTok Studio page found. Inspecting selectors...');
    
    // Check if there is an iframe or direct inputs
    const content = await tiktokPage.content();
    console.log('Page HTML length:', content.length);
    
    // Find all inputs on the page
    const inputs = await tiktokPage.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('input'));
      return elements.map(el => ({
        type: el.type,
        id: el.id,
        className: el.className,
        outerHTML: el.outerHTML.substring(0, 200)
      }));
    });
    console.log('Inputs found:', JSON.stringify(inputs, null, 2));

    // Find all buttons on the page
    const buttons = await tiktokPage.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button'));
      return elements.map(el => ({
        text: el.innerText || el.textContent,
        className: el.className,
        outerHTML: el.outerHTML.substring(0, 200)
      }));
    });
    console.log('Buttons found:', JSON.stringify(buttons.slice(0, 10), null, 2));

    // Take screenshot to verify visually
    const screenshotPath = 'C:\\Users\\esanchez\\.gemini\\antigravity-ide\\brain\\057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea\\scratch\\tiktok_studio.png';
    await tiktokPage.screenshot({ path: screenshotPath });
    console.log('Screenshot saved to:', screenshotPath);

    await browser.disconnect();
    console.log('Done!');
  } catch (err) {
    console.error('Error during connection/inspection:', err);
  }
})();
