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

// Script de medição injetado DENTRO do HTML colado.
//
// Com `sandbox` sem `allow-same-origin`, o iframe passa a ter origem opaca — é
// justamente isso que tira dele o acesso a cookie e localStorage do site. O
// preço é que o pai também não enxerga mais o `contentDocument`, que era como a
// altura era medida. A medida passa a vir de dentro, por postMessage.
const MEDIDOR = `<script>(function(){
  var ultima = 0;
  function medir(){
    var h = Math.max(
      document.documentElement ? document.documentElement.scrollHeight : 0,
      document.body ? document.body.scrollHeight : 0
    );
    if (h > 0 && h !== ultima) {
      ultima = h;
      parent.postMessage({ tipo: "rw-altura", altura: h }, "*");
    }
  }
  window.addEventListener("load", medir);
  window.addEventListener("resize", medir);
  [100, 500, 1500, 3000].forEach(function(ms){ setTimeout(medir, ms); });
  if (window.ResizeObserver && document.body) {
    new ResizeObserver(medir).observe(document.body);
  }
})();<\/script>`;

// HTML colado, isolado num iframe com origem própria.
//
// O `sandbox` NÃO é detalhe de estilo: sem ele, `srcdoc` herda a origem do pai,
// e o "isolamento" que este componente promete não existe — script na landing
// leria a sessão de quem estivesse visitando o site, inclusive a de um admin.
// `allow-scripts` mantém pixels e scripts da landing funcionando; a ausência de
// `allow-same-origin` é o que corta o acesso à origem do site.
const HtmlEmbed = ({ html, title }: { html: string; title: string }) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(800);

  useEffect(() => {
    const aoReceber = (evento: MessageEvent) => {
      // Só mensagens deste iframe. Sem esta checagem, qualquer aba ou script de
      // terceiro poderia redimensionar o quadro.
      if (evento.source !== frameRef.current?.contentWindow) return;
      const dado = evento.data as { tipo?: string; altura?: unknown };
      if (dado?.tipo !== "rw-altura") return;
      const altura = Number(dado.altura);
      if (Number.isFinite(altura) && altura > 0) setHeight(altura);
    };

    window.addEventListener("message", aoReceber);
    return () => window.removeEventListener("message", aoReceber);
  }, [html]);

  return (
    <iframe
      className="block w-full border-0"
      ref={frameRef}
      sandbox="allow-scripts allow-forms allow-popups"
      srcDoc={`${html}${MEDIDOR}`}
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
    //
    // ATENÇÃO — RISCO RESIDUAL CONHECIDO. Isto é um documento de topo servido na
    // ORIGEM DO SITE: não há iframe para isolar, e portanto script daqui alcança
    // cookie e localStorage de quem visitar. Depois da auditoria de 2026-08-30 a
    // escrita de custom_html passou a exigir admin (trigger
    // pages_protect_custom_html), então isto deixou de ser escalonamento de
    // privilégio — mas continua sendo "admin cola um template de terceiro e o
    // template roda com poder total no domínio".
    //
    // O conserto de verdade é servir este modo de um domínio separado. É decisão
    // de infraestrutura, não de código, e por isso não foi feita aqui. Aplicar
    // `CSP: sandbox` daria isolamento, mas quebraria landings que usam
    // localStorage — o que seria uma regressão silenciosa em página publicada.
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
