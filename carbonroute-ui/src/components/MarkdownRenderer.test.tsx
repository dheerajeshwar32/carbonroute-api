// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect } from 'vitest';
import { MarkdownRenderer, parseMarkdownBlocks, parseInlineTokens } from './MarkdownRenderer';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

function renderMarkdown(content: string): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(MarkdownRenderer, { content }));
  });
  return container;
}

describe('MarkdownRenderer (XSS-Safe Pure React Parser)', () => {
  it('parses headings, paragraphs, blockquotes, unordered/ordered lists, and fenced code blocks', () => {
    const sample = [
      '# Architecture Overview',
      '## Key Benefits',
      '### Latency Floor',
      '',
      'Routing executes via **low-carbon** regions with *minimal* overhead and `0` leaks.',
      '',
      '> Grid carbon updates every poll cycle.',
      '',
      '- Finland (europe-north1)',
      '- Netherlands (europe-west4)',
      '',
      '1. Filter SLA bounds',
      '2. Normalize simplex weights',
      '',
      '```typescript',
      'const region = "europe-north1";',
      '```',
    ].join('\n');

    const blocks = parseMarkdownBlocks(sample);
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'heading',
      'heading',
      'paragraph',
      'blockquote',
      'list',
      'list',
      'code',
    ]);

    const container = renderMarkdown(sample);
    expect(container.querySelector('h1')?.textContent).toBe('Architecture Overview');
    expect(container.querySelector('h2')?.textContent).toBe('Key Benefits');
    expect(container.querySelector('h3')?.textContent).toBe('Latency Floor');
    expect(container.querySelector('strong')?.textContent).toBe('low-carbon');
    expect(container.querySelector('em')?.textContent).toBe('minimal');
    expect(container.querySelector('.md-inline-code')?.textContent).toBe('0');
    expect(container.querySelector('blockquote p')?.textContent).toBe(
      'Grid carbon updates every poll cycle.'
    );
    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
    expect(container.querySelector('.md-code-lang')?.textContent).toBe('typescript');
    expect(container.querySelector('pre code')?.textContent).toBe('const region = "europe-north1";');
    expect(container.querySelector('.btn-code-copy')).not.toBeNull();

    document.body.removeChild(container);
  });

  it('escapes raw HTML tags and script payloads without dangerous injection', () => {
    const xssPayload = [
      'Hello <script>window.__pwned = true;</script> world.',
      '',
      '- <img src="x" onerror="alert(1)">',
      '',
      'Inline `<svg onload=alert(1)>` token.',
    ].join('\n');

    const container = renderMarkdown(xssPayload);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<script>window.__pwned = true;</script>');
    expect(container.textContent).toContain('<img src="x" onerror="alert(1)">');
    expect(container.textContent).toContain('<svg onload=alert(1)>');

    document.body.removeChild(container);
  });

  it('preserves snake_case identifiers without unintended italic emphasis', () => {
    const tokens = parseInlineTokens('max_latency_ms and carbon_intensity are valid');
    expect(tokens).toEqual([
      { type: 'text', value: 'max_latency_ms and carbon_intensity are valid' },
    ]);
  });
});
