// server/index.js
require('dotenv').config();
const express = require('express');

// Global console log buffer for real-time external page streaming
global.serverLogs = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  originalLog(...args);
  global.serverLogs.push({ time: new Date().toLocaleTimeString(), text: msg, type: 'info' });
  if (global.serverLogs.length > 60) global.serverLogs.shift();
};

console.error = (...args) => {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
  originalError(...args);
  global.serverLogs.push({ time: new Date().toLocaleTimeString(), text: msg, type: 'error' });
  if (global.serverLogs.length > 60) global.serverLogs.shift();
};

// Global error handlers to prevent server crashes
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');

const tiktokApi = require('./tiktokApi');
const trendService = require('./trendService');
const videoGenerator = require('./videoGenerator');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));


// OAuth routes
app.get('/auth/login', tiktokApi.login);
app.get('/auth/callback', tiktokApi.callback);

// Autopilot state variables
let autoPublishInterval = null;
let isAutoPublishRunning = false;

function startAutopilotLoop(intervalMinutes) {
  if (autoPublishInterval) {
    clearInterval(autoPublishInterval);
  }
  
  const intervalMs = intervalMinutes * 60 * 1000;
  console.log(`[AI Auto-Publisher] Scheduling automatic cycles every ${intervalMinutes} minutes.`);
  
  autoPublishInterval = setInterval(async () => {
    const settings = await db.getLatestSettings().catch(() => null);
    if (settings && settings.autopilot_active === 1) {
      console.log(`[AI Auto-Publisher] Executing scheduled automatic post cycle...`);
      try {
        await runAutoPublishCycle();
      } catch (err) {
        console.error('[AI Auto-Publisher] Scheduled cycle error:', err.message);
      }
    }
  }, intervalMs);
}

function stopAutopilotLoop() {
  if (autoPublishInterval) {
    clearInterval(autoPublishInterval);
    autoPublishInterval = null;
  }
  console.log('[AI Auto-Publisher] Background autopilot loop cleared.');
}

// Helper to choose a completely unique, never-repeated trend
async function getUniqueTrendToPublish() {
  const allTrends = await db.getAllTrends();
  const lastTrendId = await db.getLastPostedTrendId().catch(() => null);
  
  // Query all unique trend IDs that have already been posted
  const postedIds = await db.getPostedTrendIds();

  // Find a trend from the fetched daily trends that has not been posted and is not the last posted trend
  const availableTrend = allTrends.find(t => !postedIds.includes(t.id) && String(t.id) !== String(lastTrendId));
  if (availableTrend) {
    return availableTrend;
  }

  // If all are posted, but we have some trends that are not the last posted one, we can reuse one
  const backupTrend = allTrends.find(t => String(t.id) !== String(lastTrendId));
  if (backupTrend) {
    return backupTrend;
  }

  // If all daily trends are already posted, generate a completely new, unique, never-repeated trend
  console.log('[AI Auto-Publisher] All daily trends have been posted. Generating a completely unique trend...');
  
  const subjects = ['tech', 'fitness', 'cooking', 'humor', 'science', 'mindset', 'coding', 'art', 'music', 'lifestyle'];
  const modifiers = ['challenge', 'hacks', 'tips', 'life', 'evolution', 'creative', 'future', 'daily', 'aesthetic', 'viral'];
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  
  const subject = subjects[Math.floor(Math.random() * subjects.length)];
  const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
  const uniqueHashtag = `${subject}${modifier}${randomSuffix}`;

  // Insert the newly generated unique trend into SQLite
  const newTrend = await db.insertTrend({
    hashtag: uniqueHashtag,
    videoUrl: null
  });
  
  return newTrend;
}

