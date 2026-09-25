// Enforces the code rules (docs: Principles) on everything grund-ui ships.
// The generated warnings file is dev-only and deliberately uses fixed colours; it is not linted.
export default {
  plugins: ['stylelint-use-logical', './scripts/stylelint-grund.mjs'],
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
    'grund/type-only-in-where': true,
    'declaration-no-important': true,
  },
};
