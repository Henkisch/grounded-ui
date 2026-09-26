# GOV.UK Frontend — reading the report

`text-field.md` is generated; this note is the human reading of it. Run it again with `node reports/run.mjs govuk-frontend`.

## Result (GOV.UK Frontend 6.5.1, text-field contract 0.3.0)

- **Every outcome rule passes** in all 24 published input and textarea examples: each field has a name containing its label, hints and errors reach the accessible description, and the role is textbox. axe reports nothing either.
- **One technique rule differs: TF-11** (the error's id comes first in `aria-describedby`), in 1 example. GOV.UK lists the hint first, then the error. That is a deliberate, researched design choice, not an oversight, so it's evidence that TF-11 is an opinion and needs outside review before it can be called a rule.

## What we learned about the contract

- **The contract detects "invalid" only through `aria-invalid`.** GOV.UK marks errors with a class and an error message, and doesn't set `aria-invalid`, so TF-10 passes without being exercised. Open question: should the contract recognise an error part on its own as the invalid state, and should it recommend `aria-invalid` alongside?
- **The DOM order differs.** GOV.UK puts the error message before the input; Grounded UI puts it after. No rule covers order, and this shows why none should without evidence.
- **The binding approach works.** Five selectors in `text-field.binding.yaml` were enough to test a library that has never heard of grounded.

## What this means for Phase 0

GOV.UK Frontend is among the best-tested component libraries there is, so finding nothing normative is the expected result, and it's a good sign that the rules are correct. It doesn't meet the kill criterion ("real, fixable issues that axe doesn't report"). That test needs implementations more typical of the sites Grounded UI is for: CMS themes, page builders and hand-written markup.
