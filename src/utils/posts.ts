import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;

/** Returns every non-draft post. In production, drafts are always excluded;
 *  in dev, pass includeDrafts=true (used by the /drafts preview route) so
 *  you can preview unpublished posts without ever shipping them to prod. */
export async function getPublishedPosts(includeDrafts = false): Promise<Post[]> {
  const posts = await getCollection("blog", ({ data }) => {
    if (import.meta.env.PROD && data.draft) return false;
    if (!includeDrafts && data.draft) return false;
    return true;
  });
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function readingTime(text: string): string {
  const wordsPerMinute = 200;
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / wordsPerMinute));
  return `${minutes} min read`;
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function getRelatedPosts(current: Post, all: Post[], max = 3): Post[] {
  const others = all.filter((p) => p.slug !== current.slug);
  const scored = others.map((p) => {
    let score = 0;
    if (p.data.category === current.data.category) score += 2;
    const sharedTags = p.data.tags.filter((t) => current.data.tags.includes(t));
    score += sharedTags.length;
    return { post: p, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((s) => s.post);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getAllCategories(posts: Post[]): string[] {
  return [...new Set(posts.map((p) => p.data.category))].sort();
}

export function getAllTags(posts: Post[]): string[] {
  return [...new Set(posts.flatMap((p) => p.data.tags))].sort();
}
