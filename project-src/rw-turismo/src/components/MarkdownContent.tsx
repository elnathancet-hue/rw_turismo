import Markdown from "markdown-to-jsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { eLinkInterno, hrefSeguro } from "../lib/security/url";

type MarkdownLinkProps = {
  href?: string;
  title?: string;
  children?: ReactNode;
};

// Internal links use next/link (client nav); external links open safely.
//
// O sanitizer do markdown-to-jsx cobre link inline — `[x](javascript:...)` vira
// href vazio — mas NÃO cobre link de referência (`[x][a]` + `[a]: javascript:`)
// nem autolink (`<javascript:...>`). Nesses dois o esquema chega inteiro aqui, e
// o React 18 renderiza `javascript:` em href com um aviso no console.
//
// Por isso a checagem é refeita neste componente: é o ponto por onde todo link
// de markdown passa, venha ele de qual sintaxe for.
const MarkdownLink = ({ href = "", children }: MarkdownLinkProps) => {
  const seguro = hrefSeguro(href);
  if (!seguro) return <>{children}</>;

  if (eLinkInterno(href)) {
    return <Link href={seguro}>{children}</Link>;
  }
  return (
    <a href={seguro} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
};

// A single newline becomes a line break; blank lines still start new paragraphs.
const withLineBreaks = (text: string) => text.replace(/\n(?!\n)/g, "  \n");

const MarkdownContent = ({
  content,
  className,
}: {
  content: string | null | undefined;
  className?: string;
}) => (
  <div className={className}>
    <Markdown
      options={{
        disableParsingRawHTML: true,
        forceBlock: true,
        overrides: { a: { component: MarkdownLink } },
      }}
    >
      {withLineBreaks(content ?? "")}
    </Markdown>
  </div>
);

export default MarkdownContent;
