import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import BlogCard from "../../../components/blog/BlogCard";
import Footer from "../../../components/Footer";
import { getPublishedPosts } from "../../../lib/content/server";
import type { BlogPost } from "../../../lib/content/types";
const CategoryPage = ({ slug, posts }: { slug: string; posts: BlogPost[] }) => (
  <><Head><title>Artigos sobre {slug.replace(/-/g, " ")} | RW Turismo</title><meta name="robots" content="index,follow" /></Head><main className="mx-auto max-w-6xl px-6 py-12"><Link href="/blog">← Blog</Link><h1 className="mt-6 text-4xl font-bold">Categoria: {slug.replace(/-/g, " ")}</h1><section className="mt-8 grid gap-6 md:grid-cols-3">{posts.map((post) => <BlogCard key={post.id} post={post} />)}</section></main><Footer /></>
);
export default CategoryPage;
export const getServerSideProps = async ({ params }: GetServerSidePropsContext) => { const slug = String(params?.slug || ""); try { const result = await getPublishedPosts({ categorySlug: slug }); if (!result.posts.length) return { notFound: true }; return { props: { slug, posts: result.posts } }; } catch { return { notFound: true }; } };
