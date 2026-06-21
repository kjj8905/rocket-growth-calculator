# MVP Variant Folder Index

This folder separates MVP1 to MVP5 for planning and handoff purposes.

Important: the production code is still intentionally single-source. These folders document each variant and its purpose. They do not contain separate copies of calculator logic.

## Folder Map

- `mvp1/`: current canonical calculator experience.
- `mvp2/`: left-rail community desk structure.
- `mvp3/`: finance/report structure.
- `mvp4/`: dark operations console structure.
- `mvp5/`: mobile-first step flow structure.

## Active Route Map

- MVP1: `/`
- MVP2: `/mvp/2`
- MVP3: `/mvp/3`
- MVP4: `/mvp/4`
- MVP5: `/mvp/5`

## Implementation Map

The route and layout injection live in:

- `server.js`: `MVP_VARIANTS`, `renderMvpVariantPage`, `renderMvpCalculatorHtml`
- `styles.css`: `body.mvp-theme-2` through `body.mvp-theme-5`
- `index.html`: shared calculator DOM
- `app.js`: shared calculator state and behavior

## Rule For Future AI

Do not build MVP variants by deleting calculator features. MVP2 to MVP5 must keep:

- five-stage calculator
- real input fields
- real calculated outputs
- final summary
- save button state
- community links
- Q&A/resource links
- search trend link

