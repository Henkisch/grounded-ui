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
  // Any CSS colour (rgb, oklch, color-mix, system colours) to [r, g, b, a] via a canvas, then WCAG contrast.
  const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (color) => {
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = '#000';
    paint.fillStyle = color;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const luminance = ([r, g, b]) => [r, g, b].map((c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  // The first opaque background behind an element (the page's Canvas if none).
  const backdrop = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const color = rgba(getComputedStyle(node).backgroundColor);
      if (color[3] > 0.5) return color;
    }
    const probe = document.createElement('i');
    probe.style.color = 'Canvas';
    document.body.append(probe);
    const canvas = rgba(getComputedStyle(probe).color);
    probe.remove();
    return canvas;
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
    // `:scope` is the root; `:scope` plus simple conditions (`:scope:is(fieldset)`) is the root when it matches.
    const pick = (selector) => {
      if (selector === ':scope') return [root];
      if (/^:scope(?![\s>+~])/.test(selector) && !/[\s>+~]/.test(selector.replace(/\([^()]*\)/g, ''))) {
        return root.matches(expand(selector).replace(/^:scope/, '*')) ? [root] : [];
      }
      return within(selector);
    };
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
      // name, exposes and role check every element the selector matches and report the first that fails.
      name({ selector, includes }, raw) {
        const [part] = includes ? within(includes) : [];
        const expected = part ? words(visibleText(part)) : '';
        for (const el of pick(selector)) {
          const name = words(accText(el));
          if (!includes) {
            if (!name) return `${describe(el)} has no accessible name`;
            continue;
          }
          if (!name || !expected) continue; // an empty name or a missing part is another rule's job
          if (!name.includes(expected)) return `accessible name ${quote(accText(el).trim())} does not contain the ${raw.includes.replace(/[{}]/g, '')} text ${quote(expected)}`;
        }
        return null;
      },
      exposes({ selector, text }, raw) {
        const [part] = within(text);
        const expected = part ? words(visibleText(part)) : '';
        if (!expected) return null;
        const el = pick(selector).find((control) => !words(`${accText(control)} ${accDescription(control)}`).includes(expected));
        return el ? `the ${raw.text.replace(/[{}]/g, '')} text ${quote(expected)} is in neither the accessible name nor the description of ${describe(el)}` : null;
      },
      role({ selector, oneOf }) {
        const el = pick(selector).find((candidate) => !oneOf.includes(ax.commons.aria.getRole(candidate) ?? 'none'));
        return el ? `${describe(el)} has role "${ax.commons.aria.getRole(el) ?? 'none'}", expected ${oneOf.join(' or ')}` : null;
      },
      // The match is the first element in the page's Tab order (e.g. a skip link).
      firstFocusable({ selector }) {
        const [el] = pick(selector);
        if (!el) return null;
        const tabbable = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')]
          .filter((node) => !node.disabled && node.tabIndex >= 0 && !node.closest('[inert], [hidden]') && node.type !== 'hidden');
        // Other instances of the same component may come first (several skip links in a row).
        const first = tabbable.sort((a, b) => (a.tabIndex || 1e9) - (b.tabIndex || 1e9)).find((node) => !roots.includes(node) || node === el);
        return first === el ? null : `${describe(first)} comes before ${describe(el)} in the Tab order`;
      },
      // Focused by keyboard, the match is visible: a real box, not clipped away, not transparent.
      visibleOnFocus({ selector }) {
        const before = document.activeElement;
        try {
          for (const el of pick(selector)) {
            document.activeElement?.blur?.();
            el.focus({ focusVisible: true });
            if (document.activeElement !== el) return `${describe(el)} can't take focus`;
            const s = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const clipped = s.clipPath !== 'none' || (s.clip && s.clip !== 'auto');
            if (r.width < 2 || r.height < 2 || clipped || parseFloat(s.opacity) < 0.1) return `${describe(el)} stays invisible when focused`;
          }
          return null;
        } finally {
          document.activeElement?.blur?.();
          before?.focus?.();
        }
      },
      // Same-page links (href="#id") point at an element that exists.
      hrefTargetsExist({ selector }) {
        const dead = pick(selector).find((el) => {
          const href = el.getAttribute('href') ?? '';
          if (!href.startsWith('#')) return false;
          const id = decodeURIComponent(href.slice(1));
          return !id || !document.getElementById(id);
        });
        return dead ? `${describe(dead)} points at an id that isn't on the page` : null;
      },
      // No bare text matching `pattern` directly inside the matches (e.g. "/" or "›" typed between breadcrumb links).
      noLooseText({ selector, pattern }) {
        const re = new RegExp(pattern, 'u');
        for (const el of pick(selector)) {
          const loose = [...el.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && re.test(node.textContent));
          if (loose) return `${describe(el)} holds the text ${quote(loose.textContent.trim())}, which screen readers read out`;
        }
        return null;
      },
      // The accessible name isn't only a generic word ("Read more", "Click here", "Info").
      nameNotGeneric({ selector, generic }) {
        const banned = new Set(generic.map(words));
        const el = pick(selector).find((candidate) => banned.has(words(accText(candidate))));
        return el ? `${describe(el)} is named only ${quote(accText(el).trim())}, which says nothing out of context` : null;
      },
      // Every match carries the same non-empty value for attr (e.g. radios in one group share a name).
      sameAttr({ selector, attr }) {
        const values = pick(selector).map((el) => el.getAttribute(attr) ?? '');
        if (values.length < 2) return null;
        return new Set(values).size === 1 && values[0] ? null : `${attr} differs across the group: ${[...new Set(values)].map((v) => `"${v}"`).join(', ')}`;
      },
      // WCAG 2.5.3: each control's accessible name contains the visible text of its own label(s).
      labelInName({ selector }) {
        for (const el of pick(selector)) {
          const expected = words([...(el.labels ?? [])].map(visibleText).join(' '));
          const name = words(accText(el));
          if (expected && name && !name.includes(expected)) return `accessible name ${quote(accText(el).trim())} does not contain the label text ${quote(expected)}`;
        }
        return null;
      },
      // WCAG 2.4.7 + 1.4.11: keyboard focus draws an indicator, and an outline ring contrasts `min`:1 with the
      // background around it. Parts that can't take focus right now (disabled, inert) are skipped.
      focusRing({ selector, min }) {
        const before = document.activeElement;
        try {
          for (const el of pick(selector)) {
            if (!rendered(el) || el.disabled) continue;
            document.activeElement?.blur?.();
            const look = (st) => [st.borderTopColor, st.borderTopWidth, st.backgroundColor].join('|');
            const unfocused = look(getComputedStyle(el));
            el.focus({ focusVisible: true });
            if (document.activeElement !== el) continue;
            const s = getComputedStyle(el);
            const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
            if (outline) {
              const ratio = contrast(rgba(s.outlineColor), backdrop(el));
              if (ratio < min) return `${describe(el)} has a focus ring of ${ratio.toFixed(2)}:1 against its background, below ${min}:1`;
              continue;
            }
            if (s.boxShadow !== 'none') continue; // a box-shadow ring: present; its colour isn't measured
            // No ring: a change of border or background on focus is an indicator; a changed border must itself be visible.
            if (look(s) === unfocused) return `${describe(el)} shows no focus indicator`;
            if (s.borderTopStyle !== 'none' && parseFloat(s.borderTopWidth) > 0) {
              const ratio = contrast(rgba(s.borderTopColor), backdrop(el));
              if (ratio < min) return `${describe(el)} marks focus only with a border of ${ratio.toFixed(2)}:1 against its background, below ${min}:1`;
            }
          }
          return null;
        } finally {
          document.activeElement?.blur?.();
          before?.focus?.();
        }
      },
      // WCAG 2.5.8: the rendered target is at least `min` CSS px in both directions. Unrendered elements are skipped.
      targetSize({ selector, min }) {
        const small = pick(selector).find((el) => {
          const r = el.getBoundingClientRect();
          return rendered(el) && r.width && (r.width < min - 0.5 || r.height < min - 0.5);
        });
        if (!small) return null;
        const r = small.getBoundingClientRect();
        return `${describe(small)} is ${Math.round(r.width)}×${Math.round(r.height)} px, below ${min}×${min}`;
      },
      invalidHasError({ control, error }) {
        const invalid = within(control).filter((el) => el.getAttribute('aria-invalid') === 'true');
        if (!invalid.length || within(error).length) return null;
        const orphan = invalid.find((el) => ![...refsOf(el, 'aria-describedby'), ...refsOf(el, 'aria-errormessage')].some((ref) => ref.matches(error)));
        return orphan ? `${describe(orphan)} is invalid but no error message is in the field or referenced by it` : null;
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
