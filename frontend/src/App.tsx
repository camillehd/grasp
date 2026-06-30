import { useState, useEffect, useCallback } from "react";
import type { KnowledgeGraph, GraphSummary, GraspNode } from "./types/graph";
import Upload from "./components/Upload";
import GraphView from "./components/GraphView";
import NodePanel from "./components/NodePanel";
import LearningPath from "./components/LearningPath";
import { useResize } from "./hooks/useResize";

type View = "graph" | "path";

export default function App() {
  const [graphs, setGraphs] = useState<GraphSummary[]>([]);
  const [activeGraph, setActiveGraph] = useState<KnowledgeGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraspNode | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<View>("graph");
  const [loading, setLoading] = useState(false);

  const sidebar = useResize(220, 160, 400, "left");
  const panel = useResize(320, 260, 560, "right");

  const fetchGraphs = useCallback(async () => {
    const res = await fetch("/api/graphs");
    if (res.ok) setGraphs(await res.json());
  }, []);

  useEffect(() => { fetchGraphs(); }, [fetchGraphs]);

  const loadGraph = async (id: string) => {
    setLoading(true);
    setSelectedNode(null);
    setHighlightIds(new Set());
    const res = await fetch(`/api/graphs/${id}`);
    if (res.ok) setActiveGraph(await res.json());
    setLoading(false);
  };

  const onNodeSelect = (node: GraspNode | null) => {
    setSelectedNode(node);
    if (!node || !activeGraph) { setHighlightIds(new Set()); return; }
    const prereqIds = getPrerequisiteIds(activeGraph, node.id);
    setHighlightIds(new Set([node.id, ...prereqIds]));
  };

  return (
    <div className="h-screen flex flex-col bg-surface-0 text-gray-200 overflow-hidden select-none">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight text-white">Grasp</span>
          {activeGraph && (
            <>
              <span className="text-white/20">/</span>
              <span className="text-sm text-gray-400 truncate max-w-xs">{activeGraph.paper_title}</span>
            </>
          )}
        </div>
        {activeGraph && (
          <div className="flex bg-surface-2 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setView("graph")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${view === "graph" ? "bg-surface-3 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Graph
            </button>
            <button
              onClick={() => setView("path")}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${view === "path" ? "bg-surface-3 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              Learning path
            </button>
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left sidebar */}
        <aside
          className="flex flex-col flex-shrink-0 overflow-hidden border-r border-white/[0.06]"
          style={{ width: sidebar.size }}
        >
          <Upload onIngested={fetchGraphs} />
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {graphs.length === 0 && (
              <p className="text-xs text-gray-600 px-2 pt-3">No papers yet. Upload a PDF above.</p>
            )}
            {graphs.map((g) => (
              <button
                key={g.id}
                onClick={() => loadGraph(g.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  activeGraph?.id === g.id ? "bg-surface-3 text-white" : "text-gray-400 hover:bg-surface-2 hover:text-gray-200"
                }`}
              >
                <p className="text-sm font-medium leading-snug truncate">{g.paper_title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{g.node_count} nodes · {g.edge_count} edges</p>
              </button>
            ))}
          </div>
        </aside>

        {/* Left resize handle */}
        <div
          onMouseDown={sidebar.onMouseDown}
          className="w-1 flex-shrink-0 cursor-col-resize hover:bg-white/10 transition-colors active:bg-white/20"
        />

        {/* Main canvas */}
        <main className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <p className="text-gray-500 text-sm">Loading graph…</p>
            </div>
          )}
          {!activeGraph && !loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-700 text-sm">Upload a paper or select one from the sidebar.</p>
            </div>
          )}
          {activeGraph && view === "graph" && (
            <GraphView
              graph={activeGraph}
              selectedNode={selectedNode}
              highlightIds={highlightIds}
              onNodeSelect={onNodeSelect}
            />
          )}
          {activeGraph && view === "path" && (
            <LearningPath graph={activeGraph} onNodeSelect={(n) => { setView("graph"); onNodeSelect(n); }} />
          )}
        </main>

        {/* Right resize handle (only when panel open) */}
        {selectedNode && (
          <div
            onMouseDown={panel.onMouseDown}
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-white/10 transition-colors active:bg-white/20"
          />
        )}

        {/* Right node panel */}
        {selectedNode && activeGraph && (
          <aside
            className="flex-shrink-0 border-l border-white/[0.06] overflow-hidden"
            style={{ width: panel.size }}
          >
            <NodePanel
              graph={activeGraph}
              node={selectedNode}
              onClose={() => onNodeSelect(null)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

function getPrerequisiteIds(graph: KnowledgeGraph, nodeId: string): string[] {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.pop()!;
    for (const edge of graph.edges) {
      if (edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target);
        queue.push(edge.target);
      }
    }
  }
  return [...visited];
}
