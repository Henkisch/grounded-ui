// grounded/type-only-in-where: element selectors are allowed only inside :where(),
// so they carry zero specificity and can never match globally on a host site.
import stylelint from 'stylelint';

const ruleName = 'grounded/type-only-in-where';
const messages = stylelint.utils.ruleMessages(ruleName, {
  rejected: (sel) => `Element selector outside :where() in "${sel}"`,
});

// Remove every :where(...) group (balanced parens), attribute brackets and strings.
const strip = (selector) => {
  let out = '';
  for (let i = 0; i < selector.length; i++) {
    if (selector.startsWith(':where(', i)) {
      let depth = 0;
      for (i += ':where'.length; i < selector.length; i++) {
        if (selector[i] === '(') depth++;
        else if (selector[i] === ')' && --depth === 0) break;
      }
      out += ':where';
      continue;
    }
    if (selector[i] === '[') {
      while (i < selector.length && selector[i] !== ']') i++;
      out += '[]';
      continue;
    }
    out += selector[i];
  }
  return out;
};

const hasBareType = (selector) =>
  // an identifier that starts a compound: at start, or after a combinator, comma or "("
  /(^|[\s>+~,(])-?[a-z][\w-]*/i.test(strip(selector).replace(/::?[\w-]+/g, ':p'));

const rule = (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkRules((node) => {
    if (node.parent?.type === 'atrule' && /keyframes$/i.test(node.parent.name)) return;
    if (hasBareType(node.selector)) {
      stylelint.utils.report({ ruleName, result, node, message: messages.rejected(node.selector) });
    }
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
export default stylelint.createPlugin(ruleName, rule);
