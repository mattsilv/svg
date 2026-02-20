/**
 * Parse raw SVG string, validate, fix namespace/dimensions, detect animation.
 * @param {string} raw - Raw SVG XML string
 * @returns {{ serialized: string, isAnimated: boolean }}
 * @throws {Error} on invalid input
 */
export function parseSvgString(raw) {
  if (!raw || !raw.trim()) throw new Error('Empty input');

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, 'image/svg+xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(err.textContent.split('\n')[0]);

  const svg = doc.documentElement;
  if (svg.tagName !== 'svg') throw new Error('Root element is not <svg>');

  // Ensure xmlns
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  // Inject dimensions for viewBox-only SVGs to prevent 0×0 collapse
  if (svg.getAttribute('viewBox') && !svg.getAttribute('width') && !svg.getAttribute('height')) {
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
  }

  const serialized = new XMLSerializer().serializeToString(svg);

  const isAnimated = /<animate|<animateTransform|<animateMotion|<set /i.test(serialized)
    || /animation|@keyframes/i.test(serialized);

  return { serialized, isAnimated };
}
