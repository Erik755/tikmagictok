import { createVideo } from './server/videoGenerator.js';

(async () => {
  try {
    console.log('Rendering new premium video with videoGenerator...');
    const result = await createVideo({ id: 9, hashtag: 'techtips' });
    const videoPath = typeof result === 'string' ? result : result.videoPath;
    console.log('Successfully generated video at:', videoPath);
  } catch (err) {
    console.error('Error generating video:', err);
  }
})();
