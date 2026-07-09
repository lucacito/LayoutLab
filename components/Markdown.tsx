import { marked } from 'marked';

// Renders TRUSTED markdown (authored in-repo or by our own pipeline into our
// DB) as styled HTML. Never feed user-submitted content through this — marked
// output is injected unsanitized by design.
export function Markdown({ content, className = '' }: { content: string; className?: string }) {
  const html = marked.parse(content, { async: false });
  return <div className={`prose-divi ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
