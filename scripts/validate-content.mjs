#!/usr/bin/env node
// Extra content sanity checks that run in CI before the Astro build.
// The Zod schema in src/content/config.ts already enforces field-level
// validity (this is where `astro build` would fail on bad frontmatter);
// this script catches cross-file issues Zod can't see on its own:
// duplicate slugs, missing cover images, and empty bodies.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const BLOG_DIR = path.join(process.cwd(), "src/content/blog");
const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));

let errors = [];
let warnings = [];
const seenSlugs = new Map();

for (const file of files) {
  const filePath = path.join(BLOG_DIR, file);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const slug = file.replace(/\.mdx?$/, "");

  if (seenSlugs.has(slug)) {
    errors.push(`Duplicate slug "${slug}" in ${file} and ${seenSlugs.get(slug)}`);
  }
  seenSlugs.set(slug, file);

  if (!content || content.trim().length < 50) {
    errors.push(`${file}: article body looks empty or too short`);
  }

  if (!data.cover) {
    errors.push(`${file}: missing required "cover" field`);
  } else if (typeof data.cover === "string" && data.cover.startsWith("/")) {
    const imgPath = path.join(process.cwd(), "public", data.cover);
    if (!fs.existsSync(imgPath)) {
      errors.push(`${file}: cover image "${data.cover}" not found in /public`);
    }
  }

  if (data.draft) {
    warnings.push(`${file}: marked as draft — will be excluded from the production build`);
  }

  // Broken internal Markdown links: [text](/blog/some-slug/)
  const internalLinks = [...content.matchAll(/\]\(\/blog\/([a-z0-9-]+)\/?\)/g)].map((m) => m[1]);
  for (const linkedSlug of internalLinks) {
    if (linkedSlug && !fs.existsSync(path.join(BLOG_DIR, `${linkedSlug}.md`)) && !fs.existsSync(path.join(BLOG_DIR, `${linkedSlug}.mdx`))) {
      warnings.push(`${file}: internal link points to "/blog/${linkedSlug}/" which doesn't exist yet`);
    }
  }
}

if (warnings.length) {
  console.warn("\nContent warnings:");
  warnings.forEach((w) => console.warn("  ⚠ " + w));
}

if (errors.length) {
  console.error("\nContent validation failed:");
  errors.forEach((e) => console.error("  ✖ " + e));
  console.error(`\n${errors.length} error(s). Fix these before publishing.\n`);
  process.exit(1);
}

console.log(`\n✔ Content validation passed (${files.length} article(s) checked).\n`);
