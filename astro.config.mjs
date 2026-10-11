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
const fileEnv = loadEnv(process.env.NODE_ENV || "production", process.cwd(), "PUBLIC_");
const SITE_URL =
  process.env.PUBLIC_SITE_URL || fileEnv.PUBLIC_SITE_URL || "https://example.com";

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
});
