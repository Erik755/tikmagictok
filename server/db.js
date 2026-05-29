const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Database file inside project root
const dbDir = path.resolve(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'tikmagic.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Could not open DB', err);
  else console.log('Connected to SQLite DB');
});

// Initialize tables if they don't exist
const init = () => {
  const createTrends = `CREATE TABLE IF NOT EXISTS trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hashtag TEXT NOT NULL,
    videoUrl TEXT,
    fetchedAt TEXT NOT NULL
  );`;
  const createPosts = `CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trendId INTEGER NOT NULL,
    videoPath TEXT NOT NULL,
    status TEXT NOT NULL,
    publishedAt TEXT,
    tiktokVideoId TEXT,
    FOREIGN KEY(trendId) REFERENCES trends(id)
  );`;
  const createSettings = `CREATE TABLE IF NOT EXISTS video_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    duration INTEGER NOT NULL,
    bg_style TEXT NOT NULL,
    font_color TEXT NOT NULL,
    lastUpdated TEXT NOT NULL
  );`;
  const createMetrics = `CREATE TABLE IF NOT EXISTS video_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tiktokVideoId TEXT UNIQUE NOT NULL,
    views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments INTEGER NOT NULL DEFAULT 0,
    analyzedAt TEXT NOT NULL
  );`;

  db.exec(createTrends, (e) => { if (e) console.error(e); });
  db.exec(createPosts, (e) => { if (e) console.error(e); });
  db.exec(createSettings, (e) => {
    if (e) console.error(e);
    else {
      db.get('SELECT COUNT(*) as count FROM video_settings', [], (err, row) => {
        if (row && row.count === 0) {
          db.run("INSERT INTO video_settings (duration, bg_style, font_color, lastUpdated) VALUES (15, 'cyberpunk', 'white', ?)", [new Date().toISOString()]);
        }
      });
    }
  });
  db.exec(createMetrics, (e) => { if (e) console.error(e); });
};

init();

// Helper functions returning Promises
const getAllTrends = () => new Promise((resolve, reject) => {
  db.all('SELECT * FROM trends ORDER BY fetchedAt DESC', [], (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const getTrendById = (id) => new Promise((resolve, reject) => {
  db.get('SELECT * FROM trends WHERE id = ?', [id], (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const insertTrend = (trend) => new Promise((resolve, reject) => {
  const { hashtag, videoUrl } = trend;
  const fetchedAt = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO trends (hashtag, videoUrl, fetchedAt) VALUES (?,?,?)');
  stmt.run([hashtag, videoUrl || null, fetchedAt], function (err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, hashtag, videoUrl, fetchedAt });
  });
});

const recordPost = (trendId, videoPath, status, tiktokVideoId = null) => new Promise((resolve, reject) => {
  const publishedAt = status === 'published' ? new Date().toISOString() : null;
  const stmt = db.prepare('INSERT INTO posts (trendId, videoPath, status, publishedAt, tiktokVideoId) VALUES (?,?,?,?,?)');
  stmt.run([trendId, videoPath, status, publishedAt, tiktokVideoId], function (err) {
    if (err) reject(err);
    else resolve({ id: this.lastID });
  });
});

const getLatestSettings = () => new Promise((resolve, reject) => {
  db.get('SELECT * FROM video_settings ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) reject(err);
    else resolve(row || { duration: 15, bg_style: 'cyberpunk', font_color: 'white' });
  });
});

const updateSettings = (duration, bg_style, font_color) => new Promise((resolve, reject) => {
  const lastUpdated = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO video_settings (duration, bg_style, font_color, lastUpdated) VALUES (?,?,?,?)');
  stmt.run([duration, bg_style, font_color, lastUpdated], function (err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, duration, bg_style, font_color, lastUpdated });
  });
});

const recordMetrics = (tiktokVideoId, views, likes, comments) => new Promise((resolve, reject) => {
  const analyzedAt = new Date().toISOString();
  const stmt = db.prepare('INSERT OR REPLACE INTO video_metrics (tiktokVideoId, views, likes, comments, analyzedAt) VALUES (?,?,?,?,?)');
  stmt.run([tiktokVideoId, views, likes, comments, analyzedAt], function (err) {
    if (err) reject(err);
    else resolve({ id: this.lastID });
  });
});

const getAllMetrics = () => new Promise((resolve, reject) => {
  db.all('SELECT * FROM video_metrics ORDER BY analyzedAt DESC', [], (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

const getPostedTrendIds = () => new Promise((resolve, reject) => {
  db.all('SELECT DISTINCT trendId FROM posts', [], (err, rows) => {
    if (err) reject(err);
    else resolve(rows.map(r => r.trendId));
  });
});

module.exports = {
  getAllTrends,
  getTrendById,
  insertTrend,
  recordPost,
  getLatestSettings,
  updateSettings,
  recordMetrics,
  getAllMetrics,
  getPostedTrendIds
};

