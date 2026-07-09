import ProgressBar from "@badrap/bar-of-progress";
import type { AppProps } from "next/app";
import { Router } from "next/router";
import { useEffect } from "react";
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

  return <Component {...pageProps} />;
};

export default MyApp;
