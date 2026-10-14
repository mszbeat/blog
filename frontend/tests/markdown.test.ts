import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../src/lib/markdown';

test('all editor formats render consistently, preserving Persian and emoji', () => {
  const html = renderMarkdown('## عنوان\n\n**پررنگ** *مورب* ~~حذف~~ 💡\n\n- یک\n- دو\n\n1. One\n2. Two\n\n> نقل قول\n\n`code`\n\n---');
  for (const tag of ['h3', 'strong', 'em', 's', 'ul', 'ol', 'blockquote', 'code', 'hr']) assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.ok(html.includes('💡'));
});
test('raw HTML and malicious links cannot inject markup or executable URLs', () => {
  for (const text of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](javascript:alert(1))', '[x](data:text/html;base64,PHNjcmlwdD4=)', '[x](https://example.com/"onmouseover="alert(1))']) {
    const html = renderMarkdown(text);
    assert.doesNotMatch(html, /<script|<img|href="(?:javascript:|data:)|<a[^>]*\sonmouseover=/i);
  }
});
test('links have safe attributes; code is literal and tables still work', () => {
  const html = renderMarkdown('[لینک](https://example.com)\n\n```js\n**not bold** <script>\n```\n\n| a | b |\n|---|---|\n| c | d |');
  assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /<pre><code[^>]*>\*\*not bold\*\* &lt;script&gt;/);
  assert.match(html, /<table>/);
});
