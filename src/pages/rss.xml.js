import rss from "@astrojs/rss";
import { getPublishedPosts } from "../utils/posts";

export async function GET(context) {
  const posts = await getPublishedPosts();
  return rss({
    title: "Embedded & Circuits",
    description: "Arduino, ESP32, sensors, and embedded-systems tutorials.",
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${post.slug}/`,
      categories: [post.data.category, ...post.data.tags],
      author: post.data.author,
    })),
    customData: `<language>en-us</language>`,
  });
}
