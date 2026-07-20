import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import BlogCard from "../../../components/blog/BlogCard";
import Footer from "../../../components/Footer";
import { getPublishedPosts } from "../../../lib/content/server";
import type { BlogPost } from "../../../lib/content/types";
const TagPage = ({ slug, posts }: { slug: string; posts: BlogPost[] }) => (
  <><Head><title>Artigos com {slug.replace(/-/g, " ")} | RW Turismo</title></Head><main className="mx-auto max-w-6xl px-6 py-12"><Link href="/blog">← Blog</Link><h1 className="mt-6 text-4xl font-bold">Tag: {slug.replace(/-/g, " ")}</h1><section className="mt-8 grid gap-6 md:grid-cols-3">{posts.map((post) => <BlogCard key={post.id} post={post} />)}</section></main><Footer /></>
);
export default TagPage;
export const getServerSideProps = async ({ params }: GetServerSidePropsContext) => { const slug = String(params?.slug || ""); try { const result = await getPublishedPosts({ tagSlug: slug }); if (!result.posts.length) return { notFound: true }; return { props: { slug, posts: result.posts } }; } catch { return { notFound: true }; } };
