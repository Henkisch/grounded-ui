// Docs-page helper for demo iframes. The demo pages themselves stay pure HTML + grund CSS.
// 1. Fits each iframe's height to its content, at every width (never below data-min-height, e.g. room for a modal).
// 2. Mirrors Blume's theme (data-theme on <html>) and text colour into the demo, the way a host site sets them.
const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

// The frame's document, once the demo page (not the initial about:blank) has loaded.
const demoDoc = (frame) => {
  const doc = frame.contentDocument;
  return doc?.body && doc.defaultView && doc.URL !== 'about:blank' ? doc : null;
};

const sync = (doc) => {
  doc.documentElement.style.colorScheme = theme();
  doc.documentElement.style.color = getComputedStyle(document.body).color;
};

const fit = (frame) => {
  const doc = demoDoc(frame);
  // A frame in a hidden tab has no layout; measuring it would collapse the frame. Refit when shown.
  if (!doc || !frame.getClientRects().length) return;
  const style = doc.defaultView.getComputedStyle(doc.body);
  const height = doc.body.getBoundingClientRect().height + parseFloat(style.marginBlockStart) + parseFloat(style.marginBlockEnd);
  frame.style.blockSize = `${Math.ceil(Math.max(height, Number(frame.dataset.minHeight ?? 0)))}px`;
};

const wired = new WeakSet();
const wire = (frame) => {
  const doc = demoDoc(frame);
  if (!doc || wired.has(doc)) return;
  wired.add(doc);
  sync(doc);
  new ResizeObserver(() => fit(frame)).observe(doc.body);
  fit(frame);
};

for (const frame of document.querySelectorAll('iframe[data-demo]')) {
  frame.addEventListener('load', () => wire(frame));
  new ResizeObserver(() => fit(frame)).observe(frame);
  wire(frame);
}

new MutationObserver(() => {
  for (const frame of document.querySelectorAll('iframe[data-demo]')) {
    const doc = demoDoc(frame);
    if (doc) sync(doc);
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
