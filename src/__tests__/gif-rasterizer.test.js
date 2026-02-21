import { describe, it, expect } from 'vitest';
import { getAnimationDuration } from '../animation.js';

describe('getAnimationDuration', () => {
  it('parses a simple SMIL dur attribute in seconds', () => {
    const svg = '<svg><circle><animate dur="2s"/></circle></svg>';
    expect(getAnimationDuration(svg)).toBe(2000);
  });

  it('parses dur in milliseconds', () => {
    const svg = '<svg><circle><animate dur="500ms"/></circle></svg>';
    expect(getAnimationDuration(svg)).toBe(500);
  });

  it('returns the longest duration when multiple animations present', () => {
    const svg = `<svg>
      <circle><animate dur="1s"/></circle>
      <rect><animateTransform dur="3s"/></rect>
    </svg>`;
    expect(getAnimationDuration(svg)).toBe(3000);
  });

  it('returns default 2000ms when no animation found', () => {
    const svg = '<svg><circle r="10"/></svg>';
    expect(getAnimationDuration(svg)).toBe(2000);
  });

  it('ignores "indefinite" dur values and uses other durations', () => {
    const svg = '<svg><circle><animate dur="indefinite"/><animate dur="1.5s"/></circle></svg>';
    expect(getAnimationDuration(svg)).toBe(1500);
  });

  it('returns default 2000ms when only indefinite dur exists', () => {
    const svg = '<svg><circle><animate dur="indefinite"/></circle></svg>';
    expect(getAnimationDuration(svg)).toBe(2000);
  });

  it('parses decimal second values', () => {
    const svg = '<svg><circle><animate dur="0.5s"/></circle></svg>';
    expect(getAnimationDuration(svg)).toBe(500);
  });

  it('parses repeatDur attribute', () => {
    const svg = '<svg><circle><animate repeatDur="4s"/></circle></svg>';
    expect(getAnimationDuration(svg)).toBe(4000);
  });
});
