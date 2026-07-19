import Link from "next/link";
import { useEffect, useState } from "react";
import { getFooterSettings } from "../lib/content/client";
import { defaultFooter, type FooterSettings } from "../lib/content/footer";

const FooterLinkItem = ({ label, url }: { label: string; url: string }) => {
  if (url.startsWith("/") || url.startsWith("#")) {
    return (
      <Link className="hover:text-orange-600" href={url}>
        {label}
      </Link>
    );
  }
  return (
    <a
      className="hover:text-orange-600"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
};

const Footer = () => {
  const [footer, setFooter] = useState<FooterSettings>(defaultFooter);

  useEffect(() => {
    getFooterSettings()
      .then((data) => {
        if (data?.columns?.length) setFooter(data);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-gray-100 text-gray-600">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-x-6 gap-y-10 px-6 py-14 sm:grid-cols-2 md:grid-cols-4 md:px-10 lg:px-16">
        {footer.columns.map((column, columnIndex) => (
          <div className="space-y-3 text-xs text-gray-800" key={columnIndex}>
            <h5 className="font-bold uppercase">{column.title}</h5>
            {column.links.map((link, linkIndex) => (
              <p key={linkIndex}>
                <FooterLinkItem label={link.label} url={link.url} />
              </p>
            ))}
          </div>
        ))}
      </div>
      {(footer.copyright || footer.cnpj) && (
        <div className="border-t border-gray-200">
          <div className="mx-auto max-w-7xl px-6 py-4 text-xs text-gray-500 md:px-10 lg:px-16">
            {footer.copyright}
            {footer.cnpj ? ` · CNPJ ${footer.cnpj}` : ""}
          </div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
