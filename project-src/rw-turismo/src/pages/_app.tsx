import ProgressBar from "@badrap/bar-of-progress";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Router } from "next/router";
import Script from "next/script";
import { useEffect } from "react";
import WhatsAppFloat from "../components/WhatsAppFloat";
import { GA_ID, pageview } from "../lib/analytics/gtag";
import { captureUtmFromUrl } from "../lib/utm";
import "../styles/globals.css";

const progress = new ProgressBar({
  size: 4,
  color: "orange",
  className: "z-50",
  delay: 80,
});

Router.events.on("routeChangeStart", progress.start);
Router.events.on("routeChangeComplete", progress.finish);
Router.events.on("routeChangeError", progress.finish);

const MyApp = ({ Component, pageProps }: AppProps) => {
  // Guarda a UTM da campanha (primeiro toque) para o CRM.
  useEffect(() => {
    captureUtmFromUrl();
  }, []);

  // GA4: pageview a cada troca de rota (SPA).
  useEffect(() => {
    const handleRouteChange = (url: string) => pageview(url);
    Router.events.on("routeChangeComplete", handleRouteChange);
    return () => Router.events.off("routeChangeComplete", handleRouteChange);
  }, []);

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { page_location: location.origin + location.pathname });`}
          </Script>
        </>
      )}
      {/* As `key` deixam uma página sobrescrever estes itens em vez de duplicar:
          o quiz de captação troca o favicon da marca por um ícone neutro. */}
      <Head>
        <link href="/favicon-32.png" key="icon-32" rel="icon" type="image/png" sizes="32x32" />
        <link href="/rw-turismo-icon-512.png" key="icon-512" rel="icon" type="image/png" sizes="512x512" />
        <link href="/apple-touch-icon.png" key="apple-icon" rel="apple-touch-icon" />
        <meta content="#1a1aff" key="theme-color" name="theme-color" />
      </Head>
      <Component {...pageProps} />
      <WhatsAppFloat />
    </>
  );
};

export default MyApp;
