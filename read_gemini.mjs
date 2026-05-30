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
    let geminiPage = null;
    for (const p of pages) {
      if (p.url().includes('gemini.google.com')) {
        geminiPage = p;
        break;
      }
    }

    if (!geminiPage) {
      console.log('❌ Google Gemini tab not found in active browser.');
      await browser.disconnect();
      return;
    }

    console.log('✅ Found Gemini tab:', geminiPage.url());

    // Extract text from chat logs in a very robust way
    const chatText = await geminiPage.evaluate(() => {
      // Find all prompt and response elements
      const items = [];
      const queries = document.querySelectorAll('.query-content, .message-content, message-content, .model-response, [class*="message"]');
      queries.forEach(el => {
        const text = el.innerText ? el.innerText.trim() : '';
        if (text && text.length > 5) {
          const isUser = el.className.includes('query') || el.closest('.query-content');
          items.push(`${isUser ? 'USER' : 'GEMINI'}: ${text}\n`);
        }
      });

      if (items.length > 0) return items.join('\n');
      
      // Fallback: get visible text from main container
      const main = document.querySelector('main, .chat-history, [role="main"]') || document.body;
      return main.innerText;
    });

    console.log('\n--- GEMINI CONVERSATION ---');
    console.log(chatText);
    console.log('---------------------------\n');

    await browser.disconnect();
  } catch (err) {
    console.error('❌ Error reading Gemini:', err.message);
  }
})();
