# Rocket Growth Calculator Handoff

Last updated: 2026-06-21

This document is for the next AI or developer taking over the project. It summarizes what has been built, where the implementation lives, how the MVP variants are organized, and what should be checked before making more changes.

## Project Identity

- Product name in UI: `로켓그로스 비용 계산기`
- Production domain: `https://wingcoupang.site`
- Local dev URL: `http://localhost:4176`
- GitHub repository: `kjj8905/rocket-growth-calculator`
- Runtime: Node.js 24+
- Server framework: Express
- Data store: SQLite through Node built-in `node:sqlite`
- Current deploy target: Render Web Service

## Current Product Scope

The product started as a Rocket Growth cost calculator for Korean Coupang sellers and later expanded into a seller content/community platform.

Current public-facing pillars:

- Rocket Growth five-stage calculator
- Seller community pages
- Q&A pages
- Resource/library pages
- Calculation guide pages for SEO, AEO, and GEO
- Google/Naver/Daum search trend page

## Important Current Decision

The calculator logic should remain single-source. The site ships one canonical UI; the internal `/mvp` comparison variants were removed on 2026-06-21 (see "MVP Variants (removed)" below).

Do not copy the calculator logic into separate per-variant JS files unless the user explicitly approves a larger refactor. Duplicating the calculation logic will make future fixes much harder.

## Key Files

- `index.html`: main calculator DOM, home content, calculator workspace, save UI, community links.
- `app.js`: all client-side calculator state, calculation logic, save/load UI, UI interactions, GA events.
- `styles.css`: base design system, current production styling, MVP theme and structural layout overrides.
- `server.js`: Express server, auth routes, API routes, guide rendering, community rendering, MVP route rendering, sitemap/robots/llms generation.
- `seo-guides.js`: SEO/AEO/GEO guide content.
- `community-posts.js`: seeded community post content and category definitions.
- `PRODUCT.md`: product context for future design work.
- `docs/design-system.md`: existing design system notes.
- `docs/geo-aeo-seo-strategy.md`: search/GEO strategy notes.
- `docs/mvp-variants/`: MVP-specific handoff folders.

## Main Routes

- `/`: canonical calculator home.
- `/community`: seller community home.
- `/community/qna`: Q&A.
- `/community/resources`: resources.
- `/trends`: search trend page.
- `/guides`: guide hub.
- `/guides/:slug`: SEO/AEO/GEO guide pages.
- `/sitemap.xml`: dynamic sitemap.
- `/robots.txt`: dynamic robots rules.
- `/llms.txt`: AI-readable site summary.
- `/healthz`: health check endpoint.

## MVP Variants (removed)

The internal MVP UI/UX comparison variants were removed on 2026-06-21. This includes:

- the `/mvp` and `/mvp/2`–`/mvp/5` routes and their render functions in `server.js`,
- every `mvp-*` rule in `styles.css` (themes, legacy `.mvp-v*` / `.mvp-board*` / `.mvp-phone*` prototype CSS, `body.mvp-theme-*` blocks),
- the `docs/mvp-variants/` folder,
- the `Disallow: /mvp/` lines in `robots.txt`.

The site now ships a single canonical UI. Do not reintroduce parallel MVP codepaths without an explicit decision.

## Calculator Stages

The Rocket Growth calculator is organized as five stages:

1. `중국사입`: product cost, exchange rate, quantity, China-side purchase cost.
2. `중국→한국`: LCL logistics, customs, tax, agency/shipping agency fees.
3. `한국→쿠팡`: domestic inbound, pallet/no-pallet, Coupang inbound cost.
4. `쿠팡 소모 비용`: Coupang selling commission and post-sale costs.
5. `최종 비용`: unit cost, selling price, margin, total expected cost, total expected sales, expected margin, minimum ROAS.

Important UX decision:

- Inputs should look clearly editable.
- Computed outputs should look distinct but should not use noisy `자동계산` labels.
- Explanation text should not crowd the main calculator. Use inline help/modal or lower guide sections.

## Login And Save State

Kakao login and product save infrastructure exists, but production currently uses free validation settings:

- `ACCOUNT_FEATURE_ENABLED=false`
- Kakao login/save UI may be hidden or disabled depending on environment.
- Render free service does not provide persistent disk by default.

Server-side data model includes:

