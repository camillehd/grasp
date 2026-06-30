"""Generate a narrative learning path from the knowledge graph."""
from __future__ import annotations
import os
import anthropic
from graph.schema import KnowledgeGraph

CLIENT = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = os.environ.get("GRASP_MODEL", "claude-sonnet-4-6")

SYSTEM = """You are a gifted science communicator. Given an academic paper's knowledge graph,
you write a narrative learning guide — a structured story that walks a curious non-expert
through everything they need to understand the paper, from the ground up.

The guide has 4–6 chapters. Each chapter has:
- A short, evocative title (not a boring label like "Background" — make it say something)
- 2–4 sentences of prose that explain: what this chapter covers, why it matters right now
  in the story, and how it connects to what came before or what comes next
- A list of node IDs from the graph that belong in this chapter

The chapters should feel like a journey:
- Open with the problem or context ("Why does this paper exist? What gap does it fill?")
- Build up the foundation ("Here's what you need to understand first, and why")
- Show how the pieces connect ("Now that you have X, here's how Y uses it")
- Arrive at the contribution ("Here's what the authors actually did — and why it's clever")
- Close with results/impact if relevant ("Here's how they showed it works, and what it means")

Rules:
- Every node in the graph must appear in exactly one chapter.
- The prose is written for a smart person who hasn't read the paper. No jargon without explanation.
- Don't just describe the nodes — explain the intellectual journey. Make the reader feel the
  momentum of understanding building.
- The opening_summary (1–2 sentences) should be a compelling hook: what is this paper about
  and why should someone care?
"""

TOOL = {
    "name": "save_narrative",
    "description": "Save the structured narrative learning path.",
    "input_schema": {
        "type": "object",
        "properties": {
            "opening_summary": {
                "type": "string",
                "description": "1–2 sentence hook explaining the paper and why it matters.",
            },
            "chapters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "prose": {"type": "string"},
                        "node_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["title", "prose", "node_ids"],
                },
            },
        },
        "required": ["opening_summary", "chapters"],
    },
}


def generate_narrative(graph: KnowledgeGraph) -> dict:
    node_list = "\n".join(
        f"[{n.id}] ({n.type}, depth={n.depth}) {n.label}: {n.description[:200]}"
        for n in graph.nodes
    )
    edge_list = "\n".join(
        f"  {graph._node_label(e.source)} → needs → {graph._node_label(e.target)}"
        for e in graph.edges
        if graph._node_label(e.source) and graph._node_label(e.target)
    )

    prompt = f"""Paper: {graph.paper_title}

Abstract:
{graph.paper_abstract[:1200]}

Knowledge graph nodes (id, type, depth, label: description):
{node_list}

Dependency edges (source needs target to be understood first):
{edge_list}

Write the narrative learning guide. Use the node IDs exactly as shown above."""

    response = CLIENT.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "save_narrative"},
        messages=[{"role": "user", "content": prompt}],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "save_narrative":
            return block.input

    return {"opening_summary": "", "chapters": []}
