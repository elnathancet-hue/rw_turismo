import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import Footer from "../../components/Footer";
import MarkdownContent from "../../components/MarkdownContent";
import { getPublishedPageBySlug } from "../../lib/content/server";
import type { Page } from "../../lib/content/types";

const PagePage = ({ page }: { page: Page }) => {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";

  return (
    <>
      <Head>
        <title>{page.seo_title || page.title} | RW Turismo</title>
        {page.seo_description && (
          <meta content={page.seo_description} name="description" />
        )}
        <link href={`${base}/paginas/${page.slug}`} rel="canonical" />
        <meta content={page.seo_title || page.title} property="og:title" />
        {page.seo_description && (
          <meta content={page.seo_description} property="og:description" />
        )}
      </Head>
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl justify-between px-6 py-5">
          <Link className="font-bold text-orange-600" href="/">
            RW Turismo
          </Link>
          <Link className="font-semibold text-orange-600" href="/#pacotes">
            Ver pacotes
          </Link>
        </div>
      </header>
      <main className="mx-auto min-h-[60vh] max-w-3xl px-6 py-12">
        <h1 className="text-4xl font-bold">{page.title}</h1>
        <MarkdownContent
          className="prose prose-lg mt-8 max-w-none prose-headings:font-semibold prose-a:font-medium prose-a:text-orange-600"
          content={page.content}
        />
      </main>
      <Footer />
    </>
  );
};

export default PagePage;

export const getServerSideProps = async ({
  params,
}: GetServerSidePropsContext) => {
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  if (!slug) return { notFound: true };

  try {
    const page = await getPublishedPageBySlug(slug);
    if (!page) return { notFound: true };
    return { props: { page } };
  } catch {
    return { notFound: true };
  }
};