- `users`
- `sessions`
- `products`
- community tables

Product save data stores JSON snapshots of stages and final summary. This allows old saved products to survive new field additions through normalization.

## Community State

The community is server-rendered for SEO/GEO visibility. It is not a client-only SPA.

Community features implemented:

- category pages
- post detail pages
- seeded post content
- comment form
- reactions/bookmarks API
- login-gated write/reaction actions
- structured data for crawler readability

Current community category intent:

- China sourcing
- China-to-Korea logistics
- Korea-to-Coupang inbound
- Coupang selling cost
- final margin
- Q&A
- resources

## Search Trend State

The intended feature is Google/Naver/Daum real-time or trending search signals.

Current implementation:

- `/trends` renders the search trend page.
- `/api/search-trends` returns grouped provider data.
- Provider labels are `google`, `naver`, `daum`.

Production behavior depends on API keys/environment variables. If Naver/Daum keys are not configured, expect fallback or limited data. Do not claim real-time accuracy unless the provider integration is verified live.

## SEO, AEO, GEO State

Implemented:

- dynamic title/description/canonical
- sitemap
- robots
- llms.txt
- guide pages
- community pages
- Article/Q&A style structured data where applicable
- Google Analytics and AdSense scripts in the document head
- Naver verification meta was added earlier

Important:

- Do not hide SEO text with `display:none`.
- Long explanations should live on visible guide/community pages.
- Calculator screen should stay task-focused.
- `/mvp/` is intentionally disallowed in robots because MVP variants are internal comparison pages, not canonical search targets.

## Deployment Notes

Render settings currently expected:

- Build command: `npm install`
- Start command: `npm start`
- Node version: `24.14.1`
- `PUBLIC_SITE_URL=https://wingcoupang.site`
- `DATABASE_PATH=./data/app.sqlite` for free validation
- `ACCOUNT_FEATURE_ENABLED=false` for free validation

If save/login should become production-grade:

- Use Render paid persistent disk or migrate to Postgres/Supabase.
- Set `DATABASE_PATH=/data/app.sqlite` if using Render disk.
- Set `ACCOUNT_FEATURE_ENABLED=true`.
- Configure Kakao production redirect URI.

## Current Validation Commands

Run these before handoff or deploy:

```powershell
npm run check
```

Useful route checks:

```powershell
Invoke-WebRequest -Uri "http://localhost:4176/healthz" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:4176/mvp/2" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:4176/community" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:4176/trends" -UseBasicParsing
Invoke-WebRequest -Uri "http://localhost:4176/sitemap.xml" -UseBasicParsing
```

Public checks:

```powershell
Invoke-WebRequest -Uri "https://wingcoupang.site/healthz" -UseBasicParsing
Invoke-WebRequest -Uri "https://wingcoupang.site/sitemap.xml" -UseBasicParsing
```

## Recent QA Findings

Recently verified:

- MVP2 to MVP5 return 200.
- Community and trends pages return 200.
- MVP2 to MVP5 keep the real calculator function instead of standalone mock fields.
- `data-mvp-field` prototype fields are no longer present in active MVP variant pages.
- Calculator stage form and save button remain present after entering a stage.
- Community links and trend link remain present.
- No visible `NaN`, `Infinity`, or `undefined` strings in checked MVP pages.
- No horizontal overflow found in checked desktop runs.

## Main Risks For The Next AI

1. Over-splitting MVP variants into separate codepaths may break calculation consistency.
2. Changing `app.js` calculation logic without regression tests may damage cost results.
3. Login/save should not be treated as production-stable while Render is in free/ephemeral mode.
4. Search trend feature should not be marketed as real-time unless API-backed data is verified.
5. SEO/GEO pages should remain user-visible and useful, not hidden crawler text.
6. Community write features need spam, moderation, and persistent storage before serious public use.

## Recommended Next Work

Priority order:

1. Decide which MVP layout becomes the next main UI direction.
2. Remove or clearly mark the non-selected MVP variants before public marketing.
3. Add lightweight calculator regression tests for core formulas.
4. Audit mobile behavior for the selected MVP.
5. Verify GA4 events for calculator start, stage change, final view, community click, and guide click.
6. If community is kept, add moderation and persistent database plan.
7. If login/save is kept, move beyond free ephemeral storage.

