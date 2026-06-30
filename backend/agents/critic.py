"""Critic agent: validate the graph and prune spurious or hallucinated edges."""
from __future__ import annotations
import os
import anthropic
from agents.ingestion import PaperContent
from graph.schema import Node, Edge, KnowledgeGraph

CLIENT = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = os.environ.get("GRASP_MODEL", "claude-sonnet-4-6")

SYSTEM = """You are a rigorous critic reviewing a knowledge graph extracted from an academic paper.

Your job is to validate each dependency edge and flag any that are:
1. Spurious — the claimed prerequisite relationship is not real or is too weak to be useful.
2. Backwards — the direction is reversed (source and target should be swapped).
3. Redundant — already captured by a transitive path through other edges.

For each edge you review, output one of:
- "keep" — the edge is accurate and useful
- "remove" — the edge should be deleted (give a reason)
- "swap" — the edge direction should be reversed

Be conservative: only remove edges you are confident are wrong. When in doubt, keep.
"""

TOOL = {
    "name": "review_edges",
    "description": "Return verdicts on each edge.",
    "input_schema": {
        "type": "object",
        "properties": {
            "verdicts": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "edge_id": {"type": "string"},
                        "verdict": {"type": "string", "enum": ["keep", "remove", "swap"]},
                        "reason": {"type": "string"},
                    },
                    "required": ["edge_id", "verdict"],
                },
            }
        },
        "required": ["verdicts"],
    },
}


def validate_graph(paper: PaperContent, nodes: list[Node], edges: list[Edge]) -> list[Edge]:
    """Return a cleaned edge list after critic review."""
    if not edges:
        return edges

    node_map = {n.id: n for n in nodes}
    edge_descriptions = "\n".join(
        f"[{e.id}] {node_map.get(e.source, type('', (), {'label': e.source})()).label} "  # type: ignore[attr-defined]
        f"→ {node_map.get(e.target, type('', (), {'label': e.target})()).label} "  # type: ignore[attr-defined]
        f"(weight={e.weight:.2f}): {e.rationale}"
        for e in edges
        if e.source in node_map and e.target in node_map
    )

    node_descriptions = "\n".join(
        f"[{n.id}] {n.label} ({n.type}): {n.description[:100]}"
        for n in nodes
    )

    prompt = f"""Title: {paper.title}

Abstract:
{paper.abstract[:600]}

Nodes:
{node_descriptions}

Edges to review (format: [id] source → target (weight): rationale):
{edge_descriptions}

Review each edge and return keep/remove/swap verdicts."""

    response = CLIENT.messages.create(
        model=MODEL,
        max_tokens=2048,
        system=SYSTEM,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "review_edges"},
        messages=[{"role": "user", "content": prompt}],
    )

    verdicts: dict[str, str] = {}
    for block in response.content:
        if block.type == "tool_use" and block.name == "review_edges":
            for v in block.input.get("verdicts", []):
                verdicts[v["edge_id"]] = v["verdict"]

    cleaned: list[Edge] = []
    for edge in edges:
        verdict = verdicts.get(edge.id, "keep")
        if verdict == "remove":
            continue
        elif verdict == "swap":
            edge = edge.model_copy(update={"source": edge.target, "target": edge.source})
        cleaned.append(edge)

    return cleaned
