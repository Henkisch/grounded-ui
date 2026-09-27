---
name: grounded-ui
description: Build or fix accessible UI components (text field, select, dialog, accordion, toggletip) as native HTML with zero JavaScript, and prove them accessible with Grounded UI's executable contracts. Use when asked to create, review or repair a form field, dropdown, modal, FAQ/accordion or info tooltip, or when asked whether a component is accessible.
---

# Grounded UI

Grounded UI gives each component an executable accessibility contract, a reference implementation in native HTML and CSS, and a check that runs the contract on any HTML. Your job is to build the component, run the check, and fix it until the verdict is PASS.

## Workflow

1. **Get the component.** Call the `get_component` tool with the slug (`text-field`, `select`, `dialog`, `accordion`, `toggletip`; `list_components` lists them). It returns the parts, the outcome rules, reference markup, the CSS and the theming tokens.
2. **Write the markup.** Start from the reference markup. Keep `data-gui="<slug>"` on the root and `data-gui-part` on each part. Make every id unique on the page and update the attributes that point at them (`for`, `aria-describedby`, `aria-labelledby`, `commandfor`).
3. **Add the CSS.** Link or copy `core.css` once per page, then `<slug>.css` (required) and `<slug>.styled.css` (optional look). Theme with custom properties only: roles `--gui-border`, `--gui-focus`, `--gui-danger`, `--gui-radius`, or `--gui-<slug>-*` for one component. Never edit the files, never use `!important`.
4. **Check it.** Call `check_html` with the markup (or `check_url` for a running page). Fix every `FAIL` and `AXE` line, then check again. Repeat until the first line reads `VERDICT: PASS`.
5. **Report.** Tell the user the verdict, and list what the page itself must still handle (from the "What the site must handle" section of `get_component`).

## Rules

- **No JavaScript.** Native elements (`dialog`, `details`, `popover`, invoker commands, form controls) carry the behaviour. Don't add scripts, frameworks or ARIA that the native element already provides.
- **Outcome rules are the verdict.** Technique rules are Grounded UI's recommendations. Existing markup that differs from the technique but passes every outcome rule is accessible; say so rather than rewriting it.
- **Never call a component accessible without a PASS** from `check_html` or `check_url`. If you can't run the check, say that it is unverified.
- **Existing markup:** to check a component that doesn't use Grounded UI's hooks, pass `component` and a `binding` (YAML: `root:` selector and `parts:` mapping each part to a selector) instead of rewriting it.

## Without the MCP tools

Read the component page as Markdown at `/components/<slug>.md` on the Grounded UI docs site, and run the check with the CLI:

```sh
npx grounded-conformance page.html --component text-field
```

Exit code 0 and "0 failure(s)" is a PASS.
