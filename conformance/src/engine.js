// Runs in the page (passed to page.evaluate). Must be self-contained: no imports, no closures.
// Input: one component's rules and its binding, with part tokens already expanded (except {id}).
// Output: one result per root found on the page.
export function evaluateComponent({ rootSelector, boundary, rules, markerAttr }) {
  const roots = [...document.querySelectorAll(rootSelector)];

  return roots.map((root, index) => {
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
      return { id: rule.id, level: rule.level, description: rule.description, pass: detail === null, detail };
    });

    return { index, marker: `[${markerAttr}="${index}"]`, element: describe(root), results };
  });
}
