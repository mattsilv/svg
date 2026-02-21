/**
 * Utilities for detecting and measuring SVG animation duration.
 */

/**
 * Parse a SMIL time value string to milliseconds.
 * Returns 0 for "indefinite" or unrecognized values.
 * @param {string} val
 * @returns {number}
 */
export function parseDurValue(val) {
  if (val === 'indefinite' || val === 'freeze') return 0;
  const m = val.trim().match(/^(\d+(?:\.\d+)?)(s|ms)?$/);
  if (!m) return 0;
  return m[2] === 'ms' ? parseFloat(m[1]) : parseFloat(m[1]) * 1000;
}

/**
 * Determine the animation duration of an SVG string in milliseconds.
 * Inspects SMIL dur/repeatDur attributes and CSS animation-duration.
 * Returns 2000ms as a safe default if nothing is found.
 * @param {string} svgStr
 * @returns {number}
 */
export function getAnimationDuration(svgStr) {
  let maxDur = 0;

  // SMIL: dur and repeatDur attributes
  for (const [, val] of svgStr.matchAll(/\b(?:dur|repeatDur)="([^"]+)"/g)) {
    const ms = parseDurValue(val);
    if (ms > maxDur) maxDur = ms;
  }

  // CSS animation shorthand: `animation: name 1.5s ease`
  for (const [, num, unit] of svgStr.matchAll(/animation\s*:[^;"}]*?(\d+(?:\.\d+)?)(s|ms)/g)) {
    const ms = unit === 'ms' ? parseFloat(num) : parseFloat(num) * 1000;
    if (ms > maxDur) maxDur = ms;
  }

  // CSS animation-duration property
  for (const [, num, unit] of svgStr.matchAll(/animation-duration\s*:\s*(\d+(?:\.\d+)?)(s|ms)/g)) {
    const ms = unit === 'ms' ? parseFloat(num) : parseFloat(num) * 1000;
    if (ms > maxDur) maxDur = ms;
  }

  return maxDur || 2000;
}
