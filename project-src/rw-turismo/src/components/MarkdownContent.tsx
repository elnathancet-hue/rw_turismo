import Markdown from "markdown-to-jsx";
import Link from "next/link";
import type { ReactNode } from "react";

type MarkdownLinkProps = {
  href?: string;
  title?: string;
  children?: ReactNode;
};

// Internal links use next/link (client nav); external links open safely.
const MarkdownLink = ({ href = "", children }: MarkdownLinkProps) => {
  if (href.startsWith("/") || href.startsWith("#")) {
    return <Link href={href}>{children}</Link>;
  }
  return (
    <a href={href} rel="noopener noreferrer" target="_blank">
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