// Single automated cycle runner
async function runAutoPublishCycle() {
  console.log('[AI Auto-Publisher] Triggering dynamic video cycle...');
  try {
    // 1. Get a unique trend
    const trend = await getUniqueTrendToPublish();
    console.log(`[AI Auto-Publisher] Unique trend selected: #${trend.hashtag}`);

    // 2. Generate portrait dynamic video with custom background & kinetic crop motion
    const resultObj = await videoGenerator.createVideo(trend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;
    
    // 3. Upload to TikTok autonomously using Chrome browser remote debugging port
    const aiService = require('./aiService');
    const aiContent = await aiService.generateThematicContent(trend.hashtag).catch(() => ({ title: 'TikMagicTok' }));
    const titleClean = aiContent.title.toUpperCase();
    const caption = `${titleClean} ⚡ #${trend.hashtag.replace(/_/g, '')} - Estoy aprendiendo de lo que me escribas en los comentarios, ¡por favor corrígeme! 🤖 #IA #Aprendiendo #Foryou #TikMagicTok`;
    
    const result = await tiktokApi.uploadVideo(videoPath, caption);

    // 4. Record the published post in SQLite DB
    await db.recordPost(trend.id, videoPath, 'published', result.id, backgroundUrl);
    console.log(`[AI Auto-Publisher] Video successfully published! TikTok ID: ${result.id}`);

    // 5. Run continuous metric learning optimization
    const metricAnalyzer = require('./metricAnalyzer');
    setTimeout(() => {
      metricAnalyzer.runAnalysisAndOptimization().catch(console.error);
    }, 5000);

    return { success: true, hashtag: trend.hashtag, videoId: result.id };
  } catch (err) {
    console.error('[AI Auto-Publisher] Cycle failed:', err.message);
    throw err;
  }
}

// Autopilot Endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getLatestSettings();
    res.json(settings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  const { duration, bg_style, font_color, posting_interval, autopilot_active, is_simulated } = req.body;
  try {
    const durationVal = duration || 15;
    const bgVal = bg_style || 'cyberpunk';
    const fontVal = font_color || 'white';
    const intervalVal = posting_interval !== undefined ? parseInt(posting_interval) : 60;
    const activeVal = autopilot_active !== undefined ? parseInt(autopilot_active) : 0;
    const simVal = is_simulated !== undefined ? parseInt(is_simulated) : 1;

    // Save to database
    const updated = await db.updateSettings(durationVal, bgVal, fontVal, intervalVal, activeVal, simVal);

    // Dynamically adjust autopilot loop in memory
    isAutoPublishRunning = activeVal === 1;
    if (isAutoPublishRunning) {
      console.log(`[AI Auto-Publisher] Dynamic toggle: autopilot activated at ${intervalVal}m.`);
      startAutopilotLoop(intervalVal);
      
      // Run first cycle immediately to give the user instant visual proof
      runAutoPublishCycle().catch(err => {
        console.error('[AI Auto-Publisher] Immediate initial loop run failed:', err.message);
      });
    } else {
      console.log('[AI Auto-Publisher] Dynamic toggle: autopilot deactivated.');
      stopAutopilotLoop();
    }

    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/trends/auto-sync', async (req, res) => {
  console.log('[Trend Sync] Running automatic trend synchronization...');
  try {
    const trends = await trendService.fetchDailyTrends();
    const storedTrends = [];
    for (const tr of trends) {
      const stored = await db.insertTrend(tr);
      storedTrends.push(stored);
    }
    const allTrends = await db.getAllTrends();
    res.json({ success: true, trends: allTrends });
  } catch (e) {
    console.error('[Trend Sync] Automatic sync failed:', e.message);
    const allTrends = await db.getAllTrends().catch(() => []);
    res.json({ success: true, trends: allTrends, warning: 'Failed to fetch trends RSS; showing existing records.' });
  }
});

app.get('/api/logs', (req, res) => {
  res.json(global.serverLogs);
});

// Get current TikTok authentication status
app.get('/api/auth/status', (req, res) => {
  const isSimulated = process.env.SIMULATE_TIKTOK === 'true';
  const isAuthenticated = !!(global.tiktokTokens && global.tiktokTokens.access_token);
  res.json({
    simulated: isSimulated,
    authenticated: isAuthenticated,
    username: isSimulated ? 'korasproducciones' : (isAuthenticated ? 'TikTokCreator' : null)
  });
});

// System health status (no Chrome dependency)
app.get('/api/system/status', (req, res) => {
  const isSimulated = process.env.SIMULATE_TIKTOK === 'true';
  const hasToken = !!(global.tiktokTokens && global.tiktokTokens.access_token);
  const outputDir = path.join(__dirname, '..', 'output');
  const outputFiles = fs.existsSync(outputDir) ? fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4')) : [];
  
  res.json({
    status: 'online',
    version: '2.0.0',
    features: {
      videoGeneration: 'ready',
      ttsNarration: 'ready',
      tiktokPublish: hasToken ? 'ready' : (isSimulated ? 'simulated' : 'needs_auth'),
      chromeRequired: false
    },
    tiktok: {
      mode: isSimulated ? 'simulation' : 'production',
      authenticated: hasToken,
      apiVersion: 'v2-direct-post'
    },
    stats: {
      videosGenerated: outputFiles.length,
      autopilotActive: isAutoPublishRunning
    }
  });
});


// API to fetch stored trends
app.get('/api/trends', async (req, res) => {
  try {
    const trends = await db.getAllTrends();
    res.json(trends);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Trigger manual trend sync
app.post('/api/trends/fetch', async (req, res) => {
  try {
    const trends = await trendService.fetchDailyTrends();
    const storedTrends = [];
    for (const tr of trends) {
      const stored = await db.insertTrend(tr);
      storedTrends.push(stored);
    }
    res.json({ success: true, trends: storedTrends });
  } catch (e) {
    console.error('Manual fetch error:', e);
    res.status(500).json({ error: 'Manual trend sync failed' });
  }
});

// Generate video for a trend and auto‑publish (basic compatibility)
app.post('/api/generate-and-publish/:trendId', async (req, res) => {
  const { trendId } = req.params;
  try {
    const trend = await db.getTrendById(trendId);
    if (!trend) return res.status(404).json({ error: 'Trend not found' });

    const lastTrendId = await db.getLastPostedTrendId().catch(() => null);
    if (lastTrendId && String(lastTrendId) === String(trendId)) {
      console.warn(`[Server] Manual upload blocked: Trend ID ${trendId} was already published in the immediately preceding post.`);
      return res.status(400).json({ error: 'No se permite publicar la misma tendencia dos veces seguidas para mantener el feed dinámico. ¡Elige otro hashtag!' });
    }
    
    const resultObj = await videoGenerator.createVideo(trend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;
    
    // Fetch thematic content for dynamic matching description
    const aiService = require('./aiService');
    const aiContent = await aiService.generateThematicContent(trend.hashtag).catch(() => ({ title: 'TikMagicTok' }));
    const titleClean = aiContent.title.toUpperCase();
    const caption = `${titleClean} ⚡ #${trend.hashtag.replace(/_/g, '')} - Estoy aprendiendo de lo que me escribas en los comentarios, ¡por favor corrígeme! 🤖 #IA #Aprendiendo #Foryou #TikMagicTok`;

    console.log('[Server] Posting to TikTok via remote browser control...');
    const publishResult = await tiktokApi.uploadVideo(videoPath, caption);
    await db.recordPost(trendId, videoPath, 'published', publishResult.id, backgroundUrl);

    console.log('[Server] Running self-learning metrics optimization...');
    const metricAnalyzer = require('./metricAnalyzer');
    setTimeout(() => {
      metricAnalyzer.runAnalysisAndOptimization().catch(console.error);
    }, 5000);

    res.json({ success: true, tiktokVideoId: publishResult.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Generation/publish failed: ' + e.message });
  }
});

// Publish custom topic or scrape live popular TikTok trends if empty
app.post('/api/studio/publish-custom-topic', async (req, res) => {
  const { topic } = req.body;
  try {
    let finalTopic = (topic || '').trim();
    let trend = null;

    if (!finalTopic) {
      console.log('[Publish Custom] No topic entered. Scraping live popular TikTok trends...');
      const trends = await trendService.scrapeTikTokTrendsFromWeb();
      const lastTrendId = await db.getLastPostedTrendId().catch(() => null);
      
      // Select a trend that is not the last posted one
      const selected = trends.find(t => String(t.hashtag).toLowerCase() !== String(lastTrendId).toLowerCase()) || trends[0];
      if (!selected) {
        return res.status(500).json({ error: 'No se encontraron tendencias populares activas.' });
      }
      finalTopic = selected.hashtag;
      console.log(`[Publish Custom] Scraped popular trend selected: #${finalTopic}`);
      
      // Insert in database to get a valid trend ID
      trend = await db.insertTrend({ hashtag: finalTopic, videoUrl: null });
    } else {
      console.log(`[Publish Custom] Publishing video for custom user topic: "${finalTopic}"`);
      // Clean custom topic for hashtag formatting
      const cleanTopic = finalTopic.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g, '');
      trend = await db.insertTrend({ hashtag: cleanTopic, videoUrl: null });
    }

    // Now call the video generation and publishing pipeline
    const resultObj = await videoGenerator.createVideo(trend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;

    // Build dynamic description
    const aiService = require('./aiService');
    const aiContent = await aiService.generateThematicContent(trend.hashtag).catch(() => ({ title: 'TikMagicTok' }));
    const titleClean = aiContent.title.toUpperCase();
    const caption = `${titleClean} ⚡ #${trend.hashtag.replace(/_/g, '')} - Estoy aprendiendo de lo que me escribas en los comentarios, ¡por favor corrígeme! 🤖 #IA #Aprendiendo #Foryou #TikMagicTok`;

    console.log('[Publish Custom] Uploading to TikTok...');
    const publishResult = await tiktokApi.uploadVideo(videoPath, caption);
    
    // Save in DB
    await db.recordPost(trend.id, videoPath, 'published', publishResult.id, backgroundUrl);

    // Delete temporary file to save storage
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } catch (e) {}

    // Trigger metrics optimization loop
    const metricAnalyzer = require('./metricAnalyzer');
    setTimeout(() => {
      metricAnalyzer.runAnalysisAndOptimization().catch(console.error);
    }, 5000);

    res.json({
      success: true,
      topic: trend.hashtag,
      tiktokVideoId: publishResult.id,
      message: `¡Video de #${trend.hashtag} publicado con éxito en tu TikTok!`
    });

  } catch (err) {
    console.error('[Publish Custom] Operation failed:', err);
    res.status(500).json({ error: 'Publish failed: ' + err.message });
  }
});

// Meta AI Script preview generator
app.post('/api/ai/preview-script', async (req, res) => {
  const { hashtag } = req.body;
  try {
    const aiService = require('./aiService');
    const aiContent = await aiService.generateThematicContent(hashtag || 'tecnologia');
    res.json({ success: true, ...aiContent });
  } catch (err) {
    console.error('Error generating preview script:', err);
    res.status(500).json({ error: 'Failed to generate script preview' });
  }
});

// TTS audio clip generator
app.post('/api/tts/generate', async (req, res) => {
  const { text } = req.body;
  try {
    const ttsService = require('./ttsService');
    const localTtsPath = await ttsService.generateNarration(text);
    
    // Copy to public/cache/ so that the browser can preview the audio
    const publicCacheDir = path.resolve(__dirname, '..', 'public', 'cache');
    if (!fs.existsSync(publicCacheDir)) {
      fs.mkdirSync(publicCacheDir, { recursive: true });
    }
    const publicFilename = path.basename(localTtsPath);
    const publicDest = path.join(publicCacheDir, publicFilename);
    fs.copyFileSync(localTtsPath, publicDest);
    
    res.json({ success: true, audioUrl: `/cache/${publicFilename}` });
  } catch (err) {
    console.error('TTS generation failed:', err.message);
    res.status(500).json({ error: 'TTS generation failed: ' + err.message });
  }
});

// Advanced Meta AI Studio Video Builder & Publisher
app.post('/api/studio/create-post', async (req, res) => {
  const {
    trendId,
    title,
    hook,
    fact,
    textStyle,
    fontSize,
    musicType,
    voiceNarration,
    backgroundStyle,
    customPrompt,
    isSimulated,
    caption: customCaption
  } = req.body;

  try {
    const trend = await db.getTrendById(trendId) || { id: 0, hashtag: 'custom_meta_ai' };
    
    const options = {
      title,
      hook,
      fact,
      textStyle,
      fontSize,
      musicType,
      voiceNarration,
      backgroundStyle,
      customPrompt,
      duration: 15
    };

    console.log(`[Studio] Generation request received for trend: #${trend.hashtag}. Testing mode: ${isSimulated ? 'ACTIVE (SIMULATED)' : 'OFF (PRODUCTION)'}`);

    if (isSimulated) {
      console.log('[Studio] (SIMULACIÓN) Generating video assets...');
      await new Promise(r => setTimeout(r, 2000));
      console.log('[Studio] (SIMULACIÓN) Uploading video to TikTok Studio...');
      await new Promise(r => setTimeout(r, 1500));
      console.log('[Studio] (SIMULACIÓN) Automated posting succeeded!');
      
      return res.json({
        success: true,
        tiktokVideoId: `sim_published_${Date.now()}`,
        message: 'Video generado y publicado con éxito (Simulación de modo de prueba)'
      });
    }

    // Real production generation
    console.log('[Studio] (PRODUCCIÓN) Rendering dynamic vertical video and mixing sound tracks...');
    const resultObj = await videoGenerator.createVideo(trend, options);
    const videoPath = resultObj.videoPath;
    const backgroundUrl = resultObj.backgroundUrl;
    
    console.log('[Studio] (PRODUCCIÓN) Launching browser control node to upload video...');
    const caption = customCaption || `#${trend.hashtag} #MetaAI #TikMagicTok #Sigueme`;
    const publishResult = await tiktokApi.uploadVideo(videoPath, caption);
    
    // Save details to database
    await db.recordPost(trendId, videoPath, 'published', publishResult.id, backgroundUrl);

    // Delete the local video file once successfully published to prevent storage accumulation
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`[Studio] Deleted local video file to free up space: ${videoPath}`);
      }
    } catch (err) {
      console.warn(`[Studio] Failed to delete local video file: ${err.message}`);
    }

    // Trigger learning optimization
    const metricAnalyzer = require('./metricAnalyzer');
    setTimeout(() => {
      metricAnalyzer.runAnalysisAndOptimization().catch(console.error);
    }, 5000);

    res.json({
      success: true,
      tiktokVideoId: publishResult.id,
      message: '¡Video de Meta AI publicado con éxito en tu TikTok!'
    });

  } catch (err) {
    console.error('[Studio] Production video creation/upload failed:', err);
    res.status(500).json({ error: 'Studio publishing failed: ' + err.message });
  }
});

// Cron: run every hour on the dot (0 * * * *)
cron.schedule('0 * * * *', async () => {
  console.log('[AI Autoposter Cron] Triggered hourly trend auto-publisher...');
  
  // Skip if autopilot is already active to avoid concurrent browser collisions
  if (isAutoPublishRunning) {
    console.log('[AI Autoposter Cron] Autopilot is already active. Skipping cron to prevent browser collision.');
    return;
  }

  try {
    // Step 1: Run metrics learning loop to adjust parameters
    console.log('[AI Autoposter Cron] Executing continuous learning analysis...');
    const metricAnalyzer = require('./metricAnalyzer');
    await metricAnalyzer.runAnalysisAndOptimization();

    // Step 2: Sync daily trends
    console.log('[AI Autoposter Cron] Syncing daily trends...');
    const trends = await trendService.fetchDailyTrends();
    const storedTrends = [];
    for (const tr of trends) {
      const stored = await db.insertTrend(tr);
      storedTrends.push(stored);
    }

    // Step 3: Select a trend to publish
    // Step 3: Select a trend to publish ensuring NO consecutive identical trend is published
    const targetTrend = await getUniqueTrendToPublish();
    if (!targetTrend) {
      console.log('[AI Autoposter Cron] No daily trends available for hourly posting.');
      return;
    }

    const resultObj = await videoGenerator.createVideo(targetTrend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;

    console.log('[AI Autoposter Cron] Uploading video to TikTok Studio...');
    
    // Generate caption dynamically matching the trend theme and stating our AI feedback loop
    const aiService = require('./aiService');
    const aiContent = await aiService.generateThematicContent(targetTrend.hashtag).catch(() => ({ title: 'TikMagicTok' }));
    const titleClean = aiContent.title.toUpperCase();
    const caption = `${titleClean} ⚡ #${targetTrend.hashtag.replace(/_/g, '')} - Estoy aprendiendo de lo que me escribas en los comentarios, ¡por favor corrígeme! 🤖 #IA #Aprendiendo #Foryou #TikMagicTok`;

    const result = await tiktokApi.uploadVideo(videoPath, caption);
    await db.recordPost(targetTrend.id, videoPath, 'published', result.id, backgroundUrl);
    
    // Delete the local video file once successfully published to prevent storage accumulation
    try {
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`[AI Autoposter Cron] Deleted local video file to free up space: ${videoPath}`);
      }
    } catch (err) {
      console.warn(`[AI Autoposter Cron] Failed to delete local video file: ${err.message}`);
    }
    
    console.log(`[AI Autoposter Cron] Hourly automated video posted successfully! ID: ${result.id}`);
  } catch (e) {
    console.error('[AI Autoposter Cron] Hourly cron execution error:', e);
  }
});

// Cron: run every hour at the 30th minute (30 * * * *) to read comments and learn
cron.schedule('30 * * * *', async () => {
  console.log('[AI Comment Learner] Triggered hourly comment scraping and learning cycle...');
  try {
    const commentLearner = require('./commentLearner');
    await commentLearner.scrapeCommentsAndLearn();
  } catch (err) {
    console.error('[AI Comment Learner] Hourly cycle failed:', err.message);
  }
});

// Startup Persistent Autopilot Scheduler Loader
db.getLatestSettings().then((settings) => {
  if (settings && settings.autopilot_active === 1) {
    console.log(`[AI Auto-Publisher] Persistent active autopilot settings detected on startup!`);
    console.log(`[AI Auto-Publisher] Resuming autopilot loop at ${settings.posting_interval} minutes.`);
    isAutoPublishRunning = true;
    startAutopilotLoop(settings.posting_interval);
  } else {
    console.log('[AI Auto-Publisher] Persistent autopilot is currently INACTIVE.');
  }

  // Auto-trigger comment learner loop on startup to verify logic
  setTimeout(async () => {
    console.log('[AI Comment Learner] Initial startup auto-learning cycle triggered...');
    try {
      const commentLearner = require('./commentLearner');
      await commentLearner.scrapeCommentsAndLearn();
    } catch (e) {
      console.warn('[AI Comment Learner] Startup loop warning:', e.message);
    }
  }, 8000);
}).catch(err => {
  console.error('[AI Auto-Publisher] Failed to load persistent settings on startup:', err.message);
});

// IP Discovery and Listener binding to 0.0.0.0 for phone testing
const os = require('os');
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n================================================================`);
  console.log(`🌟 TikMagicTok META-AUTÓNOMO está en línea!`);
  console.log(`  - Local:   http://localhost:${PORT}`);
  getLocalIPs().forEach(ip => {
    console.log(`  - Network: http://${ip}:${PORT} <--- ¡Probar en celular!`);
  });
  console.log(`================================================================\n`);
});
