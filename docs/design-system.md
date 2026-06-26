# Rocket Growth / Sellerdit Design System

Source of truth: [`../DESIGN.md`](../DESIGN.md), authored in the Google `DESIGN.md` format.

Tooling source reviewed and installed:

- `https://github.com/google-labs-code/design.md`
- npm package: `@google/design.md`
- validation command: `npm run design:lint`
- token export command: `npm run design:tokens`

## Current direction

Sellerdit is a practical Korean seller community: a compact operations board, not a marketing page. The UI should be readable, repeatable, mobile-first, and calm enough for margin/sourcing/logistics decisions.

## Core tokens

- Canvas: `#f6f7f8`
- Surface: `#ffffff`
- Soft surface: `#f8fafc`
- Action surface: `#e9eef2`
- Count pill: `#f1f3f5`
- Text strong: `#1a1a1b`
- Text body: `#334155`
- Text muted: `#57606a`
- Rule: `#edeff1`
- Focus blue: `#2563eb`
- Active like red: `#e0342b`

## Typography

- Font stack: Pretendard/system Korean sans.
- Body: 14px / 400 / 1.55.
- Labels: 12px / 600.
- Counts: 13px / 500 / tabular numerals.
- Headings: max 700 weight.
- Do not use weights above 700.

## Layout rules

- Mobile first: single feed column, 12px edge gutter.
- Desktop: established Reddit-style shell: left rail 270px, right rail 316px, max shell 1280px.
- Main feed/detail content uses dividers before card chrome.
- Post list/detail media and action rows must share a stable x-axis.
- Comments use indentation only. Thread connector lines are off by default.

## Canonical components

### Post/action row

The canonical like action is shared by posts and comments:

```text
width: 52px
height: 30px
icon: 21-22px
icon/count gap: 4px
count pill: 26px wide, neutral grey
adjacent action gap: 8px
```

### Comments

- Structure: avatar + author/meta + body + action row.
- Replies: indentation only.
- No vertical/horizontal connector lines unless explicitly requested later.

### Rails

- Rails provide navigation/context, not primary content.
- Use white surface, subtle border, low visual weight.

## Implementation mapping

`styles.css` now has a late token bridge section:

```css
/* Sellerdit design system v14: DESIGN.md token bridge */
```

It maps the DESIGN.md values to CSS custom properties such as:

```css
--sd-canvas
--sd-surface
--sd-text-strong
--sd-focus
--sd-like
--sd-action-h
--sd-action-like-w
--sd-action-row-gap
```

Future Sellerdit UI edits should prefer these `--sd-*` variables instead of hard-coded one-off values.

## Rules

- Blue means active, focused, selected, or linked.
- Red is only for active like/destructive states.
- No decorative gradients, emoji UI icons, or heavy shadows.
- Do not add a new visual pattern if the existing post/action/rail/comment pattern covers it.
- Verify `npm run design:lint`, `npm run check`, and `npm run design:smoke` before committing UI changes.
