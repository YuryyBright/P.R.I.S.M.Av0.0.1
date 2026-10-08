from typing import Any

from app.rag.ingestion.canonical import BlockKind, CanonicalBuilder
from app.rag.ingestion.parsers._text import decode_text, split_paragraphs
from app.rag.ingestion.parsers.base import BaseParser, ParseContext


class TextParser(BaseParser):
    name = "txt"
    extensions = (".txt", ".text", ".log")
    mime_types = ("text/plain",)

    def _parse(self, data: bytes, ctx: ParseContext, builder: CanonicalBuilder) -> dict[str, Any]:
        text, encoding = decode_text(data)
        for para in split_paragraphs(text):
            builder.add(BlockKind.PARAGRAPH, para)
        return {"metadata": {"encoding": encoding}}
