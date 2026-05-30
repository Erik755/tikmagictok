const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const axios = require('axios');
const http = require('http');

// Set pre-built static binary of ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const db = require('./db');
const aiService = require('./aiService');
const aiVisualService = require('./aiVisualService');

// Color accent mappings per category for modern look
const COLOR_SCHEMES = {
  tecnologia: { accent: '#00FFFF', font: 'cyan' },     // Neon cyan
  motivacion: { accent: '#39FF14', font: 'lime' },     // Neon green
  comedia: { accent: '#FF1493', font: 'deeppink' },    // Neon pink
  educacion: { accent: '#FFD700', font: 'gold' },      // Neon gold
  entretenimiento: { accent: '#FF4500', font: 'orange' } // Neon orange
};

// 30 Gorgeous, high-fidelity Envato Mixkit royalty-free vertical-adaptable cinematic loops (6 per category)
const CINEMATIC_VIDEOS = {
  tecnologia: [
    'https://assets.mixkit.co/videos/preview/mixkit-hacker-typing-code-on-three-monitors-43228-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-developer-writing-code-on-a-computer-43227-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-code-running-on-a-computer-monitor-43224-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-a-circuit-board-31940-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-woman-typing-on-a-laptops-keyboard-43118-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-hands-typing-on-a-computer-keyboard-43119-large.mp4'
  ],
  motivacion: [
    'https://assets.mixkit.co/videos/preview/mixkit-man-doing-exercises-with-dumbbells-in-the-gym-43003-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-athlete-training-with-ropes-in-gym-43001-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-young-woman-running-on-a-treadmill-43004-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-boxer-hitting-a-punching-bag-in-gym-43002-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-a-man-training-arms-in-gym-43005-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-woman-doing-exercises-with-dumbbells-in-gym-43006-large.mp4'
  ],
  comedia: [
    'https://assets.mixkit.co/videos/preview/mixkit-cute-cat-resting-on-a-yellow-background-42999-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-funny-playful-kitten-playing-with-yarn-43000-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-dog-catching-a-ball-in-slow-motion-42996-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-two-cute-puppies-playing-together-42995-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-cute-puppy-sleeping-on-a-bed-42997-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-playful-cat-lying-on-a-bed-42998-large.mp4'
  ],
  educacion: [
    'https://assets.mixkit.co/videos/preview/mixkit-nebula-in-deep-space-43187-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-galaxy-spinning-in-space-43189-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-planet-earth-rotating-in-space-43190-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-abstract-physics-particles-swirling-around-43185-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-stars-in-deep-space-43186-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-abstract-physics-particles-moving-in-patterns-43184-large.mp4'
  ],
  entretenimiento: [
    'https://assets.mixkit.co/videos/preview/mixkit-fresh-vegetables-being-sliced-on-a-wooden-board-43085-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-chef-preparing-a-salad-43081-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-cup-of-freshly-brewed-coffee-43080-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-steak-sizzling-on-a-hot-frying-pan-43082-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-steaming-hot-coffee-pouring-into-a-cup-43079-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-slicing-fresh-ripe-tomatoes-on-a-wooden-board-43084-large.mp4'
  ]
};

/**
 * Downloads a video from a direct CDN URL and saves it to local templates cache.
 */
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

async function downloadBackgroundVideo(url, outputPath) {
  console.log(`[Video Generator] Bypassing CloudFront TLS block. Fetching stock video via remote Chrome...`);
  try {
    const { default: puppeteer } = await import('puppeteer-core');
    const wsUrl = await getBrowserWS();
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      defaultViewport: null
    });

    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const base64Data = await page.evaluate(async () => {
        const response = await fetch(window.location.href);
        if (!response.ok) throw new Error(`HTTP ${response.status} when fetching video`);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      });

      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(outputPath, buffer);
      console.log(`[Video Generator] Cinematic video successfully downloaded via Chrome: ${path.basename(outputPath)} (${buffer.length} bytes)`);
      return outputPath;
    } finally {
      await page.close();
      await browser.disconnect();
    }
  } catch (err) {
    console.error(`[Video Generator] Chrome bypass download failed: ${err.message}`);
    throw err;
  }
}

