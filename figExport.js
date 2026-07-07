/* figExport.js
 * Injects  ⬇ Save PNG | 📋 Copy | ⤢ Pop out  below every <canvas>.
 *
 * High-res support: if a page sets  canvas._hiResRender(ctx, fakeCvs)
 * the save and copy buttons will call it at EXPORT_SCALE× resolution.
 * Pages that don't set it fall back to capturing the current canvas state.
 *
 * Usage in a page that supports hi-res re-rendering:
 *   topCanvas._hiResRender = (ctx, cvs) => myRenderTop(ctx, cvs, currentParams);
 */
(function () {
  'use strict';

  const EXPORT_SCALE = 3;

  // ── resolve export canvas ────────────────────────────────────────────────
  function getExportCanvas(canvas) {
    if (typeof canvas._hiResRender === 'function') {
      const oc = document.createElement('canvas');
      oc.width  = canvas.width  * EXPORT_SCALE;
      oc.height = canvas.height * EXPORT_SCALE;
      const ctx = oc.getContext('2d');
      ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
      // pass fake dims so all coordinate math runs at original scale
      canvas._hiResRender(ctx, { width: canvas.width, height: canvas.height });
      return oc;
    }
    return canvas;
  }

  // ── actions ──────────────────────────────────────────────────────────────
  function doSave(canvas, filename) {
    const ec = getExportCanvas(canvas);
    const a  = document.createElement('a');
    a.download = filename;
    a.href     = ec.toDataURL('image/png');
    a.click();
  }

  async function doCopy(canvas, msgEl) {
    const ec = getExportCanvas(canvas);
    try {
      // Try modern Clipboard API (requires https or localhost)
      const blob = await new Promise(res => ec.toBlob(res, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      flash(msgEl, 'Copied!', '#4caf6e');
    } catch (_) {
      // Fallback: open PNG in new tab so user can copy manually
      const url = ec.toDataURL('image/png');
      const win = window.open(url, '_blank');
      if (win) flash(msgEl, 'Opened → right-click to copy', '#ffaa44');
      else     flash(msgEl, 'Use ⬇ Save instead', '#e05540');
    }
  }

  function doPopout(canvas) {
    const ec    = getExportCanvas(canvas);
    const url   = ec.toDataURL('image/png');
    const hiRes = typeof canvas._hiResRender === 'function';
    // Open window sized to show the image at native CSS pixels (1× not 3×),
    // so it fills most of the screen rather than appearing microscopic.
    const dispW = hiRes ? Math.round(ec.width  / EXPORT_SCALE) : ec.width;
    const dispH = hiRes ? Math.round(ec.height / EXPORT_SCALE) : ec.height;
    const winW  = Math.min(dispW  + 60, screen.availWidth  - 60);
    const winH  = Math.min(dispH  + 110, screen.availHeight - 60);
    const label = canvas.id ? canvas.id : 'Figure';
    const resTag = hiRes ? ` &nbsp;·&nbsp; ${EXPORT_SCALE}× resolution (${ec.width} × ${ec.height} px)` : '';
    const win = window.open('', '_blank',
      `width=${winW},height=${winH},resizable=yes,scrollbars=yes`);
    if (!win) { alert('Pop-out blocked — allow pop-ups for this page.'); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${label}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background:#07070d;
    display:flex; flex-direction:column; align-items:center;
    padding:20px 24px; min-height:100vh; gap:14px; font-family:Consolas,monospace;
  }
  h1 { font-size:14px; font-weight:normal; color:#8899aa; letter-spacing:0.08em; }
  .fig-wrap {
    border:1px solid #2a3040; padding:4px; background:#09090f;
    max-width:100%;
  }
  img  {
    display:block; max-width:100%; height:auto;
    image-rendering:-webkit-optimize-contrast;
    image-rendering:crisp-edges;
  }
  p { font-size:11px; color:#3a4a5a; text-align:center; }
  .hint { font-size:12px; color:#5a6a7a; }
</style></head>
<body>
  <h1>${label}${resTag}</h1>
  <div class="fig-wrap"><img src="${url}" width="${dispW}"></div>
  <p class="hint">Right-click the image → <em>Copy Image</em> &nbsp;·&nbsp; or drag into a slide / document</p>
  <p>Zoom: <a href="${url}" target="_blank" style="color:#4a7a9a;text-decoration:none;">open full-size in new tab ↗</a></p>
</body></html>`);
    win.document.close();
  }

  // ── flash feedback ───────────────────────────────────────────────────────
  function flash(el, text, color) {
    if (!el) return;
    clearTimeout(el._ft);
    el.textContent   = text;
    el.style.color   = color;
    el.style.opacity = '1';
    el._ft = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }

  // ── button factory ───────────────────────────────────────────────────────
  const BASE_STYLE = [
    'background:#131320', 'border:1px solid #2e3448', 'color:#8899bb',
    'padding:2px 8px', 'cursor:pointer', 'font-size:11px',
    'border-radius:2px', 'font-family:Consolas,monospace',
    'line-height:1.5', 'transition:background 0.14s,color 0.14s',
  ].join(';');

  function makeBtn(label, title, fn) {
    const b = document.createElement('button');
    b.textContent = label;
    b.title       = title;
    b.style.cssText = BASE_STYLE;
    b.addEventListener('mouseenter', () => {
      b.style.background = '#1c1c36'; b.style.color = '#ccd8ee';
    });
    b.addEventListener('mouseleave', () => {
      b.style.background = '#131320'; b.style.color = '#8899bb';
    });
    b.addEventListener('click', fn);
    return b;
  }

  // ── inject toolbar ───────────────────────────────────────────────────────
  function inject(canvas, idx) {
    if (canvas.dataset.exportDone) return;
    canvas.dataset.exportDone = '1';

    const hiRes    = typeof canvas._hiResRender === 'function';
    const name     = canvas.id || ('fig_' + (idx + 1));
    const saveLabel = hiRes ? `⬇ PNG (${EXPORT_SCALE}×)` : '⬇ PNG';
    const copyLabel = hiRes ? `📋 Copy (${EXPORT_SCALE}×)` : '📋 Copy';

    const row = document.createElement('div');
    row.className   = 'fig-export-row';
    row.style.cssText = [
      'display:flex', 'align-items:center', 'gap:4px',
      'margin-top:3px', 'justify-content:flex-end',
    ].join(';');

    const msg = document.createElement('span');
    msg.style.cssText = [
      'font-size:11px', 'font-family:Consolas,monospace',
      'opacity:0', 'transition:opacity 0.4s', 'min-width:88px',
      'text-align:right', 'margin-left:2px',
    ].join(';');

    row.appendChild(makeBtn(saveLabel, 'Download PNG', () => doSave(canvas, name + '.png')));
    row.appendChild(makeBtn(copyLabel, 'Copy to clipboard',   () => doCopy(canvas, msg)));
    row.appendChild(makeBtn('⤢ Pop out', 'Open in new window', () => doPopout(canvas)));
    row.appendChild(msg);

    canvas.insertAdjacentElement('afterend', row);
  }

  // Re-check for hi-res registrations after a short delay
  // (pages may set _hiResRender after DOMContentLoaded)
  function updateLabels() {
    document.querySelectorAll('canvas[data-export-done]').forEach(canvas => {
      const hiRes = typeof canvas._hiResRender === 'function';
      const btns  = canvas.nextElementSibling;
      if (!btns || !btns.classList.contains('fig-export-row')) return;
      const [saveBtn, copyBtn] = btns.querySelectorAll('button');
      if (hiRes) {
        if (saveBtn) saveBtn.textContent = `⬇ PNG (${EXPORT_SCALE}×)`;
        if (copyBtn) copyBtn.textContent = `📋 Copy (${EXPORT_SCALE}×)`;
      }
    });
  }

  // ── init ─────────────────────────────────────────────────────────────────
  function init() {
    document.querySelectorAll('canvas').forEach(inject);
    // Give page scripts time to register _hiResRender callbacks
    setTimeout(updateLabels, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 80);
  }

  // Expose for combined-export helpers in individual pages
  window.FigExport = {
    getExportCanvas,
    doSave,
    doCopy,
    doPopout,
    EXPORT_SCALE,
  };
})();
