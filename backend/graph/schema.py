from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field
import uuid
from datetime import datetime


NodeType = Literal[
    "core_contribution",   # the paper's main claim/method
    "method",              # a technique or algorithm used
    "theory",              # a theoretical concept (e.g. attention, gradient descent)
    "dataset",             # a dataset referenced
    "metric",              # an evaluation metric
    "external_prerequisite",  # background knowledge assumed but not defined in paper
]


class Node(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    label: str
    type: NodeType
    description: str
    source_quote: Optional[str] = None  # exact sentence from the paper introducing this concept
    depth: int = 0  # 0 = paper's main contribution; higher = more foundational prerequisite
    is_external: bool = False  # True if not defined in the paper itself

    @property
    def color_hint(self) -> str:
        return {
            "core_contribution": "purple",
            "method": "blue",
            "theory": "teal",
            "dataset": "amber",
            "metric": "coral",
            "external_prerequisite": "gray",
        }[self.type]


class Edge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    source: str  # node id — the concept that depends on target
    target: str  # node id — the prerequisite
    weight: float = 1.0  # 0–1, dependency strength
    rationale: str  # one sentence explaining why this dependency exists


class KnowledgeGraph(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    paper_title: str
    paper_abstract: str
    paper_file: Optional[str] = None  # original filename
    nodes: list[Node] = []
    edges: list[Edge] = []
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

    def get_prerequisites(self, node_id: str) -> list[Node]:
        """Return all nodes that node_id transitively depends on (upstream)."""
        visited: set[str] = set()
        queue = [node_id]
        result: list[Node] = []
        node_map = {n.id: n for n in self.nodes}
        while queue:
            current = queue.pop()
            for edge in self.edges:
                if edge.source == current and edge.target not in visited:
                    visited.add(edge.target)
                    if edge.target in node_map:
                        result.append(node_map[edge.target])
                    queue.append(edge.target)
        return result

    def _node_label(self, node_id: str) -> str:
        for n in self.nodes:
            if n.id == node_id:
                return n.label
        return ""

    def topological_sort(self) -> list[Node]:
        """Return nodes in learning order: prerequisites first."""
        from collections import defaultdict, deque
        in_degree: dict[str, int] = defaultdict(int)
        adj: dict[str, list[str]] = defaultdict(list)
        node_ids = {n.id for n in self.nodes}
        for edge in self.edges:
            if edge.source in node_ids and edge.target in node_ids:
                adj[edge.target].append(edge.source)
                in_degree[edge.source] += 1
        queue = deque(n.id for n in self.nodes if in_degree[n.id] == 0)
        order: list[str] = []
        while queue:
            nid = queue.popleft()
            order.append(nid)
            for dependent in adj[nid]:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)
        node_map = {n.id: n for n in self.nodes}
        return [node_map[nid] for nid in order if nid in node_map]
