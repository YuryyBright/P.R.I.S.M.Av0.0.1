from typing import Any

from bs4 import BeautifulSoup, Comment, NavigableString, Tag

from app.rag.ingestion.canonical import BlockKind, CanonicalBuilder
from app.rag.ingestion.parsers._text import normalize_lang, parse_datetime
from app.rag.ingestion.parsers.base import BaseParser

_HEADINGS = {f"h{i}": i for i in range(1, 7)}
_SKIP = {"script", "style", "noscript", "template", "svg", "iframe", "nav", "footer",
         "aside", "form", "button", "select", "head", "canvas", "object", "embed"}
_BLOCK = {"p", "div", "section", "article", "main", "header", "ul", "ol", "li", "table",
          "pre", "blockquote", "figure", "figcaption", "dl", "dt", "dd", "details",
          "summary", "address", "hr", *_HEADINGS}
_MAX_DEPTH = 150


class HtmlParser(BaseParser):
    """HTML/веб-сторінка: береться <main>/<article>/<body>, службові теги
    (nav, footer, script...) відкидаються, структура → блоки."""

    name = "html"
    extensions = (".html", ".htm", ".xhtml")
    mime_types = ("text/html", "application/xhtml+xml")

    def _parse(self, data, ctx, builder) -> dict[str, Any]:
        try:
            soup = BeautifulSoup(data, "lxml")
        except Exception:
            soup = BeautifulSoup(data, "html.parser")

        root = soup.find("main") or soup.find("article") or soup.body or soup
        _Walker(builder).walk(root, BlockKind.PARAGRAPH, 0)

        title = None
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        title = _meta(soup, "og:title") or title or builder.first_heading(1)

        canonical = soup.find("link", rel="canonical")
        html_tag = soup.find("html")
        return {
            "title": title,
            "author": _meta(soup, "author", "article:author"),
            "published_at": parse_datetime(_meta(
                soup, "article:published_time", "date", "pubdate", "publishdate", "dc.date")),
            "language": normalize_lang(html_tag.get("lang") if html_tag else None),
            "url": canonical.get("href") if canonical else None,
            "metadata": {"site_name": _meta(soup, "og:site_name")},
        }


def _meta(soup: BeautifulSoup, *names: str) -> str | None:
    for n in names:
        tag = soup.find("meta", attrs={"name": n}) or soup.find("meta", attrs={"property": n})
        if tag and tag.get("content"):
            return str(tag["content"]).strip() or None
    return None


class _Walker:
    def __init__(self, builder: CanonicalBuilder) -> None:
        self.b = builder

    def walk(self, node: Tag, kind: BlockKind, depth: int) -> None:
        if depth > _MAX_DEPTH:
            return
        buf: list[str] = []

        def flush() -> None:
            if buf:
                self.b.add(kind, "".join(buf))
                buf.clear()

        for child in node.children:
            if isinstance(child, Comment):
                continue
            if isinstance(child, NavigableString):
                buf.append(str(child))
                continue
            if not isinstance(child, Tag):
                continue
            name = child.name
            if name in _SKIP:
                continue
            if name == "br":
                buf.append(" ")
                continue
            if name not in _BLOCK:            # inline: a, span, b, em ...
                buf.append(child.get_text())  # без роздільника: «слово<b>а</b>.» лишається цілим
                continue
            flush()
            if name in _HEADINGS:
                self.b.add(BlockKind.HEADING, child.get_text(), level=_HEADINGS[name])
            elif name == "pre":
                self.b.add(BlockKind.CODE, child.get_text())
            elif name == "table":
                self.b.add(BlockKind.TABLE, _table_text(child))
            elif name == "li":
                self.walk(child, BlockKind.LIST_ITEM, depth + 1)
            elif name == "hr":
                continue
            else:                              # p, div, section, ul, blockquote ...
                self.walk(child, BlockKind.PARAGRAPH if name != "ul" and name != "ol" else kind,
                          depth + 1)
        flush()


def _table_text(table: Tag) -> str:
    rows = []
    for tr in table.find_all("tr"):
        cells = [c.get_text(" ").strip() for c in tr.find_all(["th", "td"])]
        if any(cells):
            rows.append(" | ".join(cells))
    return "\n".join(rows)
