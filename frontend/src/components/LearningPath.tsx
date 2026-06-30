import { useState, useEffect } from "react";
import type { KnowledgeGraph, GraspNode } from "../types/graph";
import { NODE_COLORS, NODE_LABELS } from "../types/graph";

interface NarrativeChapter {
  title: string;
  prose: string;
  node_ids: string[];
}

interface Narrative {
  opening_summary: string;
  chapters: NarrativeChapter[];
}

interface Props {
  graph: KnowledgeGraph;
  onNodeSelect: (node: GraspNode) => void;
}

export default function LearningPath({ graph, onNodeSelect }: Props) {
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNarrative(null);
    setChecked(new Set());
    setLoading(true);
    fetch(`/api/graphs/${graph.id}/narrative`)
      .then((r) => r.json())
      .then((data) => setNarrative(data))
      .finally(() => setLoading(false));
  }, [graph.id]);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const totalNodes = graph.nodes.length;
  const progress = totalNodes ? Math.round((checked.size / totalNodes) * 100) : 0;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const exportMarkdown = () => {
    if (!narrative) return;
    const lines = [
      `# ${graph.paper_title}`,
      "",
      `> ${narrative.opening_summary}`,
      "",
    ];
    for (const chapter of narrative.chapters) {
      lines.push(`## ${chapter.title}`, "", chapter.prose, "");
      for (const id of chapter.node_ids) {
        const n = nodeMap.get(id);
        if (n) lines.push(`- **${n.label}**: ${n.description}`);
      }
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "grasp-narrative.md";
    a.click();
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <NarrativeSpinner />
        <p className="text-sm text-gray-500">Crafting your learning narrative…</p>
        <p className="text-xs text-gray-700">This takes ~15 seconds and is cached after.</p>
      </div>
    );
  }

  if (!narrative) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-400">{checked.size} / {totalNodes} concepts understood</p>
          <button onClick={exportMarkdown} className="text-xs text-gray-600 hover:text-gray-300 transition-colors">
            Export .md
          </button>
        </div>
        <div className="h-0.5 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "#8b7cf6" }}
          />
        </div>
      </div>

      {/* Narrative */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-12">

          {/* Opening hook */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">The paper</p>
            <h1 className="text-lg font-semibold text-white leading-snug">{graph.paper_title}</h1>
            <p className="text-base text-gray-300 leading-relaxed">{narrative.opening_summary}</p>
          </div>

          {/* Chapters */}
          {narrative.chapters.map((chapter, ci) => {
            const chapterNodes = chapter.node_ids.map((id) => nodeMap.get(id)).filter(Boolean) as GraspNode[];
            const chapterDone = chapterNodes.every((n) => checked.has(n.id));

            return (
              <div key={ci} className="space-y-4">
                {/* Chapter header */}
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-1">
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-semibold transition-colors ${
                      chapterDone
                        ? "border-accent-purple bg-accent-purple/20 text-accent-purple"
                        : "border-white/10 text-gray-600"
                    }`}>
                      {chapterDone ? "✓" : ci + 1}
                    </div>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">{chapter.title}</h2>
                  </div>
                </div>

                {/* Connector line */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 flex justify-center w-6">
                    <div className="w-px bg-white/[0.06] h-full" />
                  </div>
                  <div className="flex-1 space-y-4 pb-2">
                    {/* Prose */}
                    <p className="text-sm text-gray-400 leading-relaxed">{chapter.prose}</p>

                    {/* Concept cards */}
                    {chapterNodes.length > 0 && (
                      <div className="space-y-2">
                        {chapterNodes.map((node) => {
                          const done = checked.has(node.id);
                          const color = NODE_COLORS[node.type];
                          return (
                            <div
                              key={node.id}
                              className={`rounded-xl border p-3 transition-all ${
                                done
                                  ? "border-white/[0.04] opacity-40"
                                  : "border-white/[0.07] bg-surface-1 hover:border-white/[0.12]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Check circle */}
                                <button
                                  onClick={() => toggle(node.id)}
                                  className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-all"
                                  style={{
                                    borderColor: done ? color : "#3a3a40",
                                    background: done ? color : "transparent",
                                  }}
                                >
                                  {done && <span className="text-[8px] text-black font-bold">✓</span>}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color }}>
                                      {NODE_LABELS[node.type]}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium text-gray-200 leading-snug">{node.label}</p>
                                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{node.description}</p>
                                </div>

                                <button
                                  onClick={() => onNodeSelect(node)}
                                  className="flex-shrink-0 text-xs text-gray-700 hover:text-gray-300 transition-colors mt-0.5"
                                  title="View in graph & ask questions"
                                >
                                  ↗
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Chapter divider (not after last) */}
                {ci < narrative.chapters.length - 1 && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-shrink-0 w-6 flex justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    </div>
                    <div className="flex-1 h-px bg-white/[0.04]" />
                  </div>
                )}
              </div>
            );
          })}

          <div className="pb-12" />
        </div>
      </div>
    </div>
  );
}

function NarrativeSpinner() {
  return (
    <div className="relative w-8 h-8">
      <div className="absolute inset-0 rounded-full border-2 border-white/5" />
      <div
        className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent-purple"
        style={{ animation: "spin 0.9s linear infinite" }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
