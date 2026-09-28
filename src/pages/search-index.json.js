import { getPublishedPosts } from "../utils/posts";

export async function GET() {
  const posts = await getPublishedPosts();
  const index = posts.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    category: post.data.category,
    tags: post.data.tags,
    slug: post.slug,
    date: post.data.date.toISOString(),
  }));
  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json" },
  });
}
