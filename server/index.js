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

// Helper to choose a completely unique, never-repeated trend
async function getUniqueTrendToPublish() {
  const allTrends = await db.getAllTrends();
  
  // Query all unique trend IDs that have already been posted
  const postedIds = await db.getPostedTrendIds();


  // Find a trend from the fetched daily trends that has not been posted
  const availableTrend = allTrends.find(t => !postedIds.includes(t.id));
  if (availableTrend) {
    return availableTrend;
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
    const caption = `#${trend.hashtag} #TikMagicTok #IA_Autonoma #Sigueme`;
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
app.get('/api/simulation/status', (req, res) => {
  res.json({ active: isAutoPublishRunning });
});

app.get('/api/logs', (req, res) => {
  res.json(global.serverLogs);
});

app.post('/api/simulation/toggle', async (req, res) => {

  const { active } = req.body;
  
  if (active) {
    if (isAutoPublishRunning) {
      return res.json({ success: true, active: true, message: 'Autopilot already active.' });
    }
    
    isAutoPublishRunning = true;
    console.log('[AI Auto-Publisher] Autopilot started. Interval: 30 minutes.');
    
    // 1. Run the first cycle IMMEDIATELY so the user has instant proof
    runAutoPublishCycle().catch(err => {
      console.error('[AI Auto-Publisher] Initial immediate run failed:', err.message);
    });

    // 2. Set interval to run every 30 minutes thereafter
    const intervalMs = 30 * 60 * 1000; // 30 minutes
    autoPublishInterval = setInterval(async () => {
      if (isAutoPublishRunning) {
        try {
          await runAutoPublishCycle();
        } catch (e) {
          console.error('[AI Auto-Publisher] Interval run failed:', e.message);
        }
      }
    }, intervalMs);

    res.json({
      success: true,
      active: true,
      message: 'Simulación de Piloto Automático activada. Generando primer video inmediatamente; luego cada 30 minutos sin repetir.'
    });
  } else {
    isAutoPublishRunning = false;
    if (autoPublishInterval) {
      clearInterval(autoPublishInterval);
      autoPublishInterval = null;
    }
    console.log('[AI Auto-Publisher] Autopilot stopped.');
    res.json({
      success: true,
      active: false,
      message: 'Simulación de Piloto Automático apagada.'
    });
  }
});

// Get current TikTok authentication status
app.get('/api/auth/status', (req, res) => {
  const isSimulated = process.env.SIMULATE_TIKTOK === 'true';
  const isAuthenticated = !!(global.tiktokTokens && global.tiktokTokens.access_token);
  res.json({
    simulated: isSimulated,
    authenticated: isAuthenticated,
    username: isAuthenticated ? (isSimulated ? 'TikTokCreator_Simulado' : 'TikTokCreator') : null
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

// Generate video for a trend and auto‑publish
app.post('/api/generate-and-publish/:trendId', async (req, res) => {
  const { trendId } = req.params;
  try {
    const trend = await db.getTrendById(trendId);
    if (!trend) return res.status(404).json({ error: 'Trend not found' });
    
    const resultObj = await videoGenerator.createVideo(trend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;
    
    console.log('[Server] Posting to TikTok via remote browser control...');
    const publishResult = await tiktokApi.uploadVideo(videoPath, `#${trend.hashtag} #TikMagicTok`);
    await db.recordPost(trendId, videoPath, 'published', publishResult.id, backgroundUrl);

    // Run continuous metric optimization loop to learn from this upload
    console.log('[Server] Running self-learning metrics optimization...');
    const metricAnalyzer = require('./metricAnalyzer');
    setTimeout(() => {
      metricAnalyzer.runAnalysisAndOptimization().catch(console.error);
    }, 5000); // delay slightly to let the tab finish redirection

    res.json({ success: true, tiktokVideoId: publishResult.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Generation/publish failed: ' + e.message });
  }
});

// Cron: run every hour on the dot (0 * * * *)
cron.schedule('0 * * * *', async () => {
  console.log('[AI Autoposter Cron] Triggered hourly trend auto-publisher...');
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
    const targetTrend = storedTrends[0] || (await db.getAllTrends())[0];
    if (!targetTrend) {
      console.log('[AI Autoposter Cron] No daily trends available for hourly posting.');
      return;
    }

    const resultObj = await videoGenerator.createVideo(targetTrend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;

    console.log('[AI Autoposter Cron] Uploading video to TikTok Studio...');
    const result = await tiktokApi.uploadVideo(videoPath, `#${targetTrend.hashtag} #TikMagicTok`);
    await db.recordPost(targetTrend.id, videoPath, 'published', result.id, backgroundUrl);
    
    console.log(`[AI Autoposter Cron] Hourly automated video posted successfully! ID: ${result.id}`);
  } catch (e) {
    console.error('[AI Autoposter Cron] Hourly cron execution error:', e);
  }
});

app.listen(PORT, () => {
  console.log(`TikMagicTok server listening on http://localhost:${PORT}`);
});
