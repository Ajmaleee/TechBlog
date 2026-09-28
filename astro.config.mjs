import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkDirective from "remark-directive";
import { remarkCallouts } from "./src/utils/remark-callouts.mjs";

// The production domain is read from an environment variable so the site
// never ships with a hardcoded dev URL. Set PUBLIC_SITE_URL in your
// Cloudflare Pages project settings (and locally in .env).
const SITE_URL = process.env.PUBLIC_SITE_URL || "https://example.com";

export default defineConfig({
  site: SITE_URL,
  output: "static",
  trailingSlash: "always",
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/drafts/"),
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
  vite: {
    define: {
      __ADSENSE_CLIENT_ID__: JSON.stringify(process.env.PUBLIC_ADSENSE_CLIENT_ID || ""),
    },
  },
});
