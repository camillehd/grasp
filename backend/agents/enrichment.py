"""Enrich external_prerequisite nodes with accurate background explanations."""
from __future__ import annotations
import os
import anthropic
from graph.schema import Node

CLIENT = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
MODEL = os.environ.get("GRASP_MODEL", "claude-sonnet-4-6")

SYSTEM = """You are a patient, gifted educator. Given a concept that an academic paper assumes
as background knowledge, write a clear, engaging explanation of it for a smart reader who
may not have a technical background.

Your explanation must:
- Be 4–6 sentences.
- Open by defining the concept in one plain sentence — no jargon without immediately explaining it.
- Explain intuitively WHY this concept exists and what problem it solves.
- Use a concrete real-world analogy or example to make it stick.
- Close with why it's important as a building block for the kind of research that uses it.

Do not reference the specific paper — this is standalone background knowledge.
Avoid bullet points; write in flowing prose.
"""


def enrich_nodes(nodes: list[Node]) -> list[Node]:
    """Replace placeholder descriptions for external prerequisites with richer explanations."""
    enriched: list[Node] = []
    for node in nodes:
        if node.is_external and node.type == "external_prerequisite":
            node = node.model_copy(update={"description": _enrich_one(node.label, node.description)})
        enriched.append(node)
    return enriched


def _enrich_one(label: str, current_description: str) -> str:
    prompt = f"""Concept: {label}

Current short description (for context, don't just repeat it): {current_description}

Write a 4–6 sentence plain-English explanation of this concept for a smart non-expert reader.
Use an analogy or concrete example. Write in flowing prose."""

    response = CLIENT.messages.create(
        model=MODEL,
        max_tokens=512,
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()
