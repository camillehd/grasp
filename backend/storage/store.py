"""JSON-backed graph store. Each graph saved as graphs/<id>.json.
Narratives cached as graphs/<id>.narrative.json."""
from __future__ import annotations
import json
from pathlib import Path
from graph.schema import KnowledgeGraph

STORE_DIR = Path(__file__).parent.parent / "data" / "graphs"


def _ensure_dir() -> None:
    STORE_DIR.mkdir(parents=True, exist_ok=True)


def save_graph(graph: KnowledgeGraph) -> str:
    _ensure_dir()
    path = STORE_DIR / f"{graph.id}.json"
    path.write_text(graph.model_dump_json(indent=2))
    return graph.id


def load_graph(graph_id: str) -> KnowledgeGraph:
    path = STORE_DIR / f"{graph_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Graph {graph_id} not found")
    return KnowledgeGraph.model_validate_json(path.read_text())


def save_narrative(graph_id: str, narrative: dict) -> None:
    _ensure_dir()
    path = STORE_DIR / f"{graph_id}.narrative.json"
    path.write_text(json.dumps(narrative, indent=2))


def load_narrative(graph_id: str) -> dict | None:
    path = STORE_DIR / f"{graph_id}.narrative.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def list_graphs() -> list[dict]:
    _ensure_dir()
    results = []
    for p in sorted(STORE_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True):
        try:
            g = KnowledgeGraph.model_validate_json(p.read_text())
            results.append({
                "id": g.id,
                "paper_title": g.paper_title,
                "created_at": g.created_at,
                "node_count": len(g.nodes),
                "edge_count": len(g.edges),
            })
        except Exception:
            continue
    return results
