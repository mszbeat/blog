import MarkdownIt from 'markdown-it';

// Text stays Markdown in the API/database. Never accept raw HTML, embedded
// media or scripts; the editor and published article share exactly this parser.
const parser = new MarkdownIt({ html: false, breaks: true, linkify: false }).disable('image');
const defaultLink = parser.renderer.rules.link_open;
parser.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return defaultLink ? defaultLink(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
};
// The page already owns h1. User headings start at h2 and cannot replace it.
for (const rule of ['heading_open', 'heading_close']) {
  parser.renderer.rules[rule] = (tokens, idx, options, _env, self) => {
    tokens[idx].tag = `h${Math.min(6, Number(tokens[idx].tag.slice(1)) + 1)}`;
    return self.renderToken(tokens, idx, options);
  };
}
export function renderMarkdown(content: string): string {
  return parser.render(content ?? '');
}
