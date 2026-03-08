---
title: CDN dependency failure broke entire SVG Drop app module graph
date: 2026-03-07
category: runtime-errors
severity: critical
component: parser, gif-rasterizer
symptoms:
  - Pasting any SVG shows nothing — no render, no status change
  - Entire JS module graph fails to load
  - Console error: "does not provide an export named 'applyPalette'"
  - viewBox-only SVGs render at 0x0 size
  - AI-generated SVGs with minor XML issues rejected
root_cause: Static ES module import from esm.sh CDN (gifenc@1.0.3) broke when CDN stopped exporting applyPalette, cascading failure through module graph killed all functionality including basic SVG paste. Secondary issues with dimension injection using percentage values and strict XML-only parsing.
tags: [cdn-dependency, esm, module-graph, cascading-failure, svg-parsing, gifenc, vite, cloudflare-pages]
---

# CDN Import Crash + SVG Parser Robustness

## Problem

SVG Drop (svg.silv.app) was completely broken in production. Pasting any SVG showed nothing — no preview, no status message, no error. The app appeared completely dead.

## Root Cause Analysis

Three independent issues, one of which was critical:

### 1. Static CDN import crashed the entire module graph (CRITICAL)

`gif-rasterizer.js` had a static import from a CDN:

```js
// BROKEN - static import from CDN
import { GIFEncoder, quantize, applyPalette } from 'https://esm.sh/gifenc@1.0.3';
```

When the CDN changed its exports (removing `applyPalette`), this static import failed. Because ES modules form a dependency graph, and `main.js` imports from `gif-rasterizer.js`, the **entire app** failed to load. Not just GIF export — everything, including basic SVG paste and preview.

### 2. `width="100%"` collapsed to 0x0 in flex layouts

For viewBox-only SVGs (no explicit width/height), the parser injected `width="100%"` and `height="100%"`. In flex/grid containers, percentage dimensions resolve against the parent's size. When the parent has no intrinsic size (common in flex layouts), the SVG collapses to 0x0.

### 3. Strict XML-only parsing rejected AI-generated SVGs

The parser only used `DOMParser` with `'image/svg+xml'` (strict XML mode). AI models frequently generate SVGs with minor XML issues — unescaped `&`, missing closing tags, markdown code fences — that strict XML parsing rejects.

## Solution

### Fix 1: Bundle gifenc as npm dependency

```js
// BEFORE - CDN dependency, static import
import { GIFEncoder, quantize, applyPalette } from 'https://esm.sh/gifenc@1.0.3';

// AFTER - npm dependency, bundled by Vite
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
```

`npm install gifenc` and let Vite bundle it. No runtime CDN dependency.

### Fix 2: Use viewBox pixel dimensions instead of percentages

```js
// BEFORE
svg.setAttribute('width', '100%');
svg.setAttribute('height', '100%');

// AFTER - extract actual pixel values from viewBox
if (svg.getAttribute('viewBox') && !svg.getAttribute('width') && !svg.getAttribute('height')) {
  const parts = svg.getAttribute('viewBox').split(/[\s,]+/);
  if (parts.length === 4) {
    svg.setAttribute('width', parts[2]);
    svg.setAttribute('height', parts[3]);
  }
}
```

For `viewBox="0 0 400 400"`, this sets `width="400" height="400"`. CSS `max-width: 100%; height: auto` handles responsive scaling.

### Fix 3: HTML fallback parsing + AI artifact stripping

```js
// Strip markdown code fences
cleaned = cleaned.replace(/^```(?:svg|xml|html)?\s*\n?/i, '').replace(/\n?```\s*$/, '');

// Extract <svg>...</svg> from surrounding text
const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i);
if (svgMatch) cleaned = svgMatch[0];

// Try XML first, fall back to HTML
function parseXmlOrHtml(svgString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(svgString, 'image/svg+xml');
  const xmlErr = xmlDoc.querySelector('parsererror');
  if (!xmlErr) {
    const svg = xmlDoc.documentElement;
    if (svg.tagName === 'svg') return svg;
    throw new Error('Root element is not <svg>');
  }
  // Fall back to HTML parsing (much more forgiving)
  const htmlDoc = parser.parseFromString(svgString, 'text/html');
  const svg = htmlDoc.querySelector('svg');
  if (svg) return svg;
  throw new Error(xmlErr.textContent.split('\n')[0]);
}
```

## Verification

- All 33 tests pass (14 core + 10 AI paste patterns + 9 others)
- Deployed to Cloudflare Pages via GitHub Actions
- Version number (v1.1.0) added to footer for deploy confirmation
- Manual test with the originally failing SVG (complex filters, nested use/href)

## Prevention Strategies

### CDN Dependencies
- **Never use static `import` for CDN URLs** — a network blip or breaking change takes down the entire app
- **Bundle critical dependencies** via npm + Vite. Zero runtime CDN dependencies for core functionality
- **Use dynamic `import()` for optional features** with try/catch, so failures are isolated

### Layout Collapse
- **Use explicit pixel dimensions** from viewBox, not percentages, for SVG elements in flex/grid layouts
- **Test viewBox-only SVGs** in the actual preview layout before deploying

### AI-Generated SVG Robustness
- **Always fall back to HTML parsing** when XML parsing fails
- **Strip markdown fences** and surrounding text — AI models wrap SVGs in code blocks
- **Auto-add missing xmlns** — AI models sometimes omit it
- **Core functionality must have zero external dependencies**

## Testing Checklist

1. All 5 manual test items from CLAUDE.md (viewBox-only, complex, explicit dims, no xmlns, animated)
2. SVG with markdown code fences
3. SVG with surrounding prose text
4. Animated SVG shows warning + GIF option
5. Complex SVG with filters, gradients, nested use/href
6. Narrow viewport (320px) — SVG still visible

## Related References

- `CLAUDE.md` — Critical bug documentation and manual test checklist
- Commit `893f735` — Original innerHTML vs cloneNode fix
- Commit `8aacd4e` — Vite refactor + initial viewBox fix
- Commit `82aa1b7` — GIF export with gifenc (introduced the CDN import)
- `src/parser.js` — All parsing logic
- `src/gif-rasterizer.js` — GIF encoding with gifenc
- `src/main.js:51` — Critical `innerHTML` render path
