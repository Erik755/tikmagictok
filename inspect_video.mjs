import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegStatic);

const videoPath = path.resolve(__dirname, 'output', 'trend_9.mp4');
const framePath = path.resolve(__dirname, 'output', 'frame_9.png');

console.log('Extracting frame from video:', videoPath);

ffmpeg(videoPath)
  .screenshots({
    timestamps: ['1'],
    filename: 'frame_9.png',
    folder: path.resolve(__dirname, 'output'),
    size: '720x1280'
  })
  .on('end', () => {
    console.log('Frame extracted successfully to:', framePath);
  })
  .on('error', (err) => {
    console.error('Error extracting frame:', err);
  });
