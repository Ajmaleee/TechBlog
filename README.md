# Embedded & Circuits

A personal engineering blog focused on Arduino, ESP32, electronics, sensors,
and embedded systems — built as a fast static site with **Astro**, publishing
straight from **Markdown → GitHub → Cloudflare Pages**.

```
Markdown file → git push → GitHub Actions validation → Astro build → Cloudflare Pages
```

No CMS, no database, no backend. Content lives as Markdown files in this
repository and is the single source of truth.

---

## Why Astro

Astro was chosen over Hugo/Eleventy for this project because it gives the
best combination of: native Markdown **and** MDX support, built-in image
optimization (`astro:assets`, automatic AVIF/WebP + responsive sizing),
zero client-side JavaScript by default ("islands" only where needed — this
site currently ships none as a framework runtime, only small vanilla
scripts), first-class `@astrojs/sitemap` and `@astrojs/rss` integrations,
Shiki syntax highlighting out of the box, and official Cloudflare Pages
support.

---

## Project structure

```
src/
  content/
    blog/            ← every article is one Markdown file here
    config.ts         ← frontmatter schema (Zod) — build fails on bad metadata
  components/          ← Header, Footer, SEO, PostCard, AdSlot, Analytics
  layouts/              ← BaseLayout (shell), ArticleLayout (article chrome)
  pages/                ← routes: /, /blog/, /blog/[slug]/, /about/, etc.
  styles/global.css     ← the entire design system (tokens + rules)
  utils/                ← posts.ts (queries/helpers), remark-callouts.mjs
public/                 ← static assets served as-is (images, favicon, scripts)
scripts/validate-content.mjs  ← CI content checks (duplicate slugs, etc.)
.github/workflows/ci.yml      ← validates + builds on every push/PR
astro.config.mjs        ← site URL, integrations, markdown/remark config
wrangler.toml            ← optional, only for CLI-based Cloudflare deploys
```

---

## Local development

```bash
npm install
cp .env.example .env    # fill in PUBLIC_SITE_URL at minimum
npm run dev
```

Visit `http://localhost:4321`. Draft posts (`draft: true`) are visible in
dev but excluded automatically from production builds.

```bash
npm run build      # type-checks + builds the static site into dist/
npm run preview    # serves the built dist/ locally
```

---

## Writing a new article

1. Create a Markdown file in `src/content/blog/`, named for the URL you
   want, e.g. `src/content/blog/interfacing-dht22-esp32.md` →
   `/blog/interfacing-dht22-esp32/`. Use lowercase, hyphenated filenames —
   the filename **is** the slug.
2. Add frontmatter at the top of the file:

   ```yaml
   ---
   title: "Interfacing an HC-SR04 Ultrasonic Sensor with ESP32"
   description: "A practical guide to connecting and programming the HC-SR04 with an ESP32."
   date: 2026-09-21
   updated: 2026-09-21
   author: "Ajmal Ali A"
   category: "ESP32"
   tags:
     - ESP32
     - Ultrasonic Sensor
     - HC-SR04
   cover: "/images/hc-sr04-cover.jpg"
   draft: false
   ---
   ```

   Required fields: `title`, `description`, `date`, `category`, `tags`
   (at least one), `cover`. See `src/content/config.ts` for the full
   schema, defaults, and optional fields (`updated`, `canonicalUrl`,
   `seoTitle`, `seoDescription`, `noindex`).

3. Write the article in normal Markdown below the frontmatter.
4. **Categories** are freeform — just type a new `category:` value and a
   `/blog/category/<name>/` page is generated automatically.
5. **Tags** work the same way — any tag creates a `/blog/tag/<tag>/` page.
6. **Images**: put files in `public/images/`, reference them as
   `/images/your-file.jpg` in frontmatter or Markdown. Use descriptive
   filenames and always give inline images alt text:
   `![HC-SR04 wiring diagram](/images/hc-sr04-wiring.jpg)`.
7. **Callouts** — use these directly in Markdown, no HTML needed:

   ```
   :::note
   This sensor operates at 5V.
   :::

   :::tip
   A logic-level converter also works instead of a resistor divider.
   :::

   :::warning
   Do not connect this pin directly to 5V on a 3.3V-only MCU.
   :::
   ```

8. **Drafts** — set `draft: true` to keep a post out of production (it
   stays visible at `npm run dev` so you can review it, and is excluded
   from the sitemap/RSS/production build entirely).
9. Run `npm run dev`, check the article renders correctly (headings,
   code blocks, images, callouts), then run `npm run validate:content`
   to catch duplicate slugs or missing cover images before pushing.
10. `git add`, `git commit`, `git push` to `main`.
11. GitHub Actions validates the content and build (see
    `.github/workflows/ci.yml`); Cloudflare Pages then builds and deploys
    automatically (see below). The article is live at its permanent URL
    within a couple of minutes.

You never hand-edit HTML for normal publishing.

---

## How URLs are generated

The Markdown filename becomes the slug: `src/content/blog/my-post.md` →
`/blog/my-post/`. URLs are permanent — renaming a file changes its URL, so
set `canonicalUrl` in frontmatter if you ever need to move content without
breaking existing links.

