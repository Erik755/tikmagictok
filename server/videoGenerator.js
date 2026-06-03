require('dotenv').config();
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const axios = require('axios');

// Set pre-built static binary of ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const db = require('./db');
const aiService = require('./aiService');
const aiVisualService = require('./aiVisualService');
const ttsService = require('./ttsService');
const musicService = require('./musicService');

// Styling schemes for custom neon aesthetics
const COLOR_SCHEMES = {
  neon_cyan: { accent: '#00FFFF', font: 'cyan' },
  neon_green: { accent: '#39FF14', font: 'lime' },
  neon_pink: { accent: '#FF1493', font: 'deeppink' },
  gold: { accent: '#FFD700', font: 'gold' },
  basic: { accent: '#FFFFFF', font: 'white' }
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
 * Downloads a background video directly via HTTP (no Chrome dependency).
 * Tries multiple CDN-friendly user-agents and headers.
 */
async function downloadVideoDirectHTTP(url, outputPath) {
  console.log(`[Video Generator] Downloading background video directly via HTTP: ${url}`);
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 45000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://mixkit.co/',
      'Origin': 'https://mixkit.co'
    }
  });
  fs.writeFileSync(outputPath, response.data);
  console.log(`[Video Generator] Direct HTTP download succeeded: ${path.basename(outputPath)} (${response.data.length} bytes)`);
  return outputPath;
}


// Curated free vertical video CDN URLs organized by category (no API key needed!)
// All URLs verified working (200 OK) from Coverr.co free library
const FREE_VERTICAL_VIDEOS = {
  tecnologia: [
    'https://cdn.coverr.co/videos/coverr-a-person-coding-on-a-laptop-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-developer-working-on-a-laptop-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-man-typing-on-a-laptop-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-abstract-flowing-particles-1/720p.mp4'
  ],
  motivacion: [
    'https://cdn.coverr.co/videos/coverr-young-man-jogging-in-the-city-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-man-running-on-a-treadmill-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-person-running-on-the-street-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-young-woman-exercising-1/720p.mp4'
  ],
  comedia: [
    'https://cdn.coverr.co/videos/coverr-close-up-of-a-cat-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-cat-playing-with-a-toy-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-puppy-in-slow-motion-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-two-puppies-playing-1/720p.mp4'
  ],
  educacion: [
    'https://cdn.coverr.co/videos/coverr-stars-in-the-night-sky-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-the-milky-way-over-mountains-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-abstract-flowing-particles-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-person-coding-on-a-laptop-1/720p.mp4'
  ],
  entretenimiento: [
    'https://cdn.coverr.co/videos/coverr-coffee-being-poured-into-a-cup-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-a-chef-cooking-in-the-kitchen-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-close-up-of-a-cat-1/720p.mp4',
    'https://cdn.coverr.co/videos/coverr-young-man-jogging-in-the-city-1/720p.mp4'
  ]
};


/**
 * Downloads a themed free vertical video from our curated CDN pool.
 * No API key required.
 */
async function downloadFreeVerticalVideo(category, outputPath) {
  const pool = FREE_VERTICAL_VIDEOS[category] || FREE_VERTICAL_VIDEOS.entretenimiento;
  // Try each URL in random order until one works
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  
  for (const url of shuffled) {
    try {
      console.log(`[Free Video] Trying: ${url.split('/').slice(-2).join('/')}`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
          'Referer': 'https://coverr.co/'
        }
      });
      if (response.data && response.data.length > 50000) { // Min 50KB to be a real video
        fs.writeFileSync(outputPath, response.data);
        console.log(`[Free Video] ✅ Downloaded: ${path.basename(outputPath)} (${response.data.length} bytes)`);
        return outputPath;
      }
    } catch (e) {
      console.warn(`[Free Video] URL failed: ${e.message}`);
    }
  }
  throw new Error(`All free video CDN URLs failed for category: ${category}`);
}


/**
 * Downloads a random vertical photo from Picsum Photos (always works, no key needed).
 */
async function downloadPicsumImage(outputPath) {
  console.log('[Video Generator] Fetching random vertical image from Picsum Photos...');
  const imageUrl = `https://picsum.photos/720/1280?random=${Date.now()}`;
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  fs.writeFileSync(outputPath, response.data);
  console.log(`[Video Generator] Picsum image downloaded: ${path.basename(outputPath)} (${response.data.length} bytes)`);
  return outputPath;
}

