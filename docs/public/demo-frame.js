// Docs-page helper for demo iframes. The demo pages themselves stay pure HTML + grund CSS.
// 1. Fits each iframe's height to its content, at every width (never below data-min-height, e.g. room for a modal).
// 2. Mirrors Blume's theme (data-theme on <html>) and text colour into the demo, the way a host site sets them.
const theme = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

const sync = (doc) => {
  doc.documentElement.style.colorScheme = theme();
  doc.documentElement.style.color = getComputedStyle(document.body).color;
};

const wire = (frame) => {
  const doc = frame.contentDocument;
  if (!doc?.body || frame.dataset.wired) return;
  frame.dataset.wired = '';
  sync(doc);
  const fit = () => {
    const style = doc.defaultView.getComputedStyle(doc.body);
    const height = doc.body.getBoundingClientRect().height + parseFloat(style.marginBlockStart) + parseFloat(style.marginBlockEnd);
    frame.style.blockSize = `${Math.ceil(Math.max(height, Number(frame.dataset.minHeight ?? 0)))}px`;
  };
  new ResizeObserver(fit).observe(doc.body);
  fit();
};

for (const frame of document.querySelectorAll('iframe[data-demo]')) {
  frame.addEventListener('load', () => wire(frame));
  wire(frame);
}

new MutationObserver(() => {
  for (const frame of document.querySelectorAll('iframe[data-demo]')) {
    if (frame.contentDocument) sync(frame.contentDocument);
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
