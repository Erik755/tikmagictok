// publish_three_real.mjs
// Syncs real trends, generates 3 videos with different topics, and publishes each to TikTok Studio.

import http from 'http';

const BASE = 'http://localhost:3000';

function fetchJSON(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(url, opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== TikMagicTok: Publicando 3 Videos Reales ===\n');

  // Step 1: Sync trends
  console.log('[1/4] Sincronizando trends reales...');
  const syncResult = await fetchJSON(`${BASE}/api/trends/fetch`, 'POST');
  console.log('Trends sincronizados:', syncResult.success ? syncResult.trends.map(t => `#${t.hashtag}`).join(', ') : 'ERROR');

  if (!syncResult.success || !syncResult.trends || syncResult.trends.length === 0) {
    console.error('ERROR: No se pudieron sincronizar trends. Abortando.');
    process.exit(1);
  }

  // Get 3 different trends
  const trendsToPublish = syncResult.trends.slice(0, 3);
  console.log(`\nSe publicarán ${trendsToPublish.length} videos con trends: ${trendsToPublish.map(t => `#${t.hashtag}`).join(', ')}\n`);

  // Step 2-4: Generate and publish each video
  for (let i = 0; i < trendsToPublish.length; i++) {
    const trend = trendsToPublish[i];
    console.log(`\n[${'='.repeat(60)}]`);
    console.log(`[${i + 1}/3] Generando y publicando video para #${trend.hashtag} (ID: ${trend.id})...`);
    console.log(`[${'='.repeat(60)}]`);

    try {
      const result = await fetchJSON(`${BASE}/api/generate-and-publish/${trend.id}`, 'POST');
      if (result.success) {
        console.log(`✅ Video #${i + 1} publicado exitosamente! TikTok ID: ${result.tiktokVideoId}`);
      } else {
        console.log(`❌ Error publicando video #${i + 1}: ${result.error}`);
      }
    } catch (err) {
      console.log(`❌ Error de red publicando video #${i + 1}: ${err.message}`);
    }

    // Wait 10 seconds between publications to avoid overwhelming TikTok
    if (i < trendsToPublish.length - 1) {
      console.log('\n⏳ Esperando 10 segundos antes del siguiente video...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log('\n\n=== PROCESO COMPLETO ===');
  console.log('3 videos han sido generados y publicados en TikTok Studio.');
  console.log('Verifica en: https://www.tiktok.com/tiktokstudio/content');
}

main().catch(console.error);
