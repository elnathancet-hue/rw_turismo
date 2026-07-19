import Link from "next/link";
import type { BlogPost, HomeSection } from "../../lib/content/types";
const LatestBlogPosts = ({ section, posts }: { section: HomeSection; posts: BlogPost[] }) => (
  <section className="py-12">
    <div className="flex items-end justify-between gap-4">
      <div><h2 className="text-3xl font-semibold">{section.title}</h2>{section.subtitle && <p className="mt-2 text-gray-600">{section.subtitle}</p>}</div>
      <Link className="font-semibold text-orange-600" href="/blog">Ver blog</Link>
    </div>
    <div className="mt-6 grid gap-5 md:grid-cols-3">
      {posts.slice(0, Number(section.content?.limit ?? 3)).map((post) => (
        <Link className="overflow-hidden rounded-xl border bg-white" href={`/blog/${post.slug}`} key={post.id}>
          {post.cover_image && <img alt={post.title} className="h-44 w-full object-cover" loading="lazy" src={post.cover_image} />}
          <div className="p-5"><h3 className="text-lg font-semibold">{post.title}</h3>{post.excerpt && <p className="mt-2 line-clamp-3 text-sm text-gray-600">{post.excerpt}</p>}</div>
        </Link>
      ))}
    </div>
  </section>
);
export default LatestBlogPosts;
