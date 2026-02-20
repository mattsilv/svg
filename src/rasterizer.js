/**
 * Rasterize an SVG string to a PNG or WebP Blob.
 * @param {string} svgStr - Serialized SVG string
 * @param {number} w - Output width
 * @param {number} h - Output height
 * @param {string} fmt - 'png' or 'webp'
 * @param {boolean} transparent - Use transparent background
 * @param {boolean} circle - Apply circle crop
 * @returns {Promise<Blob>}
 */
export function rasterize(svgStr, w, h, fmt, transparent, circle) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (!transparent) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }

      if (circle) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
        ctx.clip();
      }

      // Scale SVG to fill canvas while maintaining aspect ratio
      const svgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = w / h;
      let dw, dh, dx, dy;
      if (svgAspect > canvasAspect) {
        dh = h; dw = h * svgAspect;
        dx = (w - dw) / 2; dy = 0;
      } else {
        dw = w; dh = w / svgAspect;
        dx = 0; dy = (h - dh) / 2;
      }
      ctx.drawImage(img, dx, dy, dw, dh);

      URL.revokeObjectURL(url);
      const mime = fmt === 'webp' ? 'image/webp' : 'image/png';
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), mime);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG render failed')); };
    img.src = url;
  });
}
