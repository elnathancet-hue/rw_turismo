import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import BlogCard from "../../components/blog/BlogCard";
import { getPublicBlogTaxonomy, getPublishedPosts } from "../../lib/content/server";
import type { BlogCategory, BlogPost } from "../../lib/content/types";

type Props = { posts: BlogPost[]; categories: BlogCategory[]; page: number; pages: number };
const BlogIndex = ({ posts, categories, page, pages }: Props) => {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  return (
    <>
      <Head>
        <title>Blog de viagens | RW Turismo</title>
        <meta name="description" content="Dicas, destinos e inspiração para planejar sua próxima viagem." />
        <link rel="canonical" href={`${base}/blog${page > 1 ? `?page=${page}` : ""}`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Blog de viagens | RW Turismo" />
      </Head>
      <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link className="text-xl font-bold text-orange-600" href="/">RW Turismo</Link><Link href="/">Ver pacotes</Link></div></header>
      <main className="mx-auto min-h-[70vh] max-w-7xl px-6 py-12">
        <nav className="text-sm text-gray-500"><Link href="/">Início</Link> / Blog</nav>
        <h1 className="mt-4 text-4xl font-bold">Blog de viagens</h1>
        <p className="mt-3 text-gray-600">Dicas, destinos e inspiração para sua próxima viagem.</p>
        <div className="mt-6 flex flex-wrap gap-2">{categories.map((category) => <Link className="rounded-full border px-4 py-2 text-sm" href={`/blog/categoria/${category.slug}`} key={category.id}>{category.name}</Link>)}</div>
        <section className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{posts.map((post) => <BlogCard key={post.id} post={post} />)}</section>
        {!posts.length && <p className="mt-10 text-gray-500">Nenhum artigo publicado ainda.</p>}
        <nav className="mt-10 flex gap-4">{page > 1 && <Link href={`/blog?page=${page - 1}`}>← Página anterior</Link>}{page < pages && <Link href={`/blog?page=${page + 1}`}>Próxima página →</Link>}</nav>
      </main>
    </>
  );
};
export default BlogIndex;
export const getServerSideProps = async ({ query }: GetServerSidePropsContext) => {
  const page = Math.max(Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1, 1);
  try {
    const [result, taxonomy] = await Promise.all([getPublishedPosts({ page, limit: 9 }), getPublicBlogTaxonomy()]);
    return { props: { posts: result.posts, categories: taxonomy.categories, page, pages: Math.max(Math.ceil(result.count / result.limit), 1) } };
  } catch { return { props: { posts: [], categories: [], page: 1, pages: 1 } }; }
};
