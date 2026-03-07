import { describe, it, expect } from 'vitest';
import { parseSvgString } from '../parser.js';

describe('parseSvgString', () => {
  it('returns serialized string with pixel dimensions from viewBox for viewBox-only SVGs', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="green"/></svg>';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('width="100"');
    expect(serialized).toContain('height="100"');
  });

  it('does not modify SVGs with explicit dimensions', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="red"/></svg>';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('width="200"');
    expect(serialized).toContain('height="200"');
    expect(serialized).not.toContain('width="100%"');
  });

  it('adds xmlns when missing', () => {
    const raw = '<svg viewBox="0 0 50 50"><rect width="50" height="50" fill="purple"/></svg>';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('detects animated SVGs', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill="orange"><animate attributeName="r" from="20" to="40" dur="1s" repeatCount="indefinite"/></circle></svg>';
    const { isAnimated } = parseSvgString(raw);
    expect(isAnimated).toBe(true);
  });

  it('returns isAnimated false for static SVGs', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="green"/></svg>';
    const { isAnimated } = parseSvgString(raw);
    expect(isAnimated).toBe(false);
  });

  it('throws when no SVG element can be found', () => {
    expect(() => parseSvgString('<div>no svg here</div>')).toThrow();
    expect(() => parseSvgString('just plain text')).toThrow();
  });

  it('recovers malformed XML via HTML fallback', () => {
    // HTML parser is more forgiving than XML — this should not throw
    const { serialized } = parseSvgString('<svg xmlns="http://www.w3.org/2000/svg"><rect width="50" height="50" fill="red"></svg>');
    expect(serialized).toContain('rect');
  });

  it('throws on non-SVG root element', () => {
    expect(() => parseSvgString('<div>not svg</div>')).toThrow('Root element is not <svg>');
  });

  it('throws on empty input', () => {
    expect(() => parseSvgString('')).toThrow('Empty input');
    expect(() => parseSvgString('   ')).toThrow('Empty input');
  });

  it('strips markdown code fences', () => {
    const raw = '```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50" fill="blue"/></svg>\n```';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('<rect');
    expect(serialized).not.toContain('```');
  });

  it('strips xml code fences', () => {
    const raw = '```xml\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50" fill="blue"/></svg>\n```';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('<rect');
  });

  it('extracts SVG from surrounding text', () => {
    const raw = 'Here is the SVG:\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect width="50" height="50" fill="blue"/></svg>\nHope this helps!';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('<rect');
  });

  it('uses viewBox pixel dimensions instead of percentages', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="red"/></svg>';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('width="400"');
    expect(serialized).toContain('height="300"');
    expect(serialized).not.toContain('width="100%"');
  });

  it('handles complex SVG with filters and use/href', () => {
    const raw = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="f1"><feGaussianBlur stdDeviation="5"/></filter>
        <g id="shape"><circle cx="200" cy="200" r="50"/></g>
      </defs>
      <use href="#shape" fill="red" filter="url(#f1)"/>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('use');
    expect(serialized).toContain('#shape');
    expect(serialized).toContain('width="400"');
  });
});

// Real-world AI-generated SVG patterns that must parse successfully
describe('AI-generated SVG paste patterns', () => {
  it('handles SVG with complex filter chains (feTurbulence, feDisplacementMap, feDropShadow)', () => {
    const raw = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="roughEdge" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="6" dy="10" stdDeviation="8" flood-opacity="0.6" flood-color="#111" />
        </filter>
        <radialGradient id="grad" cx="40%" cy="40%" r="65%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="100%" stop-color="#333333" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="160" fill="url(#grad)" filter="url(#shadow)" />
      <circle cx="200" cy="200" r="160" fill="url(#grad)" filter="url(#roughEdge)" />
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('feTurbulence');
    expect(serialized).toContain('feDropShadow');
    expect(serialized).toContain('width="400"');
  });

  it('handles SVG with nested use/href references in defs', () => {
    const raw = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <g id="spokes">
          <line x1="200" y1="185" x2="200" y2="40" />
          <line x1="200" y1="185" x2="200" y2="40" transform="rotate(90, 200, 200)" />
        </g>
        <g id="allSpokes" stroke-linecap="round">
          <use href="#spokes" transform="rotate(0, 200, 200)" stroke-width="1.2" />
          <use href="#spokes" transform="rotate(15, 200, 200)" stroke-width="0.8" stroke-dasharray="12 4" />
        </g>
      </defs>
      <g stroke="#333" opacity="0.65"><use href="#allSpokes" /></g>
      <g stroke="#fff" opacity="0.85"><use href="#allSpokes" /></g>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('#spokes');
    expect(serialized).toContain('#allSpokes');
  });

  it('handles SVG with CSS style block', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <style>
        .cls-1 { fill: #ff0000; }
        .cls-2 { stroke: #00ff00; stroke-width: 2; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
      <circle class="cls-1" cx="100" cy="100" r="50"/>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('cls-1');
    const { isAnimated } = parseSvgString(raw);
    expect(isAnimated).toBe(true);
  });

  it('handles SVG with multiple namespaces (xlink)', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100">
      <defs><circle id="dot" r="5"/></defs>
      <use xlink:href="#dot" x="50" y="50" fill="red"/>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('#dot');
  });

  it('handles SVG with CDATA sections in style', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <style><![CDATA[
        circle { fill: blue; }
      ]]></style>
      <circle cx="50" cy="50" r="40"/>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('circle');
  });

  it('handles SVG with clipPath and mask', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs>
        <clipPath id="clip"><circle cx="100" cy="100" r="80"/></clipPath>
        <mask id="m"><rect width="200" height="200" fill="white"/></mask>
      </defs>
      <rect width="200" height="200" fill="red" clip-path="url(#clip)" mask="url(#m)"/>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('clipPath');
    expect(serialized).toContain('mask');
  });

  it('handles SVG with foreignObject (common in AI diagrams)', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">
      <foreignObject x="10" y="10" width="280" height="180">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color:white">Hello World</div>
      </foreignObject>
    </svg>`;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('foreignObject');
  });

  it('handles Gemini-style SVG with multiple animate elements', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="30" fill="#4285F4">
        <animate attributeName="r" values="30;50;30" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="fill" values="#4285F4;#EA4335;#4285F4" dur="3s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="4s" repeatCount="indefinite"/>
      </circle>
    </svg>`;
    const { serialized, isAnimated } = parseSvgString(raw);
    expect(isAnimated).toBe(true);
    expect(serialized).toContain('animateTransform');
  });

  it('handles ChatGPT-style SVG pasted with leading whitespace/newlines', () => {
    const raw = `

      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect x="10" y="10" width="80" height="80" rx="10" fill="#10a37f"/>
      </svg>

    `;
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('rect');
  });

  it('handles SVG with non-zero viewBox origin', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><circle cx="0" cy="0" r="40" fill="green"/></svg>';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('width="100"');
    expect(serialized).toContain('height="100"');
  });
});
