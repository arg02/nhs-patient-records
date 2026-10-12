// On-page text editing for local previews. Save posts to serve.py /__edit, which rewrites the HTML file.
// Load as a module before any script that renders into the page, so the original markup is captured first.

const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);

const SELECTOR = [
  '.page-hd__meta', 'h1', '.lede', '.summary__label', '.toc__group-label', '.part-hd', '.section__kicker',
  'h2', 'h3', 'h4', 'p', 'li', 'th', 'td', 'caption', 'cite', 'q', '.src-links', '.src-note',
  '.chart__title', '.chart__desc', '.chart__source', '.outcome__label', '.outcome__desc',
  '.stat__k', '.stat__v', '.stat__s', '.formula',
].join(',');
const EXCLUDE = '.site-nav, [data-render], .pe-bar, script, style';

const CSS = `
.pe-bar { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; gap: 8px; align-items: center;
  background: #1a2030; color: #fff; padding: 8px 10px; border-radius: 10px; font: 13px "DM Sans", sans-serif;
  box-shadow: 0 4px 18px rgba(0,0,0,0.25); }
.pe-bar button { font: inherit; font-weight: 600; border: 0; border-radius: 6px; padding: 6px 12px; cursor: pointer;
  background: #2f3a52; color: #fff; }
.pe-bar button[data-act="toggle"][aria-pressed="true"] { background: #9fd0ff; color: #1a2030; }
.pe-bar button[data-act="save"] { background: #1a7f4b; }
.pe-bar button:disabled { opacity: 0.45; cursor: default; }
.pe-status { color: #c9d3e0; padding: 0 4px; }
.pe-status:empty { display: none; }
body.pe-on [contenteditable="true"] { cursor: text; border-radius: 3px; }
body.pe-on [contenteditable="true"]:hover { outline: 1px dashed #8aa0b8; outline-offset: 2px; }
body.pe-on [contenteditable="true"]:focus { outline: 2px solid #1a4a78; outline-offset: 2px; }
body.pe-on .pe-dirty:not(:focus) { outline: 2px solid #f0b400; outline-offset: 2px; }
body.pe-on .pe-failed:not(:focus) { outline: 2px solid #d4351c; outline-offset: 2px; }
`;

if (LOCAL) init();

function init() {
  const found = [...document.querySelectorAll(SELECTOR)].filter((el) => !el.closest(EXCLUDE));
  const foundSet = new Set(found);
  const targets = found.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (foundSet.has(p)) return false;
    return true;
  });
  const isTarget = new Set(targets);
  const state = new Map(targets.map((el) => [el, { outer: el.outerHTML, inner: el.innerHTML }]));

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);

  const bar = document.createElement('div');
  bar.className = 'pe-bar';
  bar.innerHTML = `
    <button type="button" data-act="toggle" aria-pressed="false">Edit text</button>
    <span class="pe-status" role="status"></span>
    <button type="button" data-act="save" hidden disabled>Save</button>
    <button type="button" data-act="discard" hidden disabled>Discard</button>`;
  document.body.append(bar);
  const btn = (act) => bar.querySelector(`[data-act="${act}"]`);
  const status = bar.querySelector('.pe-status');

  let on = false;
  const targetOf = (node) => {
    for (let el = node instanceof Element ? node : node?.parentElement; el; el = el.parentElement) {
      if (isTarget.has(el)) return el;
    }
    return null;
  };
  const dirtyTargets = () => targets.filter((el) => cleanInner(el) !== state.get(el).inner);

  function refresh(message) {
    const n = dirtyTargets().length;
    btn('save').disabled = btn('discard').disabled = n === 0;
    status.textContent = message ?? (n ? `${n} unsaved change${n === 1 ? '' : 's'}` : on ? 'Click any text to edit' : '');
  }

  function setOn(value) {
    on = value;
    document.body.classList.toggle('pe-on', on);
    btn('toggle').setAttribute('aria-pressed', String(on));
    btn('toggle').textContent = on ? 'Done editing' : 'Edit text';
    btn('save').hidden = btn('discard').hidden = !on;
    targets.forEach((el) => {
      if (on) el.setAttribute('contenteditable', 'true');
      else el.removeAttribute('contenteditable');
    });
    refresh();
  }

  async function save() {
    const dirty = dirtyTargets();
    if (!dirty.length) return;
    const edits = dirty.map((el) => {
      const s = state.get(el);
      const idx = targets.indexOf(el);
      const n = targets.slice(0, idx).filter((t) => state.get(t).outer === s.outer).length;
      const inner = cleanInner(el);
      return { el, inner, to: wrap(el, s, inner), from: s.outer, n };
    });
    btn('save').disabled = true;
    refresh('Saving…');
    try {
      const res = await fetch('/__edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, edits: edits.map(({ from, to, n }) => ({ from, to, n })) }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error || res.statusText);
      const failed = new Set(out.failed.map((f) => f.index));
      edits.forEach((e, i) => {
        e.el.classList.toggle('pe-failed', failed.has(i));
        if (!failed.has(i)) state.set(e.el, { outer: e.to, inner: e.inner });
        e.el.classList.toggle('pe-dirty', failed.has(i));
      });
      refresh(failed.size
        ? `Saved ${out.applied}; ${failed.size} couldn’t be matched in the file (outlined red)`
        : `Saved ${out.applied} change${out.applied === 1 ? '' : 's'}`);
    } catch (err) {
      refresh(`Save failed: ${err.message}. Is serve.py running?`);
    }
  }

  function discard() {
    dirtyTargets().forEach((el) => {
      const s = state.get(el);
      const nums = [...el.querySelectorAll(':scope > .fig-num')];
      el.innerHTML = s.inner;
      nums.reverse().forEach((a) => el.prepend(a));
      el.classList.remove('pe-dirty', 'pe-failed');
    });
    refresh();
  }

  bar.addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act;
    if (act === 'toggle') setOn(!on);
    if (act === 'save') save();
    if (act === 'discard') discard();
  });

  document.addEventListener('input', (e) => {
    const el = targetOf(e.target);
    if (!el) return;
    el.classList.toggle('pe-dirty', cleanInner(el) !== state.get(el).inner);
    refresh();
  });

  document.addEventListener('keydown', (e) => {
    if (!on) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); return; }
    const el = targetOf(e.target);
    if (!el) return;
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
    if (e.key === 'Escape') el.blur();
  });

  document.addEventListener('paste', (e) => {
    if (!on || !targetOf(e.target)) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });

  document.addEventListener('click', (e) => {
    if (on && targetOf(e.target) && e.target.closest('a')) e.preventDefault();
  }, true);

  window.addEventListener('beforeunload', (e) => {
    if (dirtyTargets().length) e.preventDefault();
  });
}

function wrap(el, s, inner) {
  const close = `</${el.tagName.toLowerCase()}>`;
  return s.outer.slice(0, s.outer.length - s.inner.length - close.length) + inner + close;
}

function cleanInner(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('.fig-num').forEach((n) => n.remove());
  c.querySelectorAll('[data-cursor-ref]').forEach((n) => n.removeAttribute('data-cursor-ref'));
  c.querySelectorAll('span[style]:not([class]), font').forEach((n) => n.replaceWith(...n.childNodes));
  return c.innerHTML
    .replace(/<b>/g, '<strong>').replace(/<\/b>/g, '</strong>')
    .replace(/<i>/g, '<em>').replace(/<\/i>/g, '</em>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<br>$/, '');
}