function getRandomKineticMotion(duration) {
  const motions = [
    `scale=800:1422,crop=720:1280:'80*t/${duration}':71`,
    `scale=800:1422,crop=720:1280:40:'142*t/${duration}'`,
    `scale=800:1422,crop=720:1280:'40*(1+sin(2*3.14159*t/10))':'71*(1+cos(2*3.14159*t/12))'`,
    `scale=800:1422,crop=720:1280:'80*t/${duration}':'142*t/${duration}'`,
    `scale=800:1422,crop=720:1280:'80*(1-t/${duration})':'142*(1-t/${duration})'`
  ];
  const selectedIndex = Math.floor(Math.random() * motions.length);
  return {
    expression: motions[selectedIndex],
    id: selectedIndex + 1
  };
}

/**
 * Creates a TikTok vertical video using AI copy, optional TTS, and styling.
 * No Chrome/Puppeteer dependency — uses direct HTTP downloads only.
 */
async function createVideo(trend, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const outputDir = path.resolve(__dirname, '..', 'output');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `trend_${trend.id || Date.now()}.mp4`);

      // 1. Configure settings and durations
      const dbSettings = await db.getLatestSettings();
      const duration = 30; // Force 30 seconds

      // 2. Generate thematic copy via AI engine
      const aiContent = await aiService.generateThematicContent(trend.hashtag);
      const category = options.visualTheme || aiContent.category;
      console.log(`[Video Generator] Trend #${trend.hashtag} resolved category: ${category}`);

      // 3. Select unique stock video from pools
      let recentUrls = [];
      try {
        recentUrls = await db.getRecentBackgroundUrls(25);
      } catch (err) {
        console.warn(`[Video Generator] History error: ${err.message}`);
      }

      const categoryPool = CINEMATIC_VIDEOS[category] || CINEMATIC_VIDEOS.entretenimiento;
      const unusedInCategory = categoryPool.filter(url => !recentUrls.includes(url));

      let selectedVideoUrl;
      if (unusedInCategory.length > 0) {
        selectedVideoUrl = unusedInCategory[Math.floor(Math.random() * unusedInCategory.length)];
      } else {
        const allPool = Object.values(CINEMATIC_VIDEOS).flat();
        const unusedGlobally = allPool.filter(url => !recentUrls.includes(url));
        selectedVideoUrl = unusedGlobally.length > 0 ? unusedGlobally[Math.floor(Math.random() * unusedGlobally.length)] : categoryPool[0];
      }
      
      const cacheDir = path.resolve(__dirname, '..', 'templates', 'cache');
      if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

      let localBgPath = null;
      let usingVideoBackground = false;

      // =====================================================================
      // PRIMARY: Try curated free vertical video CDN pool (no API key needed!)
      // =====================================================================
      const freeVideoPath = path.join(cacheDir, `free_video_${Date.now()}.mp4`);

      try {
        console.log(`[Video Generator] Fetching themed free video for category: "${category}"...`);
        await downloadFreeVerticalVideo(category, freeVideoPath);
        localBgPath = freeVideoPath;
        usingVideoBackground = true;
        console.log(`[Video Generator] ✅ Free video background ready!`);
      } catch (freeVideoErr) {
        console.warn(`[Video Generator] Free video CDN failed: ${freeVideoErr.message}. Trying Mixkit stock video...`);
      }

      // =====================================================================
      // SECONDARY: Try Mixkit stock video via direct HTTP download
      // =====================================================================
      if (!usingVideoBackground) {
        const videoFilename = path.basename(selectedVideoUrl);
        const cachedVideoPath = path.join(cacheDir, videoFilename);

        if (fs.existsSync(cachedVideoPath) && fs.statSync(cachedVideoPath).size > 10000) {
          console.log(`[Video Generator] Loading cached Mixkit video: ${videoFilename}`);
          localBgPath = cachedVideoPath;
          usingVideoBackground = true;
        } else {
          try {
            await downloadVideoDirectHTTP(selectedVideoUrl, cachedVideoPath);
            localBgPath = cachedVideoPath;
            usingVideoBackground = true;
            console.log(`[Video Generator] ✅ Mixkit stock video downloaded via HTTP!`);
          } catch (mixkitErr) {
            console.warn(`[Video Generator] Mixkit HTTP download failed: ${mixkitErr.message}. Trying DALL-E if configured...`);
          }
        }
      }

      // =====================================================================
      // TERTIARY: DALL-E 3 image generation (if backgroundStyle = 'dalle')
      // =====================================================================
      if (!usingVideoBackground && options.backgroundStyle === 'dalle') {
        try {
          console.log(`[Video Generator] Requesting DALL-E 3 visual for: "${options.customPrompt || aiContent.visualPrompt}"`);
          const aiVisualFilename = `ai_visual_${Date.now()}.png`;
          const generatedVisualPath = await aiVisualService.generateTrendVisual(options.customPrompt || aiContent.visualPrompt, aiVisualFilename);
          localBgPath = generatedVisualPath;
          console.log(`[Video Generator] ✅ DALL-E 3 image generated!`);
        } catch (aiErr) {
          console.log(`[Video Generator] DALL-E generation failed: ${aiErr.message}`);
        }
      }

      // =====================================================================
      // QUATERNARY: Cat API / Picsum photo fallback (always works, no key)
      // =====================================================================
      if (!localBgPath) {
        try {
          const lowerPrompt = (options.customPrompt || aiContent.visualPrompt || '').toLowerCase();
          const lowerTrend = trend.hashtag.toLowerCase();
          let imageUrl = null;

          if (lowerPrompt.includes('cat') || lowerPrompt.includes('gato') || lowerPrompt.includes('kitten') || lowerTrend.includes('cat') || lowerTrend.includes('gato')) {
            console.log('[Video Generator] Cat theme! Fetching from The Cat API...');
            const catRes = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 10000 });
            if (catRes.data && catRes.data.length > 0) imageUrl = catRes.data[0].url;
          }

          const imgFilename = `public_bg_${Date.now()}.jpg`;
          const localImgPath = path.join(cacheDir, imgFilename);
          
          if (imageUrl) {
            const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
            fs.writeFileSync(localImgPath, imgResponse.data);
          } else {
            await downloadPicsumImage(localImgPath);
          }
          
          localBgPath = localImgPath;
          console.log(`[Video Generator] ✅ Photo fallback downloaded: ${imgFilename}`);
        } catch (fallbackImgErr) {
          console.warn(`[Video Generator] Photo fallback failed: ${fallbackImgErr.message}`);
        }
      }

      // =====================================================================
      // LAST RESORT: Generate a Mandelbrot fractal using FFmpeg lavfi
      // =====================================================================
      if (!localBgPath) {
        console.warn('[Video Generator] All download sources failed. Generating fractal background with FFmpeg...');
        const fallbackPath = path.join(cacheDir, `fractal_${Date.now()}.mp4`);
        try {
          const { execSync } = require('child_process');
          execSync(`"${ffmpegStatic}" -y -f lavfi -i mandelbrot=size=720x1280:rate=25:maxiter=200 -t ${duration} -c:v libx264 -pix_fmt yuv420p "${fallbackPath}"`, { stdio: 'ignore' });
          localBgPath = fallbackPath;
          usingVideoBackground = true;
        } catch (genErr) {
          localBgPath = path.resolve(__dirname, '..', 'templates', 'background.png');
        }
      }

      // 4. Download and configure background music soundtrack
      let musicPath = null;
      if (options.musicType && options.musicType !== 'none') {
        musicPath = await musicService.getMusicTrack(options.musicType);
      }

      // 5. Generate TTS voice narration
      let voicePath = null;
      let voiceText = options.voiceNarration;
      const cleanHashtag = trend.hashtag.replace(/_/g, ' ').replace(/#/g, '');
      
      const intro = `Hola, soy una inteligencia artificial en fase de aprendizaje continuo.`;
      const body = `Hoy analizaremos la tendencia de ${cleanHashtag}. ${aiContent.hook}. ${aiContent.fact}.`;
      const outro = `Estaré aprendiendo directamente de todo lo que escribas en los comentarios de este video, ¡así que por favor corrígeme o dame tus sugerencias! Sígueme para ver mi evolución diaria.`;
      
      if (!voiceText || !voiceText.trim()) {
        voiceText = `${intro} ${body} ${outro}`;
      } else {
        let text = voiceText;
        if (!text.toLowerCase().startsWith('hola, soy')) {
          text = `${intro} ${text}`;
        }
        if (!text.toLowerCase().includes('comentario') && !text.toLowerCase().includes('corrígeme') && !text.toLowerCase().includes('corrigeme')) {
          text = `${text} ${outro}`;
        }
        voiceText = text;
      }

      try {
        voicePath = await ttsService.generateNarration(voiceText);
      } catch (ttsErr) {
        console.warn(`[Video Generator] Narration synthesis failed: ${ttsErr.message}`);
      }

      // Select randomized kinetic crop motion
      const kinetic = getRandomKineticMotion(duration);
      const ff = ffmpeg();

      // Configure video input (0)
      const isVideoFile = localBgPath && localBgPath.endsWith('.mp4');
      if (isVideoFile) {
        ff.input(localBgPath).inputOptions(['-stream_loop -1']);
      } else {
        ff.input(localBgPath).inputOptions(['-loop 1']);
      }

      // Configure audio inputs
      let hasMusic = false;
      let hasVoice = false;

      if (musicPath && fs.existsSync(musicPath)) {
        ff.input(musicPath);
        hasMusic = true;
      }
      if (voicePath && fs.existsSync(voicePath)) {
        ff.input(voicePath);
        hasVoice = true;
      }

      // Silent track fallback if no audio is present
      if (!hasMusic && !hasVoice) {
        ff.input('anullsrc=channel_layout=stereo:sample_rate=44100').inputFormat('lavfi');
      }

      // Select colors and fonts
      const fontStyle = options.textStyle || 'neon_pink';
      const scheme = COLOR_SCHEMES[fontStyle] || COLOR_SCHEMES.neon_pink;
      const accentColor = scheme.accent;

      const userTitle = (options.title || aiContent.title).toUpperCase();
      const userHook = options.hook || aiContent.hook;
      const userFact = options.fact || aiContent.fact;
      const userFontSize = parseInt(options.fontSize) || 22;

      // Font file paths
      const fontFile = 'C:/Windows/Fonts/arial.ttf';
      const boldFont = 'C:/Windows/Fonts/arialbd.ttf';

      // Escape dynamic text outputs for safe FFmpeg filter processing
      const safeTitle = userTitle.replace(/'/g, "\\\\'").replace(/:/g, '\\:').replace(/%/g, '%%');
      const safeHook = userHook.replace(/'/g, "\\\\'").replace(/:/g, '\\:').replace(/%/g, '%%');
      const safeFact = userFact.replace(/'/g, "\\\\'").replace(/:/g, '\\:').replace(/%/g, '%%');
      const safeHashtag = trend.hashtag.replace(/'/g, "\\\\'").replace(/:/g, '\\:').replace(/%/g, '%%');

      // Create video overlays
      const filters = [
        kinetic.expression,
        "drawbox=x=0:y=0:w=720:h=1280:color=0x00000088:t=fill",
        `drawbox=x=0:y=0:w=720:h=6:color=${accentColor.replace('#', '0x')}FF:t=fill`,
        `drawbox=x=0:y=1274:w=720:h=6:color=${accentColor.replace('#', '0x')}FF:t=fill`,

        // Intro titles
        `drawtext=fontfile='${boldFont}':text='META AI VIDEO ENGINE':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=110:box=1:boxcolor=0x000000CC:boxborderw=10`,
        `drawtext=fontfile='${boldFont}':text='AUTONOMO':fontcolor=${accentColor}:fontsize=38:x=(w-text_w)/2:y=152:box=1:boxcolor=0x000000CC:boxborderw=10`,
        `drawtext=fontfile='${fontFile}':text='Generado con Meta Llama-3 en Español':fontcolor=white:fontsize=22:x=(w-text_w)/2:y=208:box=1:boxcolor=0x00000099:boxborderw=6`,
        `drawtext=fontfile='${boldFont}':text='Evolución autónoma sin asistencia humana.':fontcolor=yellow:fontsize=24:x=(w-text_w)/2:y=245:box=1:boxcolor=0x000000AA:boxborderw=8`,

        // Separator
        `drawbox=x=180:y=310:w=360:h=2:color=${accentColor.replace('#', '0x')}88:t=fill`,

        // Core Trend hashtag
        `drawtext=fontfile='${boldFont}':text='#${safeHashtag}':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=(h/2)-70:box=1:boxcolor=0x000000EE:boxborderw=16`,
        
        // Dynamic title copy
        `drawtext=fontfile='${boldFont}':text='${safeTitle}':fontcolor=${accentColor}:fontsize=${userFontSize}:x=(w-text_w)/2:y=(h/2)-120:box=1:boxcolor=0x000000AA:boxborderw=6`,

        // Dynamic hook copy
        `drawtext=fontfile='${fontFile}':text='${safeHook}':fontcolor=white:fontsize=18:x=(w-text_w)/2:y=(h/2)+10:box=1:boxcolor=0x00000099:boxborderw=6`,

        // Dynamic mind-blowing fact copy
        `drawtext=fontfile='${fontFile}':text='${safeFact}':fontcolor=yellow:fontsize=16:x=(w-text_w)/2:y=(h/2)+50:box=1:boxcolor=0x000000AA:boxborderw=5`,

        // Interactive UI Button Mockup
        `drawbox=x=150:y=760:w=420:h=64:color=${accentColor.replace('#', '0x')}FF:t=fill`,
        `drawtext=fontfile='${boldFont}':text='[ META STUDIO ]':fontcolor=0x111111:fontsize=30:x=(w-text_w)/2:y=776`,
        `drawbox=x=148:y=758:w=424:h=68:color=0xFFFFFFDD:t=2`,

        // Call to action
        `drawbox=x=0:y=950:w=720:h=110:color=0x000000AA:t=fill`,
        `drawtext=fontfile='${boldFont}':text='¡SIGUEME PARA MAS VIDEOS!':fontcolor=yellow:fontsize=28:x=(w-text_w)/2:y=970`,
        `drawtext=fontfile='${fontFile}':text='Generado y subido en segundos.':fontcolor=white:fontsize=18:x=(w-text_w)/2:y=1010`,

        // Watermark
        `drawtext=fontfile='${fontFile}':text='Meta AI Studio':fontcolor=0xFFFFFF33:fontsize=14:x=w-text_w-15:y=h-25`
      ].join(',');

      ff.videoFilters(filters);

      // 6. Build complex audio mixing filters in FFmpeg
      const complexFilters = [];
      if (hasMusic && hasVoice) {
        complexFilters.push({ filter: 'volume', options: { volume: 0.15 }, inputs: '1:a', outputs: 'bg_music' });
        complexFilters.push({ filter: 'volume', options: { volume: 1.25 }, inputs: '2:a', outputs: 'voice' });
        complexFilters.push({ filter: 'amix', options: { inputs: 2, duration: 'first', dropout_transition: 2 }, inputs: ['bg_music', 'voice'], outputs: 'a' });
        ff.complexFilter(complexFilters, 'a');
      } else if (hasMusic) {
        complexFilters.push({ filter: 'volume', options: { volume: 0.5 }, inputs: '1:a', outputs: 'a' });
        ff.complexFilter(complexFilters, 'a');
      } else if (hasVoice) {
        complexFilters.push({ filter: 'volume', options: { volume: 1.25 }, inputs: '1:a', outputs: 'a' });
        ff.complexFilter(complexFilters, 'a');
      } else {
        complexFilters.push({ filter: 'volume', options: { volume: 1.0 }, inputs: '1:a', outputs: 'a' });
        ff.complexFilter(complexFilters, 'a');
      }

      ff.outputOptions(['-map 0:v', '-c:v libx264', `-t ${duration}`, '-pix_fmt yuv420p', '-c:a aac']);
      
      console.log('[Video Generator] Compiling vertical MP4 with mixed tracks...');
      ff.save(outputPath)
        .on('end', () => {
          console.log(`[Video Generator] ✅ Video rendered successfully: ${outputPath}`);
          resolve({ videoPath: outputPath, backgroundUrl: selectedVideoUrl });
        })
        .on('error', (err) => {
          console.error('[Video Generator] FFmpeg mixing error:', err.message);
          reject(err);
        });

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { createVideo };
