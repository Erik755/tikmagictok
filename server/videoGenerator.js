const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');

// Set pre-built static binary of ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const db = require('./db');
const aiService = require('./aiService');

// Color accent mappings per category for modern look
const COLOR_SCHEMES = {
  tecnologia: { accent: '#00FFFF', font: 'cyan' },     // Neon cyan
  motivacion: { accent: '#39FF14', font: 'lime' },     // Neon green
  comedia: { accent: '#FF1493', font: 'deeppink' },    // Neon pink
  educacion: { accent: '#FFD700', font: 'gold' },      // Neon gold
  entretenimiento: { accent: '#FF4500', font: 'orange' } // Neon orange
};

/**
 * Maps a trend hashtag to one of the five specific categories
 * and returns the corresponding premium background template path.
 */
function getThematicBackground(hashtag) {
  const lower = hashtag.toLowerCase();
  let category = 'entretenimiento'; // default

  if (
    lower.includes('tech') || lower.includes('program') || lower.includes('code') || 
    lower.includes('ai') || lower.includes('ia') || lower.includes('gadg') || 
    lower.includes('robot') || lower.includes('soft') || lower.includes('laptop') ||
    lower.includes('pc') || lower.includes('desarroll')
  ) {
    category = 'tecnologia';
  } else if (
    lower.includes('fit') || lower.includes('gym') || lower.includes('work') || 
    lower.includes('salud') || lower.includes('sport') || lower.includes('motiv') || 
    lower.includes('mind') || lower.includes('grow') || lower.includes('goals') || 
    lower.includes('succe') || lower.includes('discipli') || lower.includes('entren')
  ) {
    category = 'motivacion';
  } else if (
    lower.includes('comed') || lower.includes('ris') || lower.includes('chist') || 
    lower.includes('gat') || lower.includes('cat') || lower.includes('funny') || 
    lower.includes('prank') || lower.includes('fail') || lower.includes('humor') || 
    lower.includes('meme') || lower.includes('diverti')
  ) {
    category = 'comedia';
  } else if (
    lower.includes('cienc') || lower.includes('sab') || lower.includes('apren') || 
    lower.includes('dat') || lower.includes('fact') || lower.includes('science') || 
    lower.includes('histor') || lower.includes('learn') || lower.includes('edu') || 
    lower.includes('know') || lower.includes('psycho') || lower.includes('curios')
  ) {
    category = 'educacion';
  } else if (
    lower.includes('cook') || lower.includes('recet') || lower.includes('cocin') || 
    lower.includes('diet') || lower.includes('food') || lower.includes('story') || 
    lower.includes('life') || lower.includes('aesthe') || lower.includes('satis') || 
    lower.includes('style') || lower.includes('comer')
  ) {
    category = 'entretenimiento';
  } else {
    // Random fallback to keep it always different and diverse
    const cats = ['entretenimiento', 'comedia', 'tecnologia', 'motivacion', 'educacion'];
    category = cats[Math.floor(Math.random() * cats.length)];
  }

  const bgMap = {
    tecnologia: 'tech_bg.png',
    motivacion: 'fit_bg.png',
    comedia: 'comedy_bg.png',
    educacion: 'edu_bg.png',
    entretenimiento: 'ent_bg.png'
  };

  const filename = bgMap[category];
  const bgPath = path.resolve(__dirname, '..', 'templates', filename);

  return {
    path: fs.existsSync(bgPath) ? bgPath : path.resolve(__dirname, '..', 'templates', 'background.png'),
    category
  };
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
 * Generates a thematic background, applies randomized cinematic motion,
 * overlays styled text with the AI intro, trend hashtag, and call-to-action.
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

      // Select dynamic background matching category
      const thematicBg = getThematicBackground(trend.hashtag);
      console.log(`[Video Generator] Trend #${trend.hashtag} mapped to category: ${thematicBg.category}`);
      console.log(`[Video Generator] Using background template: ${path.basename(thematicBg.path)}`);

      // Generate highly detailed thematic content using our Llama-3 AI service!
      const aiContent = await aiService.generateThematicContent(trend.hashtag);

      // Select a randomized kinetic pan/zoom motion
      const kinetic = getRandomKineticMotion(duration);
      console.log(`[Video Generator] Applying randomized background motion pattern #${kinetic.id}`);

      const music = path.resolve(__dirname, '..', 'templates', 'music.mp3');
      const musicExists = fs.existsSync(music);

      const ff = ffmpeg();

      // Input background image (looped for duration)
      ff.input(thematicBg.path).inputOptions(['-loop 1']);

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
          resolve(outputPath);
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
