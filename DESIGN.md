---
version: alpha
name: Sellerdit Community Design System
description: Mobile-first Korean seller community UI for Rocket Growth Calculator.
colors:
  primary: "#2563eb"
  secondary: "#57606a"
  neutral: "#f6f7f8"
  canvas: "#f6f7f8"
  surface: "#ffffff"
  surface-soft: "#f8fafc"
  surface-action: "#e9eef2"
  surface-count: "#f1f3f5"
  text-strong: "#1a1a1b"
  text-body: "#334155"
  text-muted: "#57606a"
  text-faint: "#94a3b8"
  rule: "#edeff1"
  rule-strong: "#d9dee4"
  focus: "#2563eb"
  like: "#e0342b"
  success: "#03b26c"
  danger: "#f04452"
typography:
  headline-md:
    fontFamily: Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: -0.02em
  title-sm:
    fontFamily: Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: -0.01em
  body-md:
    fontFamily: Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1
  count:
    fontFamily: Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, Apple SD Gothic Neo, Noto Sans KR, sans-serif
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tnum"
spacing:
  micro: 4px
  xs: 6px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  gutter-mobile: 12px
  gutter-desktop: 16px
  shell-desktop: 1280px
  left-rail: 270px
  right-rail: 316px
rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 14px
  xl: 18px
  full: 9999px
components:
  post-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.none}"
    padding: 12px
  action-like:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.full}"
    height: 30px
    width: 52px
  action-like-mobile:
    backgroundColor: "{colors.surface-action}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.full}"
    height: 30px
    width: 52px
  action-count:
    backgroundColor: "{colors.surface-count}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.full}"
    height: 30px
    width: 26px
  avatar-sm:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    size: 30px
  rail-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.lg}"
    padding: 12px
  page-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text-strong}"
  soft-panel:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.text-body}"
    rounded: "{rounded.md}"
    padding: 12px
  divider:
    backgroundColor: "{colors.rule}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.rule-strong}"
    height: 1px
  focus-ring:
    backgroundColor: "{colors.focus}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  like-active:
    backgroundColor: "{colors.like}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  status-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
  status-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
---

# Sellerdit Community Design System

## Overview

Sellerdit is a practical community for Korean online sellers checking margin, sourcing, logistics, and real operating decisions. The UI should feel like a working seller's notebook inside a lightweight forum: dense enough for repeated reading, calm enough for finance-related judgment, and mobile-first because the app/community surface is the primary product surface.

The reference object is **a compact operations board**, not a marketing landing page. The design avoids decorative chrome and uses only enough structure to make posts, comments, actions, and seller signals easy to scan.

## Colors

- **Canvas `{colors.canvas}`** is the global community background. It should stay quiet and never become a branded gradient.
- **Surface `{colors.surface}`** is for topbar, rails, input areas, and contained widgets.
- **Rules `{colors.rule}` / `{colors.rule-strong}`** replace heavy cards and shadows. Feed and detail content should use dividers before boxes.
- **Focus blue `{colors.focus}`** is reserved for real interaction: active nav, focus, links, selected controls.
- **Like red `{colors.like}`** appears only when a like is active. Inactive actions remain neutral.
- **Action surfaces `{colors.surface-action}` and `{colors.surface-count}`** define mobile action chip backgrounds and count pills.

## Typography

Use Pretendard/system Korean sans throughout. Keep typography functional:

- Body copy uses 400 weight for readability.
- Usernames, selected filters, and compact labels use 600.
- Section headings use 700, but weights above 700 are not allowed.
- Counts, prices, dates, and stats use tabular numerals.
- Avoid oversized display type inside community screens; the community is a tool, not a hero page.

## Layout

The layout is mobile-first and then expands into the established Reddit-style desktop shell.

- Mobile uses a single feed column with 12px edge gutters.
- Desktop uses the fixed community shell: left rail 270px, center feed/detail, right rail 316px, max shell 1280px.
- Center posts and detail posts should align media and actions to one visual x-axis.
- Comments are clean nested blocks without connector lines unless explicitly reintroduced.
- Horizontal dividers are preferred over boxed cards for the main feed and detail content.

## Elevation & Depth

Sellerdit uses tonal layers and borders, not heavy shadows.

- Main feed/detail rows: transparent background with dividers.
- Rails/widgets: white surfaces with subtle border only.
- Hover states may use a faint neutral fill, never colored shadows.
- Mobile action controls may use a filled neutral chip for touch clarity.

## Shapes

- Main feed/detail rows use square edges and dividers.
- Inputs, chips, and rail cards use modest radius.
- Action chips and avatars use full radius.
- Do not mix pill controls with large rounded card chrome in the same region unless the component role differs clearly.

## Components

### Post row

A post row is avatar + content column + optional media + action row. Keep title/body/media/action alignment stable between list and detail states.

### Action row

The canonical like action is 52px × 30px with a 21–22px line heart, 4px internal gap, and a 26px count pill. Adjacent action items sit 8px apart. Comments reuse the same like action structure as posts.

### Comments

Comments use avatar, author/meta, body text, and action row. Nested replies are indicated by indentation only. Thread connector lines are off by default.

### Rails

Rails support navigation and context. They should be visually quieter than the center content and must not pull attention with shadows or saturated colors.

## Do's and Don'ts

- Do keep blue for active/focus/link states only.
- Do use tabular numerals for all seller counts and finance values.
- Do verify mobile first, then desktop.
- Do keep list/detail post geometry synchronized.
- Don't add connector lines to comments unless explicitly requested.
- Don't use decorative gradients, emoji icons, or heavy shadows in community UI.
- Don't introduce new components by one-off CSS if an existing post/action/rail pattern can cover it.
- Don't use font weights above 700.
