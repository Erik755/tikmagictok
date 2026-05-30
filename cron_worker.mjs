import 'dotenv/config';
import nodeCron from 'node-cron';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { fetchDailyTrends } = require('./server/trendService.js');
const { createVideo } = require('./server/videoGenerator.js');
const tiktokApi = require('./server/tiktokApi.js');
const db = require('./server/db.js');

async function ejecutarCicloAutomatizacion() {
  console.log(`\n[${new Date().toISOString()}] === INICIANDO CICLO DE PUBLICACIÓN AUTOMATIZADO ===`);
  
  try {
    // 1. Monitorear: Obtener tendencias actuales
    console.log('[Cron Worker] Monitoreando tendencias de redes sociales...');
    const trends = await fetchDailyTrends();
    if (!trends || trends.length === 0) {
      console.log('[Cron Worker] No se encontraron tendencias activas. Reintentando en el próximo ciclo.');
      return;
    }

    // Seleccionar una tendencia que no haya sido publicada antes
    const postedTrendIds = await db.getPostedTrendIds();
    let selectedTrend = null;
    for (const t of trends) {
      // Inserción inicial en DB para asegurar que tiene ID
      const stored = await db.insertTrend(t);
      if (!postedTrendIds.includes(stored.id)) {
        selectedTrend = stored;
        break;
      }
    }

    // Fallback: si todos los del feed ya se publicaron, creamos un trend autónomo para no detener el cron
    if (!selectedTrend) {
      console.log('[Cron Worker] Todos los trends del feed ya fueron publicados. Generando trend único autónomo...');
      const uniqueHashtag = `magic_${Math.floor(1000 + Math.random() * 9000)}`;
      selectedTrend = await db.insertTrend({ hashtag: uniqueHashtag, videoUrl: null });
    }

    console.log(`[Cron Worker] Tendencia seleccionada: #${selectedTrend.hashtag} (ID: ${selectedTrend.id})`);

    // 2. Generar el Video con nuestro motor cinemático y de deduplicación
    console.log('[Cron Worker] Generando video cinemático y aplicando deduplicación de fondos...');
    const resultObj = await createVideo(selectedTrend);
    const videoPath = typeof resultObj === 'string' ? resultObj : resultObj.videoPath;
    const backgroundUrl = typeof resultObj === 'string' ? null : resultObj.backgroundUrl;

    console.log(`[Cron Worker] Video renderizado exitosamente en: ${videoPath}`);

    // 3. Publicar a TikTok autonomously via Puppeteer
    console.log('[Cron Worker] Iniciando publicación automatizada en TikTok Studio...');
    const caption = `#${selectedTrend.hashtag} #TikMagicTok #IA_Autonoma`;
    const publishResult = await tiktokApi.uploadVideo(videoPath, caption);

    // 4. Registrar en base de datos para seguimiento de métricas y deduplicación
    await db.recordPost(selectedTrend.id, videoPath, 'published', publishResult.id, backgroundUrl);
    console.log(`[Cron Worker] ¡Ciclo completado con éxito! Video ID registrado: ${publishResult.id}`);

    // 5. Ejecutar optimización de métricas
    const metricAnalyzer = require('./server/metricAnalyzer');
    setTimeout(() => {
      metricAnalyzer.runAnalysisAndOptimization().catch(console.error);
    }, 5000);

  } catch (error) {
    console.error(`[Cron Worker] Error crítico en el ciclo de automatización:`, error.message);
  }
}

// Configurar el monitoreo constante cada hora en punto (0 * * * *)
console.log('[Cron Worker] Servicio TikMagicTok iniciado. Monitoreando tendencias cada hora...');
nodeCron.schedule('0 * * * *', () => {
  ejecutarCicloAutomatizacion();
});

// Ejecutar inmediatamente al iniciar el cron
ejecutarCicloAutomatizacion();
