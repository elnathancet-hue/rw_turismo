import Link from "next/link";
import type { BlogPost } from "../../lib/content/types";
const BlogCard = ({ post }: { post: BlogPost }) => (
  <article className="overflow-hidden rounded-xl border bg-white shadow-sm">
    {post.cover_image && <img alt={post.title} className="h-52 w-full object-cover" loading="lazy" src={post.cover_image} />}
    <div className="p-5">
      {post.blog_categories && <Link className="text-sm font-semibold text-orange-600" href={`/blog/categoria/${post.blog_categories.slug}`}>{post.blog_categories.name}</Link>}
      <h2 className="mt-2 text-xl font-semibold"><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
      {post.excerpt && <p className="mt-2 text-sm text-gray-600">{post.excerpt}</p>}
      <Link className="mt-4 inline-flex font-semibold text-orange-600" href={`/blog/${post.slug}`}>Ler artigo</Link>
    </div>
  </article>
);
export default BlogCard;
