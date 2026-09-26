// Runs in the page (passed to page.evaluate). Must be self-contained: no imports, no closures.
// Input: one component's rules and its binding, with part tokens already expanded (except {id}).
// Output: one result per root found on the page.
// Computed names, roles and descriptions come from axe-core's accessibility engine (window.axe, injected first),
// so outcome rules judge what assistive technology gets, whatever markup produced it.
export function evaluateComponent({ rootSelector, boundary, rules, markerAttr }) {
  const roots = [...document.querySelectorAll(rootSelector)];
  const ax = window.axe;
  ax.setup(document);
  // Hidden content counts only where the platform counts it: an element that isn't rendered (a closed dialog)
  // still has a name, and an idref target that is itself hidden still contributes its text. aria-hidden
  // descendants of a rendered element never do.
  const rendered = (el) => el.checkVisibility?.({ visibilityProperty: true }) ?? el.getClientRects().length > 0;
  const text = (el, context = {}) =>
    ax.commons.text.accessibleTextVirtual(ax.utils.getNodeFromTree(el), { ...context, includeHidden: !rendered(el) });
  const refsOf = (el, attr) => (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean).map((ref) => document.getElementById(ref)).filter(Boolean);
  // aria-labelledby first, resolved per target, since axe drops hidden targets when includeHidden is off.
  const accText = (el) => {
    const refs = refsOf(el, 'aria-labelledby');
    const labelled = refs.map((ref) => text(ref, { inLabelledByContext: true })).join(' ').trim();
    return labelled || text(el);
  };
  const accDescription = (el) => {
    const refs = refsOf(el, 'aria-describedby');
    if (refs.length) return refs.map((ref) => text(ref, { inLabelledByContext: true })).join(' ');
    return el.getAttribute('aria-description') ?? '';
  };
  // A part's visible words: without aria-hidden descendants (an error tip inside a label) or nested controls.
  // A part that is aria-hidden as a whole keeps its text: it is the visible copy being checked.
  const visibleText = (el) => {
    if (el.closest('[aria-hidden="true"]')) return el.textContent;
    const copy = el.cloneNode(true);
    copy.querySelectorAll('[aria-hidden="true"], input, textarea, select').forEach((node) => node.remove());
    return copy.textContent;
  };
  // Words only, so punctuation, symbols such as a required "*" and spacing don't decide a match.
  const words = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const quote = (text) => `"${text.length > 80 ? `${text.slice(0, 77)}…` : text}"`;

  try {
    return roots.map((root, index) => evaluateRoot(root, index));
  } finally {
    ax.teardown();
  }

  function evaluateRoot(root, index) {
    root.setAttribute(markerAttr, String(index));
    const id = root.id ? CSS.escape(root.id) : '';
    const expand = (selector) => selector.replaceAll('{id}', id);

    // Elements inside this root that belong to it, not to a nested component.
    const within = (selector) =>
      [...root.querySelectorAll(expand(selector))].filter((el) => !boundary || el.closest(boundary) === root);
    const pick = (selector) => (selector === ':scope' ? [root] : within(selector));
    const describe = (el) => {
      const tag = el.tagName.toLowerCase();
      const attrs = [...el.attributes].filter((a) => a.name !== markerAttr).slice(0, 3).map((a) => `${a.name}="${a.value}"`);
      return `<${[tag, ...attrs].join(' ')}>`;
    };
    const idrefs = (el, attr) => (el.getAttribute(attr) ?? '').split(/\s+/).filter(Boolean);

    const checks = {
      absent({ selector, scope }) {
        if (scope === 'document') {
          const hits = [...document.querySelectorAll(expand(selector))];
          return hits.length ? `found ${describe(hits[0])}` : null;
        }
        if (root.matches(expand(selector))) return `root matches ${selector}`;
        const hits = within(selector);
        return hits.length ? `found ${describe(hits[0])}` : null;
      },
      count({ selector, equals }) {
        const n = within(selector).length;
        return n === equals ? null : `expected ${equals}, found ${n}`;
      },
      nonEmptyText({ selector }) {
        const empty = within(selector).find((el) => !el.textContent.trim());
        return empty ? `${describe(empty)} has no text` : null;
      },
      attrEquals({ a, b }) {
        const [elA] = pick(a.selector);
        const [elB] = pick(b.selector);
        if (!elA || !elB) return null; // presence is another rule's job
        const [va, vb] = [elA.getAttribute(a.attr), elB.getAttribute(b.attr)];
        return va !== null && va === vb ? null : `${a.attr}="${va ?? ''}" but ${b.attr}="${vb ?? ''}"`;
      },
      idrefIncludes({ from, to }, raw) {
        const [src] = pick(from.selector);
        const [target] = within(to);
        if (!src || !target) return null;
        return target.id && idrefs(src, from.attr).includes(target.id) ? null : `${from.attr} does not reference the ${raw.to.replace(/[{}]/g, '')} (${describe(target)})`;
      },
      idrefFirst({ from, to }, raw) {
        const [src] = pick(from.selector);
        const [target] = within(to);
        if (!src || !target) return null;
        return target.id && idrefs(src, from.attr)[0] === target.id ? null : `${from.attr}="${src.getAttribute(from.attr) ?? ''}" does not start with the ${raw.to.replace(/[{}]/g, '')} id "${target.id}"`;
      },
      uniqueIds() {
        const dup = [root, ...root.querySelectorAll('[id]')]
          .filter((el) => el.id)
          .find((el) => document.querySelectorAll(`[id="${CSS.escape(el.id)}"]`).length > 1);
        return dup ? `id "${dup.id}" is used more than once on the page` : null;
      },
      name({ selector, includes }, raw) {
        const [el] = pick(selector);
        if (!el) return null;
        const name = words(accText(el));
        if (!includes) return name ? null : `${describe(el)} has no accessible name`;
        if (!name) return null; // an empty name is the plain name rule's job
        const [part] = within(includes);
        const expected = part ? words(visibleText(part)) : '';
        if (!expected) return null; // a missing or empty part is another rule's job
        return name.includes(expected) ? null : `accessible name ${quote(accText(el).trim())} does not contain the ${raw.includes.replace(/[{}]/g, '')} text ${quote(expected)}`;
      },
      exposes({ selector, text }, raw) {
        const [el] = pick(selector);
        const [part] = within(text);
        if (!el || !part) return null;
        const expected = words(visibleText(part));
        if (!expected) return null;
        const exposed = words(`${accText(el)} ${accDescription(el)}`);
        return exposed.includes(expected) ? null : `the ${raw.text.replace(/[{}]/g, '')} text ${quote(expected)} is in neither the accessible name nor the description of ${describe(el)}`;
      },
      invalidHasError({ control, error }) {
        const invalid = within(control).filter((el) => el.getAttribute('aria-invalid') === 'true');
        if (!invalid.length || within(error).length) return null;
        const orphan = invalid.find((el) => ![...refsOf(el, 'aria-describedby'), ...refsOf(el, 'aria-errormessage')].some((ref) => ref.matches(error)));
        return orphan ? `${describe(orphan)} is invalid but no error message is in the field or referenced by it` : null;
      },
      role({ selector, oneOf }) {
        const [el] = pick(selector);
        if (!el) return null;
        const role = ax.commons.aria.getRole(el) ?? 'none';
        return oneOf.includes(role) ? null : `${describe(el)} has role "${role}", expected ${oneOf.join(' or ')}`;
      },
      referencedBy({ attr, where }) {
        if (!root.id) return 'the root has no id to reference';
        const selector = `${where ?? ''}[${attr}="${id}"]`;
        return document.querySelector(selector) ? null : `nothing on the page matches ${selector}`;
      },
    };

    const results = rules.map((rule) => {
      let detail;
      try {
        detail = checks[rule.test.kind](rule.test, rule.raw);
      } catch (error) {
        detail = `could not evaluate: ${error.message}`;
      }
      return { id: rule.id, level: rule.level, type: rule.type, description: rule.description, pass: detail === null, detail };
    });

    return { index, marker: `[${markerAttr}="${index}"]`, element: describe(root), results };
  }
}
