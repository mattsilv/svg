import { describe, it, expect } from 'vitest';
import { parseSvgString } from '../parser.js';

describe('parseSvgString', () => {
  it('returns serialized string with width/height injected for viewBox-only SVGs', () => {
    const raw = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="green"/></svg>';
    const { serialized } = parseSvgString(raw);
    expect(serialized).toContain('width="100%"');
    expect(serialized).toContain('height="100%"');
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

  it('throws on invalid XML', () => {
    expect(() => parseSvgString('<svg><unclosed')).toThrow();
  });

  it('throws on non-SVG root element', () => {
    expect(() => parseSvgString('<div>not svg</div>')).toThrow('Root element is not <svg>');
  });

  it('throws on empty input', () => {
    expect(() => parseSvgString('')).toThrow('Empty input');
    expect(() => parseSvgString('   ')).toThrow('Empty input');
  });
});