---

## How SEO metadata works

`src/components/SEO.astro` generates, for every page: `<title>`, meta
description, canonical URL, Open Graph tags, Twitter Card tags, and
JSON-LD structured data (`WebSite`, `Person`, and — on articles —
`BlogPosting` + `BreadcrumbList`). Articles get this automatically from
frontmatter; override the on-page title/description for search purposes
specifically with the optional `seoTitle` / `seoDescription` fields. Set
`noindex: true` on a post to keep it out of search indexes without
unpublishing it.

`robots.txt` (`src/pages/robots.txt.ts`) and the sitemap
(`@astrojs/sitemap`) are generated automatically at build time from
`PUBLIC_SITE_URL` — there is no hardcoded domain anywhere in the codebase.

---

## Google Search Console

1. Set `PUBLIC_SITE_URL` to your real production domain.
2. Deploy the site.
3. In Search Console, add the property and verify via the HTML meta tag
   method: set `PUBLIC_GSC_VERIFICATION` to the code Google gives you (in
   Cloudflare Pages env vars, not committed to git if you'd rather keep it
   private — though it isn't a secret).
4. Submit `https://yourdomain.com/sitemap-index.xml` as your sitemap.

---

## How AdSense configuration works

Ads are fully off unless configured — nothing loads, nothing renders, and
no ad script touches Core Web Vitals during development.

- `PUBLIC_ADSENSE_CLIENT_ID` — your `ca-pub-XXXXXXXXXXXXXXXX` ID. Leave
  blank to disable ads entirely.
- `PUBLIC_ADSENSE_ENABLED=false` — force-disable ads even with a client ID
  set (useful for a staging/preview environment).

Placements are components, not manual Markdown insertions:
`<AdSlot slot="..." placement="below-intro" />` and
`<AdSlot slot="..." placement="after-article" />` are already wired into
`ArticleLayout.astro`. Add a sidebar placement the same way if you build a
desktop sidebar later. Never paste ad markup directly into an article.

---

## Analytics

Off by default. Set `PUBLIC_GA_ID` (a GA4 measurement ID) to enable Google
Analytics via `src/components/Analytics.astro`. No script loads without it.

---

## Cloudflare deployment

**Recommended: Cloudflare's native Git integration.**

1. Push this repository to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages →
   Connect to Git**, select this repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (set `NODE_VERSION=20` in environment variables
     if Cloudflare doesn't auto-detect it)
4. Environment variables (Pages project → Settings → Environment
   variables), set for **Production** and, if desired, differently for
   **Preview**:
   - `PUBLIC_SITE_URL`
   - `PUBLIC_ADSENSE_CLIENT_ID` (optional)
   - `PUBLIC_ADSENSE_ENABLED` (optional)
   - `PUBLIC_GA_ID` (optional)
   - `PUBLIC_GSC_VERIFICATION` (optional)
5. Every push to `main` triggers a production deployment; every pull
   request/branch gets its own preview deployment automatically.
6. **Custom domain + HTTPS**: Pages project → Custom domains → add your
   domain. Cloudflare provisions HTTPS automatically.

**Alternative: CLI deploys via Wrangler** (if you'd rather not use the Git
integration, or want to deploy from a different CI system):

```bash
npm run build
npx wrangler pages deploy dist --project-name=techblog
```

`wrangler.toml` is included for this path but isn't required for the Git
integration above. Because the build only depends on `npm run build`
producing static files in `dist/`, the deployment target can be swapped
later (e.g. to a Worker, or another static host) without touching the
site's architecture.

---

## Troubleshooting

- **Build fails with a frontmatter error** — the error names the file and
  field; check it against `src/content/config.ts`. Common causes: missing
  `cover`, `description` too short, `tags` empty, invalid `date`.
- **Article doesn't appear on the site** — check `draft: false` is set (or
  the field is omitted, since `false` is the default) and that the file is
  actually inside `src/content/blog/`.
- **New category/tag page 404s locally after adding it** — restart
  `npm run dev`; content collection changes sometimes need a dev-server
  restart to pick up new static paths.
- **Images look wrong / broken** — confirm the path starts with `/images/`
  and the file actually exists in `public/images/`.
- **Cloudflare build fails but local build works** — check the Node
  version matches (`NODE_VERSION=20`) and that all required env vars are
  set in the Cloudflare Pages project settings, since `.env` is not
  committed to git.

---

## Firmware code in articles

Code samples default to **ESP32 Arduino core v3.x** — call this out
explicitly in an article if a sketch relies on 2.x-only APIs, since a lot
of older ESP32 tutorials online still target 2.x and the two aren't fully
drop-in compatible (notably around `ledc`/PWM and some analog APIs).

---

## Roadmap (not built yet, architecture allows for it later)

Project series/multi-part tutorials, an author page, a changelog,
comments (e.g. via an external service), newsletter signup, and deeper
search — none of these require restructuring the current
Markdown → Astro → Cloudflare pipeline.
