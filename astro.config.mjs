import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkDirective from "remark-directive";
import { remarkCallouts } from "./src/utils/remark-callouts.mjs";

// Astro exposes .env values to app code through import.meta.env, but this
// config file is evaluated before that and only sees real process env vars.
// loadEnv reads the .env file explicitly, so a local build resolves the same
// values as the Cloudflare Pages build, where they are real environment
// variables. process.env still takes priority, so a deploy can override
// anything committed in a local .env.
//
// The fallback is the live domain rather than a placeholder, because .env is
// gitignored and therefore absent on Cloudflare Pages — without this the
// deployed feed, sitemap, RSS and canonicals would all silently point at
// example.com. Override PUBLIC_SITE_URL when a custom domain is added.
const fileEnv = loadEnv(process.env.NODE_ENV || "production", process.cwd(), "PUBLIC_");
const SITE_URL =
  process.env.PUBLIC_SITE_URL || fileEnv.PUBLIC_SITE_URL || "https://ajmaleeeblog.pages.dev";

// Cloudflare Pages only injects environment variables into builds that run
// *after* they are set, so a missing variable fails silently: the analytics,
// AdSense, or search-console tag simply never appears and Google reports
// "couldn't verify". Log which optional tags this build actually resolved so
// that absence is visible in the Cloudflare build log instead of a mystery.
// These variables are all public by design, so only presence is logged.
for (const key of [
  "PUBLIC_GA_ID",
  "PUBLIC_GSC_VERIFICATION",
  "PUBLIC_ADSENSE_CLIENT_ID",
]) {
  if (!(process.env[key] || fileEnv[key])) {
    console.warn(
      `[site-config] ${key} is not set for this build — its tag will be omitted from the output.`
    );
  }
}

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  integrations: [
    mdx(),
    sitemap({
      // Keep the XML sitemap to indexable content: the search page is
      // noindex, and /blog/page/1/ is a duplicate of /blog/.
      filter: (page) =>
        !page.includes("/search/") && !page.includes("/blog/page/1/"),
    }),
  ],
  markdown: {
    remarkPlugins: [remarkDirective, remarkCallouts],
    shikiConfig: {
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
      wrap: true,
    },
  },
  image: {
    // Astro's built-in image service handles resizing + AVIF/WebP output
    // for local images referenced from Markdown frontmatter and content.
  },
});
