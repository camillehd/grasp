"""Extract concept nodes from parsed paper content."""
from __future__ import annotations
import json
import os
import anthropic
from agents.ingestion import PaperContent
from graph.schema import Node, NodeType

CLIENT = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = os.environ.get("GRASP_MODEL", "claude-sonnet-4-6")

SYSTEM = """You are an expert at reading academic papers and identifying the key concepts
a reader must understand. You extract concepts as structured JSON — accurately and with rich,
accessible descriptions that anyone can follow.

Node types:
- core_contribution: the paper's primary novel claim, method, or result
- method: a specific technique, algorithm, or architecture used or proposed
- theory: a theoretical framework or mathematical concept (e.g. attention, KL divergence)
- dataset: a dataset referenced or introduced
- metric: an evaluation metric used
- external_prerequisite: background knowledge the paper assumes but doesn't define
  (e.g. transformer architecture, gradient descent, BPE tokenization)

Rules:
- Extract 8–20 nodes. Quality over quantity.
- source_quote must be a verbatim sentence from the paper text (or null for external prerequisites).
- is_external = true only for external_prerequisite nodes.
- depth: 0 for core_contribution, 1 for direct methods/datasets, 2+ for theoretical
  foundations and external prerequisites. Deeper = more foundational.
- description: Write 3–5 sentences in plain English. Assume the reader is smart but not an expert.
  Explain what the concept IS, why it matters in this paper, and give a concrete analogy or example
  where it helps. Avoid jargon without explanation. This description is what users will read first,
  so make it genuinely illuminating.
"""

TOOL = {
    "name": "save_nodes",
    "description": "Save the extracted concept nodes.",
    "input_schema": {
        "type": "object",
        "properties": {
            "nodes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string"},
                        "type": {"type": "string", "enum": [
                            "core_contribution", "method", "theory",
                            "dataset", "metric", "external_prerequisite"
                        ]},
                        "description": {"type": "string"},
                        "source_quote": {"type": ["string", "null"]},
                        "depth": {"type": "integer"},
                        "is_external": {"type": "boolean"},
                    },
                    "required": ["label", "type", "description", "depth", "is_external"],
                },
            }
        },
        "required": ["nodes"],
    },
}


def extract_concepts(paper: PaperContent) -> list[Node]:
    # Feed abstract + first 3 sections + section headings for context
    section_headings = "\n".join(f"- {s['heading']}" for s in paper.sections[:15])
    body_sample = "\n\n".join(
        f"## {s['heading']}\n{s['text'][:1200]}" for s in paper.sections[:5]
    )

    prompt = f"""Title: {paper.title}

Abstract:
{paper.abstract}

Section headings:
{section_headings}

Paper body (sample):
{body_sample}

Extract the key concept nodes from this paper."""

    response = CLIENT.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "save_nodes"},
        messages=[{"role": "user", "content": prompt}],
    )

    raw_nodes = _parse_tool_response(response)
    return [
        Node(
            label=n["label"],
            type=n["type"],
            description=n["description"],
            source_quote=n.get("source_quote"),
            depth=n.get("depth", 1),
            is_external=n.get("is_external", False),
        )
        for n in raw_nodes
    ]


def _parse_tool_response(response) -> list[dict]:
    for block in response.content:
        if block.type == "tool_use" and block.name == "save_nodes":
            return block.input.get("nodes", [])
    return []
