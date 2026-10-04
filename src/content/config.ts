import { defineCollection, z } from "astro:content";

// This schema is the single source of truth for blog frontmatter.
// If a Markdown file is missing a required field or uses the wrong type,
// `astro build` (and `astro dev`) will fail with a clear, specific error
// pointing at the offending file and field.
const blog = defineCollection({
  type: "content",
  schema: z.object({
    // --- Required ---
    title: z.string().min(3, "title must be at least 3 characters"),
    description: z
      .string()
      .min(20, "description must be at least 20 characters (used for SEO + previews)")
      .max(300, "description should stay under ~300 characters"),
    date: z.coerce.date(),
    author: z.string().default("Ajmal Ali"),
    category: z.string().min(2),
    tags: z.array(z.string()).min(1, "add at least one tag"),
    // Cover images live in /public/images/ and are referenced by root path
    // (e.g. "/images/my-cover.jpg"), matching the rest of the site's asset
    // handling. Pre-size/compress images before adding them (see README).
    cover: z.string().startsWith("/", "cover must be a root-relative path, e.g. /images/foo.jpg"),

    // --- Optional ---
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
    canonicalUrl: z.string().url().optional(),
    seoTitle: z.string().max(70).optional(),
    seoDescription: z.string().max(300).optional(),
    noindex: z.boolean().default(false),
    coverAlt: z.string().optional(),
  }),
});

export const collections = { blog };
