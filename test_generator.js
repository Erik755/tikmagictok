const videoGenerator = require('./server/videoGenerator');

(async () => {
  console.log('Testing new video generator with thematic background and randomized kinetic motion...');
  const mockTrend = {
    id: 'test_tech_trend',
    hashtag: 'techtok'
  };

  try {
    const videoPath = await videoGenerator.createVideo(mockTrend);
    console.log('✅ Video generated successfully at:', videoPath);
    
    // Extract frame
    const path = require('path');
    const { execSync } = require('child_process');
    const FFMPEG = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
    const framePath = path.join(__dirname, 'output', 'test_frame.png');
    
    execSync(`"${FFMPEG}" -y -i "${videoPath}" -ss 2 -frames:v 1 "${framePath}"`);
    console.log('✅ Frame extracted successfully at:', framePath);
  } catch (err) {
    console.error('❌ Generation failed:', err);
  }
})();
