# Rocket Growth Calculator Design System

Source reference: `C:\Users\kjj89\Downloads\DESIGN.md`

This project applies the Toss/TDS-inspired parts that fit a seller cost calculator. It does not copy Toss branding, logos, or product claims.

## Visual Direction

- Background stays calm and light: `#f9fafb` page, `#ffffff` panels.
- Blue is reserved for interactive surfaces: calculator banners, active segment, focus states.
- Financial values use strong charcoal text and tabular numerals.
- Shadows are subtle and neutral. Do not use colored shadows or decorative gradients.

## Tokens

- Primary: `#3182f6`
- Primary hover: `#2272eb`
- Primary weak background: `#e8f3ff`
- Text strong: `#191f28`
- Text body: `#4e5968`
- Text muted: `#6b7684`
- Border: `#e5e8eb`
- Surface muted: `#f2f4f6`
- Success: `#03b26c`
- Error: `#f04452`

## Typography

- Use the Toss-style Korean-first stack from `styles.css`.
- Use 700 for headings and financial amounts.
- Use 600 for labels and selected controls.
- Use 400 for body copy.
- Use `font-variant-numeric: tabular-nums` for all amounts and numeric inputs.

## Components

### Calculator Banner

- Filled blue button, 16px radius, white 700 text.
- It is an interactive selector, not decoration.
- Hover and focus use `#2272eb`.

### Segmented Switch

- Parent background: `#f2f4f6`.
- Active segment: white surface with subtle shadow.
- Inactive text: muted grey.

### Form Panel

- White surface, 16px radius, neutral level-2 shadow.
- Section spacing follows 8px base scale.
- Summary result block uses a muted surface inside the panel.

### Inputs

- Box input style.
- 46px height, 14px radius, soft grey background.
- Focus border is primary blue with a light blue ring.
- Disabled/read-only inputs keep stable geometry and use grey surface.

## Layout

- Desktop keeps the user's requested calculator hub: four banners in one row.
- Tablet collapses to two columns.
- Mobile collapses to one column.
- Calculator detail view uses form first, preview second.

## Rules

- No emojis in UI.
- Do not use blue as ornament. Blue means tappable, active, or focused.
- Do not add heavy shadows.
- Do not introduce additional accent colors unless they have semantic meaning.
- Keep calculator copy concise and practical.
