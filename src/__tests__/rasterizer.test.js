import { describe, it, expect } from 'vitest';
import { rasterize } from '../rasterizer.js';

// Rasterizer relies on browser APIs (URL.createObjectURL, Image, Canvas)
// that jsdom doesn't support. These tests verify the function exists and
// has the correct signature. Full rasterization is tested manually in-browser.

describe('rasterize', () => {
  it('is a function that accepts 6 parameters', () => {
    expect(typeof rasterize).toBe('function');
    expect(rasterize.length).toBe(6);
  });
});
