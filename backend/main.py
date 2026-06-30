from __future__ import annotations
import os
import shutil
import tempfile
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import anthropic
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agents.ingestion import ingest_pdf
from agents.concept_extractor import extract_concepts
from agents.dependency_mapper import map_dependencies
from agents.enrichment import enrich_nodes
from agents.critic import validate_graph
from agents.narrator import generate_narrative
from graph.schema import KnowledgeGraph, Node
from storage.store import save_graph, load_graph, list_graphs, save_narrative, load_narrative

app = FastAPI(title="Grasp API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# In-memory status tracker for long-running ingestion jobs
_job_status: dict[str, dict] = {}


# ── Ingestion ─────────────────────────────────────────────────────────────────

@app.post("/ingest")
async def ingest(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", dir=UPLOAD_DIR)
    shutil.copyfileobj(file.file, tmp)
    tmp.close()

    job_id = Path(tmp.name).stem
    _job_status[job_id] = {"status": "processing", "step": "ingesting PDF"}

    background_tasks.add_task(_run_pipeline, job_id, tmp.name, file.filename)
    return {"job_id": job_id}


async def _run_pipeline(job_id: str, pdf_path: str, original_name: str):
    try:
        _job_status[job_id]["step"] = "parsing PDF"
        paper = ingest_pdf(pdf_path)

        _job_status[job_id]["step"] = "extracting concepts"
        nodes = extract_concepts(paper)

        _job_status[job_id]["step"] = "mapping dependencies"
        edges = map_dependencies(paper, nodes)

        _job_status[job_id]["step"] = "enriching external concepts"
        nodes = enrich_nodes(nodes)

        _job_status[job_id]["step"] = "validating graph"
        edges = validate_graph(paper, nodes, edges)

        graph = KnowledgeGraph(
            paper_title=paper.title,
            paper_abstract=paper.abstract,
            paper_file=original_name,
            nodes=nodes,
            edges=edges,
        )
        graph_id = save_graph(graph)
        _job_status[job_id] = {"status": "done", "graph_id": graph_id}

    except Exception as exc:
        _job_status[job_id] = {"status": "error", "message": str(exc)}
    finally:
        try:
            os.unlink(pdf_path)
        except OSError:
            pass


@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    status = _job_status.get(job_id)
    if status is None:
        raise HTTPException(404, "Job not found")
    return status


# ── Graph retrieval ────────────────────────────────────────────────────────────

@app.get("/graphs")
def get_graphs():
    return list_graphs()


@app.get("/graphs/{graph_id}")
def get_graph(graph_id: str):
    try:
        return load_graph(graph_id).model_dump()
    except FileNotFoundError:
        raise HTTPException(404, "Graph not found")


# ── Narrative ─────────────────────────────────────────────────────────────────

@app.get("/graphs/{graph_id}/narrative")
def get_narrative(graph_id: str):
    try:
        graph = load_graph(graph_id)
    except FileNotFoundError:
        raise HTTPException(404, "Graph not found")

    cached = load_narrative(graph_id)
    if cached:
        return cached

    narrative = generate_narrative(graph)
    save_narrative(graph_id, narrative)
    return narrative


# ── Node query ─────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class QueryRequest(BaseModel):
    question: str
    node_id: str
    history: list[ChatMessage] = []


@app.post("/graphs/{graph_id}/query")
def query_node(graph_id: str, req: QueryRequest):
    try:
        graph = load_graph(graph_id)
    except FileNotFoundError:
        raise HTTPException(404, "Graph not found")

    node = next((n for n in graph.nodes if n.id == req.node_id), None)
    if node is None:
        raise HTTPException(404, "Node not found")

    prereqs = graph.get_prerequisites(req.node_id)
    answer = _answer_query(graph.paper_title, node, prereqs, req.question, req.history)
    return {
        "node_id": req.node_id,
        "node_label": node.label,
        "answer": answer,
        "prerequisite_ids": [p.id for p in prereqs],
    }


def _answer_query(
    paper_title: str,
    node: Node,
    prereqs: list[Node],
    question: str,
    history: list[ChatMessage],
) -> str:
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    model = os.environ.get("GRASP_MODEL", "claude-sonnet-4-6")

    prereq_context = ""
    if prereqs:
        prereq_context = "\n\nPrerequisite concepts:\n" + "\n".join(
            f"- {p.label}: {p.description}" for p in prereqs
        )

    system = (
        f"You are a patient, friendly tutor helping someone understand a concept from the paper '{paper_title}'.\n\n"
        f"The concept being discussed: {node.label}\n"
        f"Description: {node.description}\n"
        f"{prereq_context}\n\n"
        "Answer clearly and accurately. Use plain language and concrete analogies where helpful. "
        "Keep responses focused — 2–5 sentences unless the question genuinely needs more. "
        "You are in a conversation, so build on what has already been said rather than repeating yourself."
    )

    # Build message list: prior history + new question
    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": question})

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system,
        messages=messages,
    )
    return response.content[0].text.strip()


