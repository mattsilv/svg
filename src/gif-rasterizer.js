/**
 * Capture animated SVG frames in real-time and encode as GIF.
 * Uses gifenc (by Matt DesLauriers) for encoding.
 */
import { GIFEncoder, quantize, applyPalette } from 'https://esm.sh/gifenc@1.0.3';
export { getAnimationDuration } from './animation.js';


/**
 * Rasterize an animated SVG as a GIF by capturing real-time frames.
 * @param {string} svgStr
 * @param {number} w Output width
 * @param {number} h Output height
 * @param {boolean} transparent
 * @param {boolean} circle
 * @param {number} durationMs How long to capture (milliseconds)
 * @param {number} fps Frames per second (default 20)
 * @returns {Promise<Blob>}
 */
export function rasterizeGif(svgStr, w, h, transparent, circle, durationMs, fps = 20) {
  return new Promise((resolve, reject) => {
    const frameDelay = Math.round(1000 / fps); // ms per frame
    const frameCount = Math.max(2, Math.round(durationMs / frameDelay));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const encoder = GIFEncoder();

      // Precompute draw params (scale to fill while preserving aspect ratio)
      let dw, dh, dx, dy;
      if (img.naturalWidth && img.naturalHeight) {
        const svgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = w / h;
        if (svgAspect > canvasAspect) {
          dh = h; dw = h * svgAspect;
          dx = (w - dw) / 2; dy = 0;
        } else {
          dw = w; dh = w / svgAspect;
          dx = 0; dy = (h - dh) / 2;
        }
      } else {
        dw = w; dh = h; dx = 0; dy = 0;
      }

      let framesCaptured = 0;

      function captureFrame() {
        ctx.clearRect(0, 0, w, h);

        if (!transparent) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
        }

        if (circle) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
          ctx.clip();
        }

        ctx.drawImage(img, dx, dy, dw, dh);

        if (circle) ctx.restore();

        const { data } = ctx.getImageData(0, 0, w, h);
        const palette = quantize(data, 256, { format: 'rgba4444' });
        const index = applyPalette(data, palette, 'rgba4444');

        encoder.writeFrame(index, w, h, {
          palette,
          delay: frameDelay,
          repeat: 0, // loop forever
        });

        framesCaptured++;
        if (framesCaptured < frameCount) {
          setTimeout(captureFrame, frameDelay);
        } else {
          encoder.finish();
          URL.revokeObjectURL(url);
          resolve(new Blob([encoder.bytes()], { type: 'image/gif' }));
        }
      }

      // Small delay so the browser starts playing the animation before we capture
      setTimeout(captureFrame, 50);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG render failed'));
    };

    img.src = url;
  });
}
