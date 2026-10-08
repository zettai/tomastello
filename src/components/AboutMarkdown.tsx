import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";

const MarkdownAnchor = ({
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) => (
  <a
    {...props}
    className="text-primary dark:text-primary-light hover:text-primary-hover dark:hover:text-primary-lighter"
  >
    {children}
  </a>
);

export default function AboutMarkdown({ content }: { content: string }) {
  return (
    <div className="prose dark:prose-invert max-w-none text-sm">
      <ReactMarkdown components={{ a: MarkdownAnchor }}>{content}</ReactMarkdown>
    </div>
  );
}
