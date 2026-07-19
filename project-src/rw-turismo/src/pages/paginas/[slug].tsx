import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Drawer from "../../components/Drawer";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import MarkdownContent from "../../components/MarkdownContent";
import PageBlocks from "../../components/PageBlocks";
import { getPublishedPageBySlug } from "../../lib/content/server";
import type { Page } from "../../lib/content/types";

// HTML colado, isolado num iframe (o CSS/JS da landing não conflita com o do
// site) com altura ajustada ao conteúdo.
const HtmlEmbed = ({ html, title }: { html: string; title: string }) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    const measure = () => {
      const doc = frameRef.current?.contentDocument;
      if (!doc) return;
      const next = Math.max(
        doc.documentElement?.scrollHeight ?? 0,
        doc.body?.scrollHeight ?? 0
      );
      if (next > 0) setHeight(next);
    };
    // Imagens/fonts/scripts mudam a altura depois do load — mede de novo.
    const timers = [500, 1500, 3000].map((ms) => setTimeout(measure, ms));
    window.addEventListener("resize", measure);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", measure);
    };
  }, [html]);

  return (
    <iframe
      className="block w-full border-0"
      onLoad={() => {
        const doc = frameRef.current?.contentDocument;
        if (!doc) return;
        const next = Math.max(
          doc.documentElement?.scrollHeight ?? 0,
          doc.body?.scrollHeight ?? 0
        );
        if (next > 0) setHeight(next);
      }}
      ref={frameRef}
      srcDoc={html}
      style={{ height }}
      title={title}
    />
  );
};

const PagePage = ({ page }: { page?: Page | null }) => {
  // Estado do menu completo do site (hooks antes de qualquer return).
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");

  if (!page) return null; // HTML puro já foi servido pelo servidor
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  const headerStyle = page.header_style ?? "simple";
  const showFooter = page.show_footer ?? true;

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
      {headerStyle === "site" ? (
        <Header
          isOpen={isMenuOpen}
          searchInput={headerSearch}
          setIsOpen={setIsMenuOpen}
          setSearchInput={setHeaderSearch}
        />
      ) : headerStyle === "simple" ? (
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
      ) : null}
      {page.custom_html ? (
        // Modo HTML com menu/rodapé: landing isolada em iframe.
        <main className="min-h-[60vh]">
          <HtmlEmbed html={page.custom_html} title={page.title} />
        </main>
      ) : (
        <main className="mx-auto min-h-[60vh] max-w-3xl px-6 py-12">
          <h1 className="text-4xl font-bold">{page.title}</h1>
          <div className="mt-8">
            {page.blocks && page.blocks.length > 0 ? (
              <PageBlocks blocks={page.blocks} />
            ) : (
              <MarkdownContent
                className="prose prose-lg max-w-none prose-headings:font-semibold prose-a:font-medium prose-a:text-orange-600"
                content={page.content}
              />
            )}
          </div>
        </main>
      )}
      {showFooter && <Footer />}
      {headerStyle === "site" && (
        <Drawer isOpen={isMenuOpen} setIsOpen={setIsMenuOpen}>
          <p className="drawer-item">
            <Link href={"/favorites"}>Meus favoritos</Link>
          </p>
          <p className="drawer-item">
            <Link href={"/account/bookings"}>Minhas reservas</Link>
          </p>
        </Drawer>
      )}
    </>
  );
};

export default PagePage;

export const getServerSideProps = async ({
  params,
  res,
}: GetServerSidePropsContext) => {
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  if (!slug) return { notFound: true };

  try {
    const page = await getPublishedPageBySlug(slug);
    if (!page) return { notFound: true };

    // Modo HTML sem menu/rodapé: serve o HTML colado EXATAMENTE como está
    // (mesma técnica do robots.txt) — reprodução perfeita, scripts e pixels
    // rodando, zero interferência do site.
    if (page.custom_html && !page.custom_html_chrome) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.write(page.custom_html);
      res.end();
      return { props: {} };
    }

    return { props: { page } };
  } catch {
    return { notFound: true };
  }
};