/**
 * Returns a randomized kinetic Ken Burns movement crop expression for FFmpeg.
 * This guarantees the background always has continuous motion and is "always different".
 */
function getRandomKineticMotion(duration) {
  const motions = [
    // Motion 1: Horizontal slow pan left-to-right
    `scale=800:1422,crop=720:1280:'80*t/${duration}':71`,
    // Motion 2: Vertical slow pan down
    `scale=800:1422,crop=720:1280:40:'142*t/${duration}'`,
    // Motion 3: Smooth wave breathing pan (orbital motion)
    `scale=800:1422,crop=720:1280:'40*(1+sin(2*3.14159*t/10))':'71*(1+cos(2*3.14159*t/12))'`,
    // Motion 4: Diagonal slow scroll top-left to bottom-right
    `scale=800:1422,crop=720:1280:'80*t/${duration}':'142*t/${duration}'`,
    // Motion 5: Diagonal reverse scroll bottom-right to top-left
    `scale=800:1422,crop=720:1280:'80*(1-t/${duration})':'142*(1-t/${duration})'`
  ];
  const selectedIndex = Math.floor(Math.random() * motions.length);
  return {
    expression: motions[selectedIndex],
    id: selectedIndex + 1
  };
}

/**
 * Creates a short TikTok-style video for a given trend.
 * Downloads/loads a dynamic cinematic background video loop, applies randomized motion,
 * and overlays AI Llama-3 script details.
 */
