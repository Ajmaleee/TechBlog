# Embedded & Circuits

**Live site: [ajmaleeeblog.pages.dev](https://ajmaleeeblog.pages.dev)**

Embedded & Circuits is a personal engineering blog about building things with
Arduino, ESP32, sensors, and whatever else is on the workbench. It covers
wiring guides, project walkthroughs, firmware notes, and the parts of a build
that do not go according to plan.

The site is written and maintained by **Ajmal Ali**, a self-taught electronics
hobbyist. The goal is simple: document real projects clearly enough that
someone else can follow along, including the mistakes.

- [Read the latest articles](https://ajmaleeeblog.pages.dev/blog/)
- [About the author](https://ajmaleeeblog.pages.dev/about/)
- [RSS feed](https://ajmaleeeblog.pages.dev/rss.xml)
- [Sitemap](https://ajmaleeeblog.pages.dev/sitemap-index.xml)

---

## What is on the site

| Section | What you will find |
| --- | --- |
| **Projects** | Complete builds: disaster alert networks, greenhouse controllers, smart lockers, solar trackers, robotic arms, and more |
| **ESP32** | Wi-Fi, Bluetooth, web dashboards, OTA updates, and ESP32-specific firmware notes |
| **Arduino** | UNO and Nano projects, sensor interfacing, displays, relays, and core electronics |
| **Sensors** | Practical guides for ultrasonic, temperature, gas, current, GPS, and vibration sensors |
| **Debugging** | Fixes for hardware and firmware that only misbehave sometimes |
| **Tooling** | Notes on the software and workflow around embedded development |

Every article is written from a bench-testing perspective: what was connected,
what code was uploaded, what went wrong, and how it was fixed.

The site also includes:

- Full-text search at `/search/`
- Category and tag archive pages generated from article metadata
- RSS feed and XML sitemap generated at build time
- Light and dark themes
- Reading-time estimates and copy buttons on code blocks
- Responsive layouts and accessible navigation
- A runtime image fallback so a missing image never leaves a broken icon
- Optional Google AdSense and GA4 integration, with ads and analytics off in
  local development

---

## How it is built

This is a static site built with **Astro 5**. There is no CMS, database, or
backend. Articles are Markdown files in the repository, and the publishing
pipeline is:

```
Markdown file -> git push -> GitHub Actions validation -> Astro build -> Cloudflare Pages
```

- **Content:** Astro content collections with a Zod schema in
  `src/content/config.ts`
- **Rendering:** static HTML at build time, with small vanilla JavaScript
  enhancements for search, theme switching, navigation, and code copying
- **Styling:** one hand-written design system in `src/styles/global.css`
- **Hosting:** Cloudflare Pages, deployed from the `main` branch
- **CI:** GitHub Actions validates content and runs the production build on
  every push and pull request
- **Images:** root-relative files in `public/images/`, with `astro:assets`
  available for optimized local images
- **SEO:** canonical URLs, Open Graph, Twitter Cards, and JSON-LD structured
  data generated per page
- **Feeds:** RSS and sitemap generated from the canonical site URL

---

## Project structure

```
src/
  components/           Header, Footer, SEO, PostCard, AdSlot, Analytics, consent UI
  content/
    blog/               One Markdown file per article
    config.ts           Frontmatter schema; bad metadata fails the build
  layouts/              BaseLayout and ArticleLayout
  pages/                Routes: /, /blog/, /blog/[slug]/, /about/, /search/, etc.
  styles/global.css     The complete design system
  utils/                Post queries, slug helpers, remark callouts
public/
  images/               Covers and inline images
  scripts/              Small browser scripts (code copy, image fallback)
scripts/
  validate-content.mjs  Cross-file content checks used by CI
.github/workflows/
  ci.yml                Validate and build on push/PR
astro.config.mjs        Site URL, integrations, Markdown plugins
```

### Main routes

| Route | Purpose |
| --- | --- |
| `/` | Home page with the lead story and latest articles |
| `/blog/` | All published articles with pagination |
| `/blog/[slug]/` | Individual article |
| `/blog/category/[category]/` | Articles in a category |
| `/blog/tag/[tag]/` | Articles with a tag |
| `/search/` | Client-side search |
| `/about/` | Author and site background |
| `/contact/` | Contact information |
| `/privacy/`, `/terms/` | Privacy policy and terms/disclaimer |
| `/rss.xml` | RSS feed |
| `/sitemap-index.xml` | XML sitemap |

The production URL defaults to `https://ajmaleeeblog.pages.dev` in
`astro.config.mjs`, so canonicals, feeds, and the sitemap remain correct even
when `.env` is absent. Set `PUBLIC_SITE_URL` to override it for a custom
domain.

---

## Local development

Requirements: **Node.js 20+** and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:4321`.

```bash
npm run build          # astro check + production build into dist/
npm run preview        # serve the built site locally
npm run validate:content
```

Draft posts (`draft: true`) appear in development but are excluded from the
production build, sitemap, and RSS feed.

---

## Writing an article

1. Create a Markdown file in `src/content/blog/`.

   The filename becomes the URL slug:

   ```
   src/content/blog/interfacing-hc-sr04-esp32.md
   -> /blog/interfacing-hc-sr04-esp32/
   ```

   Use lowercase, hyphenated filenames.

2. Add frontmatter:

   ```yaml
   ---
   title: "Interfacing an HC-SR04 Ultrasonic Sensor with ESP32"
   description: "A practical guide to wiring and programming the HC-SR04 with an ESP32."
   date: 2026-09-21
   author: "Ajmal Ali"
   category: "Sensors"
   tags:
     - ESP32
     - Ultrasonic
     - HC-SR04
   cover: "/images/hc-sr04-cover.jpg"
   coverAlt: "HC-SR04 ultrasonic sensor connected to an ESP32"
   draft: false
   ---
   ```

   Required fields: `title`, `description`, `date`, `category`, `tags` (at
   least one), and `cover`.

   Optional fields: `updated`, `author`, `draft`, `canonicalUrl`, `seoTitle`,
   `seoDescription`, `noindex`, and `coverAlt`. See
   `src/content/config.ts` for the exact limits and defaults.

3. Write the article in Markdown below the frontmatter.

4. Categories and tags are freeform. A new `category:` or tag automatically
   creates its archive page at build time.

5. Run the checks before publishing:

   ```bash
   npm run validate:content
   npm run build
   ```

6. Commit and push to `main`. GitHub Actions validates the content, and
   Cloudflare Pages deploys the new build.

### Callouts

The site supports three Markdown callout blocks:

```markdown
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

### Images

Put images in `public/images/` and reference them with a root-relative path:

```markdown
![HC-SR04 wiring diagram](/images/hc-sr04-wiring.jpg)
```

Use descriptive filenames and always include alt text.

If a cover or inline image is missing, content validation reports a warning and
`public/scripts/image-fallback.js` replaces the broken image with an on-brand
placeholder at runtime. Add the real file to `public/images/` to clear the
warning.

---

## Configuration

Copy `.env.example` to `.env` for local work. In Cloudflare Pages, set the same
values under **Settings -> Environment variables**.

| Variable | Purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Canonical production URL. Defaults to `https://ajmaleeeblog.pages.dev` |
| `PUBLIC_ADSENSE_CLIENT_ID` | AdSense publisher ID; blank disables ads |
| `PUBLIC_ADSENSE_ENABLED` | Set to `false` to disable ads even when configured |
| `PUBLIC_ADSENSE_SLOT_BELOW_INTRO` | Ad unit ID for the below-intro placement |
| `PUBLIC_ADSENSE_SLOT_AFTER_ARTICLE` | Ad unit ID for the after-article placement |
| `PUBLIC_CONSENT_ENABLED` | Set to `false` to omit the cookie consent notice |
| `PUBLIC_GA_ID` | GA4 measurement ID; blank disables analytics |
| `PUBLIC_GSC_VERIFICATION` | Optional Google Search Console verification token |

Only `PUBLIC_`-prefixed values are exposed to the browser. Do not put API keys,
tokens, or other real secrets in this repository or in `PUBLIC_` variables.

Ads and analytics have production defaults in code, so a normal deploy works
without configuring them. Local development stays quiet unless the relevant
values are set.

---

## Deployment

Cloudflare Pages builds the site from this repository using its Git
integration.

- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node version:** 20
- **Production branch:** `main`

Every push to `main` triggers a production deployment. Pull requests and other
branches can produce preview deployments automatically.

For a manual deploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name=techblog
```

To use a custom domain, add it in the Cloudflare Pages project settings.
Cloudflare provisions HTTPS automatically.

---

## Content validation

`npm run validate:content` checks the issues that the frontmatter schema cannot
catch by itself:

- duplicate slugs
- empty or too-short article bodies
- missing required cover fields
- cover image files that do not exist in `public/`
- drafts that will be excluded from production
- internal links to articles that do not exist yet

`npm run build` runs `astro check` before the Astro build, so TypeScript and
template errors fail fast. The GitHub Actions workflow runs both commands on
every push and pull request.

---

## Troubleshooting

**Build fails with a frontmatter error**  
The error names the file and field. Check it against
`src/content/config.ts`. Common causes are a missing `cover`, an empty `tags`
array, a description that is too short, or an invalid date.

**An article does not appear on the site**  
Confirm `draft: false` (or omit the field) and that the file is inside
`src/content/blog/`.

**A new category or tag page returns 404 in development**  
Restart `npm run dev`; new static paths are picked up on restart.

**An image is broken or shows a placeholder**  
Confirm the path starts with `/images/` and the file exists in
`public/images/`.

**The Cloudflare build fails but the local build works**  
Check that the Pages project uses Node 20 and that required environment
variables are set. `.env` is not committed.

**Canonical URLs or the sitemap point to the wrong domain**  
Set `PUBLIC_SITE_URL` in the Cloudflare Pages environment variables and
redeploy.
