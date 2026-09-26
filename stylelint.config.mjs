// Enforces the code rules (docs: Principles) on everything grounded-ui ships.
// The generated warnings file is dev-only and deliberately uses fixed colours; it is not linted.
export default {
  plugins: ['stylelint-use-logical', 'stylelint-plugin-use-baseline', './scripts/stylelint-grounded.mjs'],
  rules: {
    // No colour values: currentColor, inherit or a custom property only.
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'],

    // em and lh, not px — except hairline widths, where 2 CSS px is the WCAG focus requirement.
    'declaration-property-unit-allowed-list': [
      {
        '/^border(-(block|inline)(-(start|end))?)?(-width)?$/': ['px', 'em', 'rem'],
        '/^outline(-width|-offset)?$/': ['px', 'em', 'rem'],
      },
    ],
    'unit-disallowed-list': [['px'], { ignoreProperties: { px: ['/^border/', '/^outline/'] } }],

    // Logical properties, no assumed writing direction.
    'csstools/use-logical': ['always', { except: ['float'] }],

    // Styling hooks only on data-component / data-part / data-variant. Class attribute belongs to the site.
    'selector-max-class': 0,
    'selector-max-id': 0,
    // Element selectors only inside :where()/:is()/:not() so they carry zero specificity and never go global.
    'grounded/type-only-in-where': true,
    'declaration-no-important': true,

    // Platform drift: only CSS that is Baseline (newly available or better), per the web-features data.
    // Progressive enhancements below Baseline are listed explicitly and must be `optional` in the contract's requires.
    'property-no-unknown': true,
    'plugin/use-baseline': [
      true,
      {
        available: 'newly',
        // resize: ignored on iOS Safari, where the textarea simply isn't user-resizable. Harmless.
        ignoreProperties: { resize: ['/^.+$/'] },
      },
    ],
  },
  overrides: [
    {
      // The styled look may use OKLCH for the one chromatic default (the error colour). Base stays colour-free.
      files: ['reference/**/*.styled.css'],
      rules: {
        'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'color'],
      },
    },
  ],
};
