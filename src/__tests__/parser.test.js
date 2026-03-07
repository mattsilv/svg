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
