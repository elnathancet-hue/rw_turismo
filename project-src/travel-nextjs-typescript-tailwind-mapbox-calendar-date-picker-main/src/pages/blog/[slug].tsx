import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import MarkdownContent from "../../components/MarkdownContent";
import BlogShareButtons from "../../components/BlogShareButtons";
import NewsletterSignup from "../../components/NewsletterSignup";
import { getPublishedPostBySlug, getPublishedPosts } from "../../lib/content/server";
import type { BlogPost } from "../../lib/content/types";

const BlogPostPage = ({ post, related }: { post: BlogPost; related: BlogPost[] }) => {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const canonical = post.canonical_url || `${base}/blog/${post.slug}`;
  const jsonLd = { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.seo_description || post.excerpt, image: post.og_image || post.cover_image || undefined, datePublished: post.published_at, dateModified: post.updated_at, publisher: { "@type": "Organization", name: "RW Turismo" }, mainEntityOfPage: canonical };
  const breadcrumbLd = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Início", item: base }, { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/blog` }, { "@type": "ListItem", position: 3, name: post.title, item: canonical }] };
  return (
    <>
      <Head>
        <title>{post.seo_title || post.title} | RW Turismo</title>
        <meta name="description" content={post.seo_description || post.excerpt || ""} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" /><meta property="og:title" content={post.seo_title || post.title} /><meta property="og:description" content={post.seo_description || post.excerpt || ""} />
        {(post.og_image || post.cover_image) && <meta property="og:image" content={post.og_image || post.cover_image || ""} />}
        {post.published_at && <meta property="article:published_time" content={post.published_at} />}<meta property="article:modified_time" content={post.updated_at} />
        {post.blog_categories && <meta property="article:section" content={post.blog_categories.name} />}
        {post.tags?.map((tag) => <meta property="article:tag" content={tag.name} key={tag.id} />)}
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      </Head>
      <header className="border-b"><div className="mx-auto flex max-w-5xl justify-between px-6 py-5"><Link className="font-bold text-orange-600" href="/">RW Turismo</Link><Link href="/blog">Blog</Link></div></header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <nav className="text-sm text-gray-500"><Link href="/">Início</Link> / <Link href="/blog">Blog</Link> / {post.title}</nav>
        {post.blog_categories && <Link className="mt-8 inline-flex text-sm font-semibold text-orange-600" href={`/blog/categoria/${post.blog_categories.slug}`}>{post.blog_categories.name}</Link>}
        <h1 className="mt-3 text-4xl font-bold">{post.title}</h1>
        {post.published_at && <time className="mt-4 block text-sm text-gray-500" dateTime={post.published_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(post.published_at))}</time>}
        {post.cover_image && <img alt={post.title} className="mt-8 max-h-[460px] w-full rounded-xl object-cover" src={post.cover_image} />}
        <MarkdownContent className="prose prose-lg mt-10 max-w-none prose-headings:font-semibold prose-a:font-medium prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl" content={post.content} />
        <div className="mt-8 flex flex-wrap gap-2">{post.tags?.map((tag) => <Link className="rounded-full bg-gray-100 px-3 py-1 text-sm" href={`/blog/tag/${tag.slug}`} key={tag.id}>#{tag.name}</Link>)}</div>
        <div className="mt-8 border-t pt-6"><BlogShareButtons url={canonical} title={post.title} /></div>
        <aside className="mt-12 rounded-xl bg-orange-50 p-6"><h2 className="text-xl font-semibold">Pronto para viajar?</h2><p className="mt-2">Conheça os pacotes da RW Turismo.</p><Link className="mt-4 inline-flex font-semibold text-orange-600" href="/#pacotes">Ver pacotes</Link></aside>
        <div className="mt-10"><NewsletterSignup /></div>
        {!!related.length && <section className="mt-12"><h2 className="text-2xl font-semibold">Leia também</h2><div className="mt-4 space-y-3">{related.map((item) => <Link className="block font-semibold text-orange-600" href={`/blog/${item.slug}`} key={item.id}>{item.title}</Link>)}</div></section>}
      </main>
    </>
  );
};
export default BlogPostPage;
export const getServerSideProps = async ({ params }: GetServerSidePropsContext) => {
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  if (!slug) return { notFound: true };
  try {
    const post = await getPublishedPostBySlug(slug);
    if (!post) return { notFound: true };
    const result = await getPublishedPosts({ limit: 4, categorySlug: post.blog_categories?.slug });
    return { props: { post, related: result.posts.filter((item) => item.id !== post.id).slice(0, 3) } };
  } catch { return { notFound: true }; }
};
