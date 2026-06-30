"""Map prerequisite edges between concept nodes."""
from __future__ import annotations
import os
import anthropic
from agents.ingestion import PaperContent
from graph.schema import Node, Edge

CLIENT = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = os.environ.get("GRASP_MODEL", "claude-sonnet-4-6")

SYSTEM = """You are an expert at identifying conceptual dependencies in academic papers.

Given a list of concept nodes extracted from a paper, you determine which concepts
are prerequisites for understanding other concepts — then output directed edges.

An edge (source → target) means: "to understand SOURCE, you must first understand TARGET."

Rules:
- Only add edges where the dependency is real and meaningful — not just vaguely related.
- weight (0.0–1.0): how essential the prerequisite is. 1.0 = cannot understand source without target.
- Every core_contribution should have at least one incoming edge (its direct method prerequisites).
- External prerequisites chain upward: a method may depend on a theory, which depends on an external concept.
- Avoid creating cycles.
- Aim for 10–30 edges for a typical paper.
"""

TOOL = {
    "name": "save_edges",
    "description": "Save the dependency edges between nodes.",
    "input_schema": {
        "type": "object",
        "properties": {
            "edges": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "source_label": {"type": "string"},
                        "target_label": {"type": "string"},
                        "weight": {"type": "number"},
                        "rationale": {"type": "string"},
                    },
                    "required": ["source_label", "target_label", "weight", "rationale"],
                },
            }
        },
        "required": ["edges"],
    },
}


def map_dependencies(paper: PaperContent, nodes: list[Node]) -> list[Edge]:
    node_list = "\n".join(
        f"- [{n.id}] {n.label} ({n.type}, depth={n.depth}): {n.description[:120]}"
        for n in nodes
    )
    label_to_id = {n.label: n.id for n in nodes}

    prompt = f"""Title: {paper.title}

Abstract:
{paper.abstract}

Concept nodes (id + label + type + depth + description):
{node_list}

Map the prerequisite dependencies between these nodes.
Use node labels (exactly as shown) for source_label and target_label."""

    response = CLIENT.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "save_edges"},
        messages=[{"role": "user", "content": prompt}],
    )

    raw_edges = _parse_tool_response(response)
    edges: list[Edge] = []
    for e in raw_edges:
        src_label = e["source_label"]
        tgt_label = e["target_label"]
        if src_label in label_to_id and tgt_label in label_to_id:
            src_id = label_to_id[src_label]
            tgt_id = label_to_id[tgt_label]
            if src_id != tgt_id:
                edges.append(Edge(
                    source=src_id,
                    target=tgt_id,
                    weight=float(e.get("weight", 1.0)),
                    rationale=e.get("rationale", ""),
                ))
    return edges


def _parse_tool_response(response) -> list[dict]:
    for block in response.content:
        if block.type == "tool_use" and block.name == "save_edges":
            return block.input.get("edges", [])
    return []
