import { Fragment, useEffect, useRef, useState } from 'react';
import { Check, Copy } from './Icons';

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string };

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'code'; language: string; code: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; lines: string[] }
  | { type: 'paragraph'; text: string };

/**
 * Tokenizes inline markdown constructs (`code`, **bold**, *italic*) safely
 * into typed AST nodes without HTML string interpolation.
 */
export function parseInlineTokens(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(`[^`\n]+`|\*\*[^*\n]+?\*\*|__[^_\n]+?__|\*[^*\n]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: input.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('`') && raw.endsWith('`')) {
      tokens.push({ type: 'code', value: raw.slice(1, -1) });
    } else if (
      (raw.startsWith('**') && raw.endsWith('**')) ||
      (raw.startsWith('__') && raw.endsWith('__'))
    ) {
      tokens.push({ type: 'bold', value: raw.slice(2, -2) });
    } else if (raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ type: 'italic', value: raw.slice(1, -1) });
    } else {
      tokens.push({ type: 'text', value: raw });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: 'text', value: input.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Parses block-level markdown into an explicit AST:
 * fenced code blocks, headings (#..###), ul/ol lists, blockquotes, and paragraphs.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return [];
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Fenced code block ```lang
    const fenceMatch = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || 'text';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ type: 'code', language, code: codeLines.join('\n') });
      continue;
    }

    // ATX Headings (# .. ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({ type: 'heading', level, text: headingMatch[2].trim() });
      i++;
      continue;
    }

    // Blockquote (> ...)
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    // Unordered list (- item or * item)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list (1. item)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph (coalesce contiguous non-block lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*```/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n') });
  }

  return blocks;
}

function renderInline(text: string) {
  const tokens = parseInlineTokens(text);
  return tokens.map((tok, idx) => {
    if (tok.type === 'code') {
      return (
        <code key={idx} className="md-inline-code mono-tabular">
          {tok.value}
        </code>
      );
    }
    if (tok.type === 'bold') {
      return <strong key={idx}>{tok.value}</strong>;
    }
    if (tok.type === 'italic') {
      return <em key={idx}>{tok.value}</em>;
    }
    return <Fragment key={idx}>{tok.value}</Fragment>;
  });
}

function CopyCodeButton({ code, language }: { code: string; language: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setStatus('idle');
      timerRef.current = null;
    }, 2000);
  };

  return (
    <span className="copy-control-wrap">
      <button
        type="button"
        onClick={handleCopy}
        className="btn-code-copy"
        aria-label={`Copy ${language} code block`}
      >
        {status === 'copied' ? <Check size={12} className="accent-mint" /> : <Copy size={12} />}
        <span>{status === 'copied' ? 'Copied' : status === 'failed' ? 'Failed' : 'Copy'}</span>
      </button>
      <span className="visually-hidden" role="status">
        {status === 'copied' ? 'Code copied' : status === 'failed' ? 'Copy failed' : ''}
      </span>
    </span>
  );
}

export interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = parseMarkdownBlocks(content);

  return (
    <article className="md-prose">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <div key={idx} className="md-code-block">
              <div className="md-code-header">
                <span className="md-code-lang mono-tabular">{block.language}</span>
                <CopyCodeButton code={block.code} language={block.language} />
              </div>
              <pre className="md-code-pre mono-tabular">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'heading') {
          if (block.level === 1) {
            return (
              <h1 key={idx} className="md-h1">
                {renderInline(block.text)}
              </h1>
            );
          }
          if (block.level === 2) {
            return (
              <h2 key={idx} className="md-h2">
                {renderInline(block.text)}
              </h2>
            );
          }
          return (
            <h3 key={idx} className="md-h3">
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <blockquote key={idx} className="md-blockquote">
              {block.lines.map((line, lIdx) => (
                <p key={lIdx}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }

        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag key={idx} className={block.ordered ? 'md-ol' : 'md-ul'}>
              {block.items.map((item, itemIdx) => (
                <li key={itemIdx}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={idx} className="md-paragraph">
            {renderInline(block.text)}
          </p>
        );
      })}
    </article>
  );
}
