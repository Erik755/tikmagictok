// server/trendService.js
const axios = require('axios');

// Diverse curated trend pools organized by category — rotated daily
const TREND_POOLS = {
  entretenimiento: [
    'storytime', 'lifehack', 'dayinmylife', 'grwm', 'ootd',
    'aesthetic', 'satisfying', 'oddlysatisfying', 'fyp', 'viral'
  ],
  comedia: [
    'comedia', 'humor', 'memes', 'funnyvideos', 'pranks',
    'relatable', 'comedyskits', 'duet', 'reaction', 'fails'
  ],
  tecnologia: [
    'techtok', 'techreview', 'AI', 'coding', 'gadgets',
    'productivity', 'appreview', 'IA', 'futuretech', 'robotics'
  ],
  motivacion: [
    'motivacion', 'mindset', 'hustle', 'selfimprovement', 'growthmindset',
    'discipline', 'success', 'levelup', 'transformation', 'goals'
  ],
  educacion: [
    'learnontiktok', 'edutok', 'didyouknow', 'facts', 'science',
    'history', 'psychology', 'languages', 'studytok', 'brainteaser'
  ]
};

// Pick a diverse set of real trends
function getRandomFromPool(pool, count) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Fetch daily trends. Tries Google Trends RSS first, then falls back to curated pool.
 */
async function fetchDailyTrends() {
  // Strategy 1: Try Google Trends RSS (Mexico region)
  try {
    const trends = await fetchGoogleTrendsRSS();
    if (trends && trends.length >= 3) {
      console.log('[Trend Service] Got trends from Google Trends RSS:', trends.map(t => t.hashtag));
      return trends;
    }
  } catch (err) {
    console.log('[Trend Service] Google Trends RSS failed:', err.message);
  }

  // Strategy 2: Curated diverse pool fallback (always works)
  console.log('[Trend Service] Using curated trend pool fallback.');
  return getCuratedTrends();
}

/**
 * Fetch trending search terms from Google Trends RSS (Mexico region).
 */
async function fetchGoogleTrendsRSS() {
  const url = 'https://trends.google.com/trending/rss?geo=MX';
  const resp = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const xml = resp.data;

  // Simple XML parsing for <title> tags inside <item>
  const items = xml.split('<item>').slice(1);
  const trends = [];
  for (const item of items) {
    const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
    if (titleMatch) {
      // Convert search term to hashtag-friendly format (remove spaces, special chars)
      const raw = titleMatch[1].trim();
      const term = raw.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g, '');
      if (term && term.length > 1 && term.length < 40) {
        trends.push({ hashtag: term, videoUrl: null });
      }
    }
    if (trends.length >= 5) break;
  }
  return trends;
}

/**
 * Curated diverse trends — picks 5 from different categories to ensure variety.
 */
function getCuratedTrends() {
  const categories = Object.keys(TREND_POOLS);
  const selected = [];

  // Pick one random trend from each of 5 different categories
  const shuffledCats = [...categories].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(5, shuffledCats.length); i++) {
    const pool = TREND_POOLS[shuffledCats[i]];
    const pick = pool[Math.floor(Math.random() * pool.length)];
    selected.push({ hashtag: pick, videoUrl: null });
  }

  return selected;
}

module.exports = { fetchDailyTrends };
