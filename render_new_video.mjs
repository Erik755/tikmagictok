import { createVideo } from './server/videoGenerator.js';

(async () => {
  try {
    console.log('Rendering new premium video with videoGenerator...');
    const path = await createVideo({ id: 9, hashtag: 'techtips' });
    console.log('Successfully generated video at:', path);
  } catch (err) {
    console.error('Error generating video:', err);
  }
})();
