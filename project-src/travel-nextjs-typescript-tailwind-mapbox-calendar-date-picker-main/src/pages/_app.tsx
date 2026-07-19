import ProgressBar from "@badrap/bar-of-progress";
import type { AppProps } from "next/app";
import Head from "next/head";
import { Router } from "next/router";
import { useEffect } from "react";
import WhatsAppFloat from "../components/WhatsAppFloat";
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

  return (
    <>
      <Head>
        <link href="/favicon-32.png" rel="icon" type="image/png" sizes="32x32" />
        <link href="/rw-turismo-icon-512.png" rel="icon" type="image/png" sizes="512x512" />
        <link href="/apple-touch-icon.png" rel="apple-touch-icon" />
        <meta content="#1a1aff" name="theme-color" />
      </Head>
      <Component {...pageProps} />
      <WhatsAppFloat />
    </>
  );
};

export default MyApp;
