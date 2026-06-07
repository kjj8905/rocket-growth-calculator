# Rocket Growth Calculator

Korean seller cost calculator with a small Node/Express backend for Kakao login and account-based product saves.

## Run Locally

```powershell
npm install
npm start
```

Open:

```text
http://localhost:4176
```

Node 24 or newer is required because the backend uses the built-in `node:sqlite` module.

## Kakao Login Setup

Copy `.env.example` to `.env` and fill the Kakao values after creating a Kakao Developers app.

```env
PORT=4176
PUBLIC_SITE_URL=http://localhost:4176
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=http://localhost:4176/auth/kakao/callback
SESSION_SECRET=replace-with-a-long-random-string
DATABASE_PATH=./data/app.sqlite
```

Kakao Developers settings:

- Web platform domain: `http://localhost:4176`
- Kakao Login: enabled
- Redirect URI: `http://localhost:4176/auth/kakao/callback`
- Consent items: nickname required, email optional

Without Kakao keys, the calculator still works, but product saving is blocked with a login/setup message.

## SEO / AEO / GEO

The server injects `PUBLIC_SITE_URL` into canonical links, Open Graph URLs, JSON-LD, `robots.txt`, `sitemap.xml`, and `llms.txt`.

The SEO/AEO/GEO strategy is documented in:

```text
docs/geo-aeo-seo-strategy.md
```

Knowledge guide URLs are server-rendered for crawlers and AI answer engines:

- `/guides`
- `/guides/rocket-growth-calculator`
- `/guides/lcl-logistics-cost`
- `/guides/import-vat-customs`
- `/guides/coupang-pallet-cost`
- `/guides/coupang-fee`

For production, set:

```env
PUBLIC_SITE_URL=https://your-production-domain.example
```

After deployment, submit these URLs to search consoles:

- `https://your-production-domain.example/sitemap.xml`
- `https://your-production-domain.example/robots.txt`
- `https://your-production-domain.example/llms.txt`

## Deploy Free Validation on Render

This project includes `render.yaml` for a free Render Web Service validation deploy.

Recommended free validation settings:

- Repository: private GitHub repository
- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Account/save feature: disabled
- Database path: `./data/app.sqlite`

Render environment variables:

```env
NODE_VERSION=24.14.1
DATABASE_PATH=./data/app.sqlite
ACCOUNT_FEATURE_ENABLED=false
PUBLIC_SITE_URL=https://your-render-service.onrender.com
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=https://your-render-service.onrender.com/auth/kakao/callback
SESSION_SECRET=replace-with-a-long-random-string
```

For the free validation version, keep `ACCOUNT_FEATURE_ENABLED=false`. This hides Kakao login and saved calculation UI, and disables product-save APIs. The SQLite file is only ephemeral in this mode.

Render free services can sleep after inactivity. The app exposes a lightweight health URL for uptime monitors:

```text
https://your-render-service.onrender.com/healthz
```

Paid storage upgrade settings:

- Add a Render persistent disk with mount path `/data`
- Set `DATABASE_PATH=/data/app.sqlite`
- Set `ACCOUNT_FEATURE_ENABLED=true`
- Set Kakao login environment variables and redirect URI

After the Render URL is issued, update Kakao Developers:

- Web platform domain: `https://your-render-service.onrender.com`
- Redirect URI: `https://your-render-service.onrender.com/auth/kakao/callback`

## Data

- SQLite database: `data/app.sqlite`
- Session cookie: HttpOnly signed cookie
- Product saves include both `stages` and `finalSummary`, including direct final-cost inputs.
