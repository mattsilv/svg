# SVG Drop

Single-file web app (index.html) deployed to Cloudflare Pages as project `svg-drop`.

## Key Bug: SVG Rendering via innerHTML

**CRITICAL**: Always render SVGs using `innerHTML` with serialized SVG strings, NOT `cloneNode()` from DOMParser.

`DOMParser.parseFromString(xml, 'image/svg+xml')` creates nodes in the XML namespace. Using `cloneNode(true)` and appending to the HTML DOM can cause SVGs to silently fail to render (0×0 size, invisible). Using `innerHTML = serializedSvgString` lets the browser's HTML parser handle namespace resolution correctly.

## Manual Test Checklist (before committing changes to parsing/rendering)

Paste each of these into the app and verify they render visibly:

1. **viewBox-only SVG** (no width/height attributes):
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <circle cx="50" cy="50" r="40" fill="green"/>
   </svg>
   ```

2. **Complex viewBox-only SVG** (multiple nested groups):
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <g fill="#16A34A"><circle cx="50" cy="50" r="36"/></g>
     <rect x="22" y="38" width="56" height="40" rx="8" fill="#F0F9FF" stroke="#0284C7" stroke-width="4"/>
   </svg>
   ```

3. **SVG with explicit dimensions**:
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
     <rect width="200" height="200" fill="red"/>
   </svg>
   ```

4. **SVG without xmlns** (should auto-add):
   ```xml
   <svg viewBox="0 0 50 50"><rect width="50" height="50" fill="purple"/></svg>
   ```

5. **Animated SVG** (should show animation warning):
   ```xml
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
     <circle cx="50" cy="50" r="20" fill="orange">
       <animate attributeName="r" from="20" to="40" dur="1s" repeatCount="indefinite"/>
     </circle>
   </svg>
   ```
