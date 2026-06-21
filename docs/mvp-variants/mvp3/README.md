# MVP3 - Finance Report Layout

## Route

- Local: `http://localhost:4176/mvp/3`
- Production: `https://wingcoupang.site/mvp/3`

## Body Class

- `mvp-variant-active`
- `mvp-theme-3`

## Role

MVP3 explores a report-like calculator experience where result interpretation is visually prioritized.

## Structure

- Wide top identity band
- Right-side navigation panel on home
- On calculator stage entry, the navigation panel is hidden and the calculator takes the full width
- Result/preview panel appears on the left
- Input form appears on the right

## Design Intent

Margin report and decision-support tool. This version is useful if the key user behavior is reading results first and adjusting inputs afterward.

## Current Checks

- Real calculator fields are preserved.
- Stage form and save button remain present.
- Result panel appears before the input panel in stage view.
- Community and search trend links remain available.

## Watchouts

This version changes the mental order of the stage screen: result first, input second. If users find that confusing, move MVP3 back toward MVP1 structure or add a clearer "input changes update this result" cue.

