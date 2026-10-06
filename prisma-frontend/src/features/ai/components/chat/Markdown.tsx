import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckIcon, CopyIcon } from "../AiIcons";

/**
 * Small, dependency-free and XSS-safe Markdown renderer (no dangerouslySetInnerHTML:
 * everything is React text nodes; links are limited to http(s)/mailto).
 *
 * Supports what LLMs actually emit: headings, paragraphs, bold/italic, `code`,
 * fenced code (with copy), lists, quotes, hr, GFM tables, links and [n] citation markers.
 * Swap for react-markdown + remark-gfm later if you want full CommonMark.
 */

export interface CitationInfo {
  title: string;
  page?: number | null;
}
export type CitationLookup = ReadonlyMap<number, CitationInfo>;

type Align = "left" | "center" | "right" | undefined;
type Block =
  | { t: "code"; lang: string; body: string }
  | { t: "h"; level: number; text: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: string[] }
  | { t: "quote"; text: string }
  | { t: "hr" }
  | { t: "table"; head: string[]; align: Align[]; rows: string[][] };

const FENCE = /^\s*```\s*([\w+#.-]*)\s*$/;
const HEADING = /^(#{1,4})\s+(.*?)\s*#*\s*$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const UL = /^\s*[-*+]\s+(.*)$/;
const OL = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

function startsBlock(line: string, next: string | undefined): boolean {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    UL.test(line) ||
    OL.test(line) ||
    QUOTE.test(line) ||
    (line.includes("|") && next !== undefined && TABLE_SEP.test(next))
  );
}

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const body: string[] = [];
      i += 1;
      // unclosed fence (still streaming) -> everything to the end is code
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ t: "code", lang: fence[1], body: body.join("\n").replace(/\n+$/, "") });
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: "h", level: h[1].length, text: h[2] });
      i += 1;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ t: "hr" });
      i += 1;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = splitRow(line);
      const align: Align[] = splitRow(lines[i + 1]).map((c) =>
        c.startsWith(":") && c.endsWith(":")
          ? "center"
          : c.endsWith(":")
            ? "right"
            : c.startsWith(":")
              ? "left"
              : undefined,
      );
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ t: "table", head, align, rows });
      continue;
    }

    if (QUOTE.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) {
        buf.push(QUOTE.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ t: "quote", text: buf.join("\n") });
      continue;
    }

    const isUl = UL.test(line);
    if (isUl || OL.test(line)) {
      const re = isUl ? UL : OL;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) {
        items.push(re.exec(lines[i])![1]);
        i += 1;
        // lazy continuation lines (indented, not a new item)
        while (
          i < lines.length &&
          lines[i].trim() !== "" &&
          /^\s{2,}\S/.test(lines[i]) &&
          !UL.test(lines[i]) &&
          !OL.test(lines[i])
        ) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        }
      }
      blocks.push({ t: isUl ? "ul" : "ol", items });
      continue;
    }

    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      (buf.length === 0 || !startsBlock(lines[i], lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    blocks.push({ t: "p", text: buf.join("\n") });
  }
  return blocks;
}

/* ───────── inline ───────── */

// 1 code · 2 **bold** · 3 __bold__ · 4 *italic* · 5-7 [text](url) · 8-9 [n] citations
const INLINE =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\s][^*\n]*\*)|(\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\))|(\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\])/g;

interface InlineCtx {
  citations?: CitationLookup;
  onCite?: (n: number) => void;
}

const chip =
  "mx-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-md bg-brand-50 px-1 align-baseline text-[11px] leading-none font-semibold text-brand-600 transition-colors hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:bg-brand-500/15 dark:text-brand-400 dark:hover:bg-brand-500/25";

function renderInline(text: string, ctx: InlineCtx, keyBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${keyBase}-${k++}`;

    if (m[1]) {
      out.push(
        <code
          key={key}
          className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800 dark:bg-white/10 dark:text-white/90"
        >
          {m[1].slice(1, -1)}
        </code>,
      );
    } else if (m[2] || m[3]) {
      out.push(
        <strong key={key} className="font-semibold text-gray-900 dark:text-white">
          {renderInline((m[2] ?? m[3]).slice(2, -2), ctx, key)}
        </strong>,
      );
    } else if (m[4]) {
      out.push(<em key={key}>{renderInline(m[4].slice(1, -1), ctx, key)}</em>);
    } else if (m[5]) {
      out.push(
        <a
          key={key}
          href={m[7]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-brand-600 underline underline-offset-2 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          {m[6]}
        </a>,
      );
    } else if (m[8]) {
      const nums = m[9].split(",").map((x) => Number(x.trim()));
      out.push(
        <Fragment key={key}>
          {nums.map((n) => {
            const info = ctx.citations?.get(n);
            if (!info || !ctx.onCite) return `[${n}]`;
            return (
              <button
                key={n}
                type="button"
                className={chip}
                title={info.title + (info.page ? `, с. ${info.page}` : "")}
                onClick={() => ctx.onCite?.(n)}
              >
                {n}
              </button>
            );
          })}
        </Fragment>,
      );
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Soft line breaks inside a paragraph stay visible (chat style). */
function withBreaks(text: string, ctx: InlineCtx, keyBase: string): ReactNode[] {
  return text.split("\n").flatMap((line, idx, arr) => {
    const nodes = renderInline(line, ctx, `${keyBase}-${idx}`);
    return idx < arr.length - 1 ? [...nodes, <br key={`${keyBase}-br-${idx}`} />] : nodes;
  });
}

/* ───────── blocks ───────── */

function CodeBlock({ lang, body }: { lang: string; body: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable (http / permissions) */
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-black/30">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-1.5 dark:border-white/10">
        <span className="font-mono text-theme-xs text-gray-500 dark:text-gray-400">
          {lang || "text"}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-theme-xs text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:outline-none dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white/90"
        >
          {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          {copied ? t("ai.common.copied", "Скопійовано") : t("ai.common.copy", "Копіювати")}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto p-3 font-mono text-[13px] leading-6 text-gray-800 dark:text-gray-200">
        <code>{body}</code>
      </pre>
    </div>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-5 mb-2 text-title-sm font-semibold",
  2: "mt-4 mb-2 text-theme-xl font-semibold",
  3: "mt-3 mb-1.5 text-theme-sm font-semibold",
  4: "mt-3 mb-1.5 text-theme-sm font-medium",
};

interface MarkdownProps {
  text: string;
  citations?: CitationLookup;
  onCite?: (n: number) => void;
  className?: string;
}

export function Markdown({ text, citations, onCite, className = "" }: MarkdownProps) {
  const ctx: InlineCtx = { citations, onCite };
  const blocks = parseBlocks(text);

  return (
    <div
      className={`min-w-0 text-theme-sm leading-6 wrap-break-word text-gray-700 dark:text-gray-300 ${className}`}
    >
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.t) {
          case "code":
            return <CodeBlock key={key} lang={b.lang} body={b.body} />;
          case "h":
            return (
              <p
                key={key}
                role="heading"
                aria-level={Math.min(b.level + 2, 6)}
                className={`${HEADING_CLASS[b.level]} text-gray-900 dark:text-white`}
              >
                {renderInline(b.text, ctx, key)}
              </p>
            );
          case "hr":
            return <hr key={key} className="my-4 border-gray-200 dark:border-white/10" />;
          case "quote":
            return (
              <blockquote
                key={key}
                className="my-3 border-s-2 border-brand-300 ps-3 text-gray-600 italic dark:border-brand-500/50 dark:text-gray-400"
              >
                {withBreaks(b.text, ctx, key)}
              </blockquote>
            );
          case "ul":
          case "ol": {
            const Tag = b.t;
            return (
              <Tag
                key={key}
                className={`my-2 space-y-1 ps-5 marker:text-gray-400 ${
                  b.t === "ul" ? "list-disc" : "list-decimal"
                }`}
              >
                {b.items.map((it, j) => (
                  <li key={j} className="ps-1">
                    {renderInline(it, ctx, `${key}-${j}`)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <div
                key={key}
                className="my-3 max-w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10"
              >
                <table className="min-w-full text-theme-sm">
                  <thead className="bg-gray-50 dark:bg-white/5">
                    <tr>
                      {b.head.map((c, j) => (
                        <th
                          key={j}
                          scope="col"
                          style={{ textAlign: b.align[j] }}
                          className="px-3 py-2 text-start text-theme-xs font-medium whitespace-nowrap text-gray-600 dark:text-gray-400"
                        >
                          {renderInline(c, ctx, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {b.rows.map((r, ri) => (
                      <tr key={ri}>
                        {b.head.map((_, ci) => (
                          <td
                            key={ci}
                            style={{ textAlign: b.align[ci] }}
                            className="px-3 py-2 align-top"
                          >
                            {renderInline(r[ci] ?? "", ctx, `${key}-${ri}-${ci}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return (
              <p key={key} className="my-2 first:mt-0 last:mb-0">
                {withBreaks(b.text, ctx, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
