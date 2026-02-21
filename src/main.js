import { parseSvgString } from './parser.js';
import { rasterize } from './rasterizer.js';
import { rasterizeGif } from './gif-rasterizer.js';
import { getAnimationDuration } from './animation.js';
import { debounce, downloadBlob, showToast } from './utils.js';

// Launch date
const launch = new Date('2026-02-19');
const days = Math.floor((new Date() - launch) / 86400000);
document.getElementById('launchAge').textContent =
  days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';

const svgInput = document.getElementById('svgInput');
const previewContainer = document.getElementById('previewContainer');
const previewArea = document.getElementById('previewArea');
const previewPanel = document.getElementById('previewPanel');
const exportSection = document.getElementById('exportSection');
const parseStatus = document.getElementById('parseStatus');
const downloadBtn = document.getElementById('downloadBtn');
const downloadInfo = document.getElementById('downloadInfo');
const animWarning = document.getElementById('animWarning');
const toastEl = document.getElementById('toast');

let currentSvg = null;
let isAnimated = false;
let selectedW = 256, selectedH = 256;
let isCustom = false;

// ── Parse & Render ──
svgInput.addEventListener('input', debounce(parseSvg, 150));

function parseSvg() {
  const raw = svgInput.value.trim();
  if (!raw) {
    previewContainer.innerHTML = '<div class="empty-state"><span class="arrow">&larr;</span>paste svg to preview</div>';
    parseStatus.textContent = '';
    parseStatus.className = '';
    exportSection.classList.add('hidden');
    currentSvg = null;
    return;
  }

  try {
    const result = parseSvgString(raw);
    currentSvg = result.serialized;
    isAnimated = result.isAnimated;

    animWarning.classList.toggle('visible', isAnimated);

    // Render preview via innerHTML (critical: not cloneNode from XML parser)
    previewContainer.innerHTML = currentSvg;

    parseStatus.textContent = 'valid svg';
    parseStatus.className = 'ok';
    exportSection.classList.remove('hidden');
    updateOptions();
  } catch (e) {
    parseStatus.textContent = e.message.slice(0, 60);
    parseStatus.className = 'err';
    exportSection.classList.add('hidden');
    currentSvg = null;
  }
}

// ── Background Toggle ──
window.setBg = function(mode, btn) {
  document.querySelectorAll('.preview-toolbar .toolbar-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  previewArea.className = 'preview-area' + (mode === 'checker' ? ' checkerboard' : '');
  previewPanel.className = 'panel preview-panel' + (mode === 'dark' ? ' bg-dark' : mode === 'light' ? ' bg-light' : '');
};

// ── Presets ──
window.selectPreset = function(btn) {
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const w = parseInt(btn.dataset.w), h = parseInt(btn.dataset.h);
  isCustom = w === 0;
  document.getElementById('customSizeGroup').style.display = isCustom ? 'flex' : 'none';
  if (!isCustom) { selectedW = w; selectedH = h; }
  updateOptions();
};

// ── Options ──
function updateOptions() {
  if (isCustom) {
    selectedW = parseInt(document.getElementById('customW').value) || 256;
    selectedH = parseInt(document.getElementById('customH').value) || 256;
  }
  const fmt = document.getElementById('formatSelect').value;
  const transparent = document.getElementById('optTransparent').checked;
  const circle = document.getElementById('optCircle').checked;

  const parts = [];
  if (fmt !== 'svg') parts.push(`${selectedW} &times; ${selectedH}`);
  parts.push(fmt.toUpperCase());
  if (fmt === 'gif' && isAnimated) parts.push('animated');
  if (transparent && fmt !== 'svg' && fmt !== 'gif') parts.push('transparent');
  if (circle && fmt !== 'svg') parts.push('circle');

  downloadInfo.innerHTML = parts.join(' &middot; ');
}
window.updateOptions = updateOptions;

// ── Download ──
window.doDownload = async function() {
  if (!currentSvg) return;

  const fmt = document.getElementById('formatSelect').value;
  const transparent = document.getElementById('optTransparent').checked;
  const circle = document.getElementById('optCircle').checked;

  if (fmt === 'svg') {
    downloadBlob(new Blob([currentSvg], { type: 'image/svg+xml' }), 'icon.svg');
    showToast('SVG downloaded', toastEl);
    return;
  }

  try {
    downloadBtn.disabled = true;
    let blob;
    if (fmt === 'gif') {
      const durationMs = getAnimationDuration(currentSvg);
      downloadBtn.textContent = `Capturing ${(durationMs / 1000).toFixed(1)}s…`;
      blob = await rasterizeGif(currentSvg, selectedW, selectedH, transparent, circle, durationMs);
      downloadBlob(blob, `icon-${selectedW}x${selectedH}.gif`);
      showToast('GIF downloaded', toastEl);
    } else {
      blob = await rasterize(currentSvg, selectedW, selectedH, fmt, transparent, circle);
      downloadBlob(blob, `icon-${selectedW}x${selectedH}.${fmt}`);
      showToast(`${fmt.toUpperCase()} downloaded`, toastEl);
    }
  } catch (e) {
    showToast('Export failed: ' + e.message, toastEl);
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Download';
  }
};

window.doCopy = async function() {
  if (!currentSvg) return;
  const transparent = document.getElementById('optTransparent').checked;
  const circle = document.getElementById('optCircle').checked;

  try {
    document.getElementById('copyBtn').disabled = true;
    const blob = await rasterize(currentSvg, selectedW, selectedH, 'png', transparent, circle);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast('Image copied to clipboard', toastEl);
  } catch (e) {
    showToast('Copy failed: ' + e.message, toastEl);
  } finally {
    document.getElementById('copyBtn').disabled = false;
  }
};

// ── Utilities ──
window.clearInput = function() {
  svgInput.value = '';
  parseSvg();
};

window.loadExample = function() {
  svgInput.value = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00d4aa"/>
      <stop offset="100%" stop-color="#0088ff"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="56" fill="url(#g)"/>
  <text x="60" y="72" text-anchor="middle" font-size="48" font-family="sans-serif" font-weight="bold" fill="#fff">S</text>
</svg>`;
  parseSvg();
};
