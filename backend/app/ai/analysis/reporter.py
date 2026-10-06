"""Deterministic report rendering. LLM output is data; formatting is code."""
from __future__ import annotations
from collections import Counter
from .contracts import AnalysisResult

def render_executive_markdown(result: AnalysisResult) -> str:
    counts = Counter(f.severity for f in result.findings)
    total = len(result.analyzed_documents) + len(result.failed_documents)
    lines = [
        "# Analysis Report", "",
        f"**Instruction:** {result.request.instruction}",
        f"**Documents analyzed:** {len(result.analyzed_documents)}",
        f"**Documents failed:** {len(result.failed_documents)}",
        f"**Coverage:** {len(result.analyzed_documents)}/{total or len(result.analyzed_documents)}",
        f"**Selection capped:** {result.metadata.get('selection_capped', False)}",
        f"**Findings:** {len(result.findings)}", "", "## Severity summary", "",
    ]
    for level in ("critical", "high", "medium", "low", "info"):
        lines.append(f"- {level}: {counts.get(level, 0)}")
    lines += ["", "## Findings", ""]
    for i, finding in enumerate(result.findings, 1):
        lines += [f"### {i}. {finding.title} ({finding.severity})", finding.summary]
        if finding.confidence is not None: lines.append(f"Confidence: {finding.confidence:.2f}")
        if finding.tags: lines.append("Tags: " + ", ".join(finding.tags))
        if finding.evidence:
            lines.append("Evidence:")
            lines.extend(f"- {e}" for e in finding.evidence)
        if finding.document_ids: lines.append("Documents: " + ", ".join(str(x) for x in finding.document_ids))
        lines.append("")
    if result.web_sources:
        lines += ["## Web sources", ""]
        lines.extend(f"- {u}" for u in result.web_sources)
    return "\n".join(lines).strip() + "\n"