async function createVideo(trend) {
  return new Promise(async (resolve, reject) => {
    try {
      const outputDir = path.resolve(__dirname, '..', 'output');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `trend_${trend.id || Date.now()}.mp4`);

      // Fetch self-optimized settings from database
      const settings = await db.getLatestSettings();
      const duration = settings.duration || 15;

      // Generate highly detailed thematic content using our Llama-3 AI service!
      const aiContent = await aiService.generateThematicContent(trend.hashtag);
      console.log(`[Video Generator] Trend #${trend.hashtag} resolved category: ${aiContent.category}`);

      // Get recently used background URLs from database to avoid repeating
      let recentUrls = [];
      try {
        recentUrls = await db.getRecentBackgroundUrls(25);
        console.log(`[Video Generator] Fetched ${recentUrls.length} recently used background video URLs.`);
      } catch (err) {
        console.warn(`[Video Generator] Failed to fetch recent background history: ${err.message}`);
      }

      // Filter current category pool for unused URLs
      const categoryPool = CINEMATIC_VIDEOS[aiContent.category] || CINEMATIC_VIDEOS.entretenimiento;
      const unusedInCategory = categoryPool.filter(url => !recentUrls.includes(url));

      let selectedVideoUrl;
      if (unusedInCategory.length > 0) {
        selectedVideoUrl = unusedInCategory[Math.floor(Math.random() * unusedInCategory.length)];
        console.log(`[Video Generator] Selected unused background from category "${aiContent.category}": ${path.basename(selectedVideoUrl)}`);
      } else {
        console.log(`[Video Generator] All backgrounds in category "${aiContent.category}" were used recently. Finding unused globally...`);
        // Fallback: filter entire pool for unused URLs
        const allPool = Object.values(CINEMATIC_VIDEOS).flat();
        const unusedGlobally = allPool.filter(url => !recentUrls.includes(url));

        if (unusedGlobally.length > 0) {
          selectedVideoUrl = unusedGlobally[Math.floor(Math.random() * unusedGlobally.length)];
          console.log(`[Video Generator] Selected unused background globally: ${path.basename(selectedVideoUrl)}`);
        } else {
          // Ultimate fallback (LRU): choose the one that was used the longest time ago (earliest index in recentUrls)
          console.log(`[Video Generator] Mathematical anomaly: All 30 backgrounds have been used recently. Selecting Least Recently Used...`);
          let oldestUrl = categoryPool[0];
          let oldestIndex = -1;
          for (const url of allPool) {
            const idx = recentUrls.indexOf(url);
            if (idx === -1) {
              oldestUrl = url;
              break;
            }
            if (idx > oldestIndex) {
              oldestIndex = idx;
              oldestUrl = url;
            }
          }
          selectedVideoUrl = oldestUrl;
          console.log(`[Video Generator] LRU background selected: ${path.basename(selectedVideoUrl)}`);
        }
      }
      
      const cacheDir = path.resolve(__dirname, '..', 'templates', 'cache');
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

      let localBgPath = null;
      let usingAiVisual = false;

      // Layer 1: Attempt dynamic customized AI Visual generation matching the exact trend copy (DALL-E 3)
      try {
        console.log(`[Video Generator] Attempting to generate a custom DALL-E 3 visual matching trend hashtag #${trend.hashtag}...`);
        const aiVisualFilename = `ai_visual_${Date.now()}.png`;
        const generatedVisualPath = await aiVisualService.generateTrendVisual(aiContent.visualPrompt, aiVisualFilename);
        
        localBgPath = generatedVisualPath;
        usingAiVisual = true;
        console.log(`[Video Generator] Successfully generated unique AI portrait background: ${aiVisualFilename}`);
      } catch (aiErr) {
        console.log(`[Video Generator] AI visual generation skipped/failed: ${aiErr.message}`);
        console.log(`[Video Generator] Falling back to Layer 2: Envato Mixkit cinematic stock video loops.`);
      }

      // Layer 2: Fallback to Mixkit stock videos if AI Visual was not generated
      if (!usingAiVisual) {
        const videoFilename = path.basename(selectedVideoUrl);
        const cachedVideoPath = path.join(cacheDir, videoFilename);
        localBgPath = cachedVideoPath;

        if (fs.existsSync(cachedVideoPath)) {
          console.log(`[Video Generator] Loading cinematic video background from local cache: ${videoFilename}`);
        } else {
          console.log(`[Video Generator] Cinematic video background not cached. Querying Envato Mixkit...`);
          try {
            await downloadBackgroundVideo(selectedVideoUrl, cachedVideoPath);
            console.log(`[Video Generator] Cinematic video cached successfully: ${videoFilename}`);
          } catch (downloadErr) {
            console.warn(`[Video Generator] Envato stock download failed. Falling back to Layer 3: Dynamic Mandelbrot Fractal Zoom...`);
            // Layer 3: local dynamic math rendering fallback
            const randomX = (-2.0 + Math.random() * 3.2).toFixed(6);
            const randomY = (-1.2 + Math.random() * 2.4).toFixed(6);
            const randomIter = Math.floor(100 + Math.random() * 400);
            
            const fallbackFilename = `cinematic_fractal_${Date.now()}.mp4`;
            const fallbackPath = path.join(cacheDir, fallbackFilename);
            
            try {
              console.log(`[Video Generator] Encoding customized 3D fractal zoom at X:${randomX} Y:${randomY} Iterations:${randomIter}...`);
              const { execSync } = require('child_process');
              const FFMPEG_BIN = ffmpegStatic;
              
              execSync(`"${FFMPEG_BIN}" -y -f lavfi -i mandelbrot=size=720x1280:rate=25:maxiter=${randomIter}:start_x=${randomX}:start_y=${randomY} -t ${duration} -c:v libx264 -pix_fmt yuv420p "${fallbackPath}"`, { stdio: 'ignore' });
              
              localBgPath = fallbackPath;
              console.log(`[Video Generator] Loop fallback successfully generated! File: ${fallbackFilename}`);
            } catch (genErr) {
              console.error(`[Video Generator] Fractal loop generation failed:`, genErr.message);
              // Emergency fallback
              localBgPath = path.resolve(__dirname, '..', 'templates', 'background.png');
            }
          }
        }
      }

      // Select a randomized kinetic pan/zoom motion
      const kinetic = getRandomKineticMotion(duration);
      console.log(`[Video Generator] Applying randomized background motion pattern #${kinetic.id}`);

      const music = path.resolve(__dirname, '..', 'templates', 'music.mp3');
      const musicExists = fs.existsSync(music);

      const ff = ffmpeg();

      // Input cinematic video/image loop
      if (localBgPath.endsWith('.mp4')) {
        ff.input(localBgPath).inputOptions(['-stream_loop -1']);
      } else {
        ff.input(localBgPath).inputOptions(['-loop 1']);
      }

      // Escape hashtag for FFmpeg drawtext filter safety
      const safeHashtag = trend.hashtag
        .replace(/'/g, "\\\\'")
        .replace(/:/g, '\\:')
        .replace(/%/g, '%%');

      const fontFile = 'C:/Windows/Fonts/arial.ttf';
      const boldFont = 'C:/Windows/Fonts/arialbd.ttf';
      
      // Determine colors based on category
      const scheme = COLOR_SCHEMES[aiContent.category] || COLOR_SCHEMES.entretenimiento;
      const accentColor = scheme.accent;

      // Escape dynamic text outputs for safe FFmpeg filter processing
      const safeTitle = aiContent.title.replace(/'/g, "\\\\'").replace(/:/g, '\\:');
      const safeHook = aiContent.hook.replace(/'/g, "\\\\'").replace(/:/g, '\\:');
      const safeFact = aiContent.fact.replace(/'/g, "\\\\'").replace(/:/g, '\\:');

      // Build premium multi-layer vertical design filters
      const filters = [
        // 1. First apply the randomized moving pan/zoom (Ken Burns effect) over the high-res image
        kinetic.expression,

        // 2. Add semi-transparent dark overlay for cinematic readability
        "drawbox=x=0:y=0:w=720:h=1280:color=0x00000088:t=fill",

        // 3. Accent colored framing bars (neon touch)
        `drawbox=x=0:y=0:w=720:h=6:color=${accentColor.replace('#', '0x')}FF:t=fill`,
        `drawbox=x=0:y=1274:w=720:h=6:color=${accentColor.replace('#', '0x')}FF:t=fill`,

        // --- AI Introduction Section (top) ---
        `drawtext=fontfile='${boldFont}':text='SOY UNA INTELIGENCIA':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=110:box=1:boxcolor=0x000000CC:boxborderw=10`,
        `drawtext=fontfile='${boldFont}':text='ARTIFICIAL':fontcolor=${accentColor}:fontsize=38:x=(w-text_w)/2:y=152:box=1:boxcolor=0x000000CC:boxborderw=10`,
        `drawtext=fontfile='${fontFile}':text='y este es mi primer dia creando videos.':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=208:box=1:boxcolor=0x00000099:boxborderw=6`,
        `drawtext=fontfile='${boldFont}':text='Ira mejorando, ira evolucionando.':fontcolor=yellow:fontsize=24:x=(w-text_w)/2:y=245:box=1:boxcolor=0x000000AA:boxborderw=8`,

        // AI evolution details
        `drawtext=fontfile='${fontFile}':text='Evolucionara sola, sin asistencia humana.':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=298:box=1:boxcolor=0x000000AA:boxborderw=6`,

        // Separator line
        `drawbox=x=180:y=350:w=360:h=2:color=${accentColor.replace('#', '0x')}88:t=fill`,

        // --- Main Trend / Hashtag (center) ---
        `drawtext=fontfile='${boldFont}':text='#${safeHashtag}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h/2)-70:box=1:boxcolor=0x000000EE:boxborderw=18`,
        
        // Dynamically customized topic headline (Llama-3 AI / NLP)
        `drawtext=fontfile='${boldFont}':text='${safeTitle}':fontcolor=${accentColor}:fontsize=22:x=(w-text_w)/2:y=(h/2)-120:box=1:boxcolor=0x000000AA:boxborderw=6`,

        // Dynamic viral hook (Llama-3 AI / NLP)
        `drawtext=fontfile='${fontFile}':text='${safeHook}':fontcolor=white:fontsize=20:x=(w-text_w)/2:y=(h/2)+10:box=1:boxcolor=0x00000099:boxborderw=6`,

        // Dynamic mind-blowing fact (Llama-3 AI / NLP)
        `drawtext=fontfile='${fontFile}':text='${safeFact}':fontcolor=yellow:fontsize=18:x=(w-text_w)/2:y=(h/2)+50:box=1:boxcolor=0x000000AA:boxborderw=5`,

        // --- Interactive Button Mock (below center) ---
        `drawbox=x=150:y=760:w=420:h=64:color=${accentColor.replace('#', '0x')}FF:t=fill`,
        `drawtext=fontfile='${boldFont}':text='[ Generate & Post ]':fontcolor=0x111111:fontsize=30:x=(w-text_w)/2:y=776`,
        `drawbox=x=148:y=758:w=424:h=68:color=0xFFFFFFDD:t=2`, // white border highlight

        // Extra details for buttons
        `drawtext=fontfile='${fontFile}':text='Presiona el boton para repetir el proceso':fontcolor=white:fontsize=18:x=(w-text_w)/2:y=845:box=1:boxcolor=0x000000AA:boxborderw=5`,

        // --- Follow CTA (bottom area) ---
        `drawbox=x=0:y=950:w=720:h=110:color=0x000000AA:t=fill`,
        `drawtext=fontfile='${boldFont}':text='¡SIGUEME para ver':fontcolor=yellow:fontsize=28:x=(w-text_w)/2:y=966`,
        `drawtext=fontfile='${boldFont}':text='mis proximos videos!':fontcolor=yellow:fontsize=28:x=(w-text_w)/2:y=1004`,

        // --- Hourly schedule info ---
        `drawtext=fontfile='${fontFile}':text='Publicando de forma autonoma cada hora en punto':fontcolor=0xDDDDDDDD:fontsize=16:x=(w-text_w)/2:y=1090:box=1:boxcolor=0x000000AA:boxborderw=4`,

        // --- App download link (very bottom) ---
        `drawtext=fontfile='${fontFile}':text='Descarga la app en':fontcolor=0xAAAAAAAA:fontsize=18:x=(w-text_w)/2:y=1150`,
        `drawtext=fontfile='${boldFont}':text='tikmagictok.app':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=1176:box=1:boxcolor=0x000000AA:boxborderw=6`,

        // Watermark
        `drawtext=fontfile='${fontFile}':text='TikMagicTok AI System':fontcolor=0xFFFFFF44:fontsize=14:x=w-text_w-15:y=h-25`
      ].join(',');

      ff.videoFilters(filters);

      if (musicExists) {
        ff.input(music);
      } else {
        ff.input('anullsrc=channel_layout=stereo:sample_rate=44100')
          .inputFormat('lavfi');
      }

      ff.outputOptions(['-c:v libx264', `-t ${duration}`, '-pix_fmt yuv420p', '-c:a aac', '-shortest']);
      ff.save(outputPath)
        .on('end', () => {
          console.log(`[Video Generator] Video rendered successfully: ${outputPath}`);
          resolve({ videoPath: outputPath, backgroundUrl: selectedVideoUrl });
        })
        .on('error', (err) => {
          console.error('[Video Generator] FFmpeg error:', err.message);
          reject(err);
        });
    } catch (dbErr) {
      reject(dbErr);
    }
  });
}

module.exports = { createVideo };
