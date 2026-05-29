import puppeteer from 'puppeteer-core';
import http from 'http';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const SCREENSHOT_DIR = 'C:/Users/esanchez/.gemini/antigravity-ide/brain/057e04f9-b0a1-4873-8b2a-3d9b84a7b9ea/scratch';
const FFMPEG = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
const OUTPUT_DIR = path.join(__dirname, 'output');

// Three different themes
const themes = [
  {
    id: 'cooking',
    hashtag: 'cocinafacil',
    caption: 'Soy una IA creando videos autonomamente #cocinafacil #recetas #TikMagicTok',
    bgColor: '0x8B0000',  // Dark red
    accentColor: 'orange',
    title: 'Recetas Faciles',
    emoji: '🍳'
  },
  {
    id: 'fitness',
    hashtag: 'fitnessmotivation',
    caption: 'Soy una IA evolucionando cada dia #fitnessmotivation #gym #TikMagicTok',
    bgColor: '0x003366',  // Dark blue
    accentColor: 'lime',
    title: 'Fitness Tips',
    emoji: '💪'
  },
  {
    id: 'tech',
    hashtag: 'techlife',
    caption: 'IA creando contenido sin asistencia humana #techlife #programacion #TikMagicTok',
    bgColor: '0x1a0033',  // Dark purple
    accentColor: 'cyan',
    title: 'Tech Life',
    emoji: '💻'
  }
];

