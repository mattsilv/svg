/**
 * Parse raw SVG string, validate, fix namespace/dimensions, detect animation.
 * Handles AI-generated SVG quirks: markdown fences, missing xmlns, strict XML errors.
 * @param {string} raw - Raw SVG XML string (possibly wrapped in markdown)
 * @returns {{ serialized: string, isAnimated: boolean }}
 * @throws {Error} on invalid input
 */
export function parseSvgString(raw) {
  if (!raw || !raw.trim()) throw new Error('Empty input');

  // Strip markdown code fences that AI models often include
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:svg|xml|html)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  cleaned = cleaned.trim();

  // Extract just the <svg>...</svg> if there's surrounding text
  const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i);
  if (svgMatch) cleaned = svgMatch[0];

  const svg = parseXmlOrHtml(cleaned);

  // Ensure xmlns
  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  // Inject dimensions from viewBox for viewBox-only SVGs to prevent 0×0 collapse
  // Use actual pixel values (not %) so sizing works in flex/grid layouts
  if (svg.getAttribute('viewBox') && !svg.getAttribute('width') && !svg.getAttribute('height')) {
    const parts = svg.getAttribute('viewBox').split(/[\s,]+/);
    if (parts.length === 4) {
      svg.setAttribute('width', parts[2]);
      svg.setAttribute('height', parts[3]);
    }
  }

  const serialized = new XMLSerializer().serializeToString(svg);

  const isAnimated = /<animate|<animateTransform|<animateMotion|<set /i.test(serialized)
    || /animation|@keyframes/i.test(serialized);

  return { serialized, isAnimated };
}

/**
 * Try strict XML parsing first, fall back to lenient HTML parsing.
 * AI-generated SVGs often have minor XML issues that HTML parsing tolerates.
 */
function parseXmlOrHtml(svgString) {
  const parser = new DOMParser();

  // Try strict XML first
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

  // Neither worked — throw the original XML error
  throw new Error(xmlErr.textContent.split('\n')[0]);
}