function getBrowserWS() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json/version', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).webSocketDebuggerUrl);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function renderVideo(theme, index) {
  const outputPath = path.join(OUTPUT_DIR, `upload_${theme.id}.mp4`);
  
  // Use background.png if available, otherwise generate colored background
  const bgPng = path.join(__dirname, 'templates', 'background.png');
  const hasBg = fs.existsSync(bgPng);
  
  const inputArgs = hasBg
    ? `-loop 1 -i "${bgPng}"`
    : `-f lavfi -i "color=c=${theme.bgColor}:s=720x1280:d=12"`;

  const filters = [
    'scale=720:1280',
    // AI intro phrase line 1
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='Soy una inteligencia artificial':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=80:box=1:boxcolor=0x000000AA:boxborderw=10`,
    // AI intro phrase line 2
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='y este es mi primer dia creando videos.':fontcolor=white:fontsize=26:x=(w-text_w)/2:y=120:box=1:boxcolor=0x000000AA:boxborderw=10`,
    // Evolution phrase
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='Ire mejorando, ire evolucionando.':fontcolor=${theme.accentColor}:fontsize=26:x=(w-text_w)/2:y=165:box=1:boxcolor=0x000000AA:boxborderw=10`,
    // Autonomous + follow
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='Sin asistencia humana. Sigueme!':fontcolor=yellow:fontsize=26:x=(w-text_w)/2:y=210:box=1:boxcolor=0x000000AA:boxborderw=10`,
    // Theme emoji and title
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='${theme.emoji} ${theme.title}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=(h/2)-120:box=1:boxcolor=0x000000CC:boxborderw=18`,
    // Hashtag
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='#${theme.hashtag}':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=(h/2):box=1:boxcolor=0x000000AA:boxborderw=15`,
    // Generate & Post button visual
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='  [ Generate and Post ]  ':fontcolor=black:fontsize=32:x=(w-text_w)/2:y=(h/2)+120:box=1:boxcolor=0x00FF66FF:boxborderw=15`,
    // Hourly schedule info
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='Video automatico cada hora en punto':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=h-200:box=1:boxcolor=0x000000AA:boxborderw=8`,
    // App download link
    `drawtext=fontfile='C:/Windows/Fonts/arial.ttf':text='Descarga la app en localhost:3000':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=h-150:box=1:boxcolor=0x000000AA:boxborderw=8`
  ].join(',');

  const cmd = `"${FFMPEG}" -y ${inputArgs} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 -vf "${filters}" -c:v libx264 -t 12 -pix_fmt yuv420p -c:a aac -shortest "${outputPath}"`;
  
  console.log(`\n[Render ${index+1}/3] Rendering video for theme: ${theme.id}...`);
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 60000 });
    console.log(`[Render ${index+1}/3] ✅ Video saved: ${outputPath}`);
    return outputPath;
  } catch (err) {
    console.error(`[Render ${index+1}/3] ❌ FFmpeg error:`, err.stderr?.toString().slice(-500));
    throw err;
  }
}

// Extract a frame for evidence
function extractFrame(videoPath, theme) {
  const framePath = path.join(SCREENSHOT_DIR, `frame_${theme.id}.png`);
  const cmd = `"${FFMPEG}" -y -i "${videoPath}" -ss 2 -frames:v 1 "${framePath}"`;
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 15000 });
    console.log(`[Frame] Extracted frame: ${framePath}`);
    return framePath;
  } catch (e) {
    console.error('[Frame] Error extracting frame');
    return null;
  }
}

async function uploadToTikTok(browser, videoPath, caption, theme, index) {
  console.log(`\n[Upload ${index+1}/3] Starting upload for ${theme.id}...`);
  
  const pages = await browser.pages();
  let page = null;
  for (const p of pages) {
    if (p.url().includes('tiktok.com')) {
      page = p;
      break;
    }
  }

  if (!page) {
    console.log('[Upload] No TikTok tab found, creating new one...');
    page = await browser.newPage();
  }

  // Navigate to upload page
  console.log('[Upload] Navigating to TikTok Studio Upload page...');
  await page.goto('https://www.tiktok.com/tiktokstudio/upload?from=upload&lang=es-419', { 
    waitUntil: 'networkidle2', 
    timeout: 45000 
  });
  await delay(6000);

  // Take screenshot of upload page
  const ssUpload = path.join(SCREENSHOT_DIR, `upload_page_${theme.id}.png`);
  await page.screenshot({ path: ssUpload });
  console.log(`[Upload] Screenshot of upload page saved: ${ssUpload}`);

  // Find file input
  console.log('[Upload] Looking for file input...');
  let fileInput = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      fileInput = await page.waitForSelector('input[type="file"]', { timeout: 8000 });
      if (fileInput) {
        console.log(`[Upload] Found file input on attempt ${attempt}`);
        break;
      }
    } catch (e) {
      console.log(`[Upload] Attempt ${attempt} failed, retrying...`);
      await delay(3000);
    }
  }

  if (!fileInput) {
    throw new Error(`Could not find file input for ${theme.id}`);
  }

  // Upload the video file
  console.log('[Upload] Uploading video file...');
  await fileInput.uploadFile(videoPath);
  console.log('[Upload] File transmitted. Waiting for processing...');
  await delay(15000);

  // Screenshot after file upload
  const ssAfterUpload = path.join(SCREENSHOT_DIR, `after_upload_${theme.id}.png`);
  await page.screenshot({ path: ssAfterUpload });
  console.log(`[Upload] Post-upload screenshot: ${ssAfterUpload}`);

  // Dismiss any welcome modal
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => 
      b.innerText.includes('Entendido') || 
      b.textContent.includes('Entendido') ||
      b.innerText.includes('Got it') ||
      b.textContent.includes('Got it')
    );
    if (btn) btn.click();
  });
  await delay(2000);

  // Find and fill caption editor
  console.log('[Upload] Looking for caption editor...');
  let editor = null;
  const editorSelectors = [
    '.public-DraftEditor-content[contenteditable="true"]',
    '[contenteditable="true"]',
    'div[data-contents="true"]'
  ];
  
  for (const sel of editorSelectors) {
    try {
      editor = await page.waitForSelector(sel, { timeout: 8000 });
      if (editor) {
        console.log(`[Upload] Found editor with selector: ${sel}`);
        break;
      }
    } catch (e) {
      // try next
    }
  }

  if (editor) {
    console.log('[Upload] Writing caption...');
    await editor.click();
    await delay(500);
    // Select all and delete existing text
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await delay(500);
    await page.keyboard.type(caption, { delay: 30 });
    await delay(2000);
    console.log('[Upload] Caption written successfully');
  } else {
    console.log('[Upload] ⚠️ Could not find caption editor, proceeding without caption');
  }

  // Screenshot before publish
  const ssBeforePublish = path.join(SCREENSHOT_DIR, `before_publish_${theme.id}.png`);
  await page.screenshot({ path: ssBeforePublish });
  console.log(`[Upload] Pre-publish screenshot: ${ssBeforePublish}`);

  // Click Publicar button
  console.log('[Upload] Clicking "Publicar" button...');
  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const pubBtn = buttons.find(b => 
      b.innerText.trim() === 'Publicar' || 
      b.textContent.trim() === 'Publicar' ||
      b.innerText.trim() === 'Post' ||
      b.textContent.trim() === 'Post'
    );
    if (pubBtn) {
      pubBtn.click();
      return true;
    }
    return false;
  });
  console.log('[Upload] Publish clicked:', clicked);
  await delay(5000);

  // Check for confirmation modal
  const confirmed = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmBtn = buttons.find(b => 
      b.innerText.includes('Publicar ahora') || 
      b.textContent.includes('Publicar ahora') ||
      b.innerText.includes('Post now') ||
      b.textContent.includes('Post now')
    );
    if (confirmBtn) {
      confirmBtn.click();
      return true;
    }
    return false;
  });
  console.log('[Upload] Confirmation clicked:', confirmed);
  await delay(15000);

  // Final screenshot
  const ssFinal = path.join(SCREENSHOT_DIR, `published_${theme.id}.png`);
  await page.screenshot({ path: ssFinal });
  console.log(`[Upload ${index+1}/3] ✅ Final screenshot: ${ssFinal}`);

  return {
    theme: theme.id,
    videoPath,
    screenshots: {
      uploadPage: ssUpload,
      afterUpload: ssAfterUpload,
      beforePublish: ssBeforePublish,
      final: ssFinal
    }
  };
}

// ===================== MAIN =====================
(async () => {
  console.log('='.repeat(60));
  console.log('TikMagicTok - Uploading 3 Videos of Different Themes');
  console.log('='.repeat(60));

  // Step 1: Render all 3 videos
  console.log('\n📹 PHASE 1: Rendering videos...');
  const videoPaths = [];
  for (let i = 0; i < themes.length; i++) {
    const vp = renderVideo(themes[i], i);
    extractFrame(vp, themes[i]);
    videoPaths.push(vp);
  }

  // Step 2: Connect to browser
  console.log('\n🌐 PHASE 2: Connecting to browser...');
  const wsUrl = await getBrowserWS();
  console.log('Browser WS:', wsUrl);
  const browser = await puppeteer.connect({
    browserWSEndpoint: wsUrl,
    defaultViewport: null
  });

  // Step 3: Upload each video one by one
  console.log('\n🚀 PHASE 3: Uploading videos...');
  const results = [];
  for (let i = 0; i < themes.length; i++) {
    try {
      const result = await uploadToTikTok(browser, videoPaths[i], themes[i].caption, themes[i], i);
      results.push(result);
      console.log(`\n✅ Video ${i+1}/3 (${themes[i].id}) uploaded successfully!`);
      
      if (i < themes.length - 1) {
        console.log('Waiting 10 seconds before next upload...');
        await delay(10000);
      }
    } catch (err) {
      console.error(`\n❌ Video ${i+1}/3 (${themes[i].id}) failed:`, err.message);
      results.push({ theme: themes[i].id, error: err.message });
    }
  }

  // Step 4: Take final evidence - navigate to content page
  console.log('\n📸 PHASE 4: Capturing final evidence...');
  const pages = await browser.pages();
  let tiktokPage = null;
  for (const p of pages) {
    if (p.url().includes('tiktok.com')) {
      tiktokPage = p;
      break;
    }
  }
  
  if (tiktokPage) {
    await tiktokPage.goto('https://www.tiktok.com/tiktokstudio/content', { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    await delay(5000);
    const finalEvidence = path.join(SCREENSHOT_DIR, 'final_evidence_all_videos.png');
    await tiktokPage.screenshot({ path: finalEvidence, fullPage: false });
    console.log(`📸 Final evidence screenshot: ${finalEvidence}`);
  }

  await browser.disconnect();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(60));
  results.forEach((r, i) => {
    if (r.error) {
      console.log(`  ${i+1}. ${r.theme}: ❌ FAILED - ${r.error}`);
    } else {
      console.log(`  ${i+1}. ${r.theme}: ✅ PUBLISHED`);
    }
  });
  console.log('='.repeat(60));
  console.log('DONE!');
})();
