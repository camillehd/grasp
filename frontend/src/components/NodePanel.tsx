import { useState, useRef, useEffect } from "react";
import type { KnowledgeGraph, GraspNode } from "../types/graph";
import { NODE_COLORS, NODE_LABELS } from "../types/graph";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  graph: KnowledgeGraph;
  node: GraspNode;
  onClose: () => void;
}

export default function NodePanel({ graph, node, onClose }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const prereqs = getPrerequisites(graph, node.id);
  const color = NODE_COLORS[node.type];

  // Reset chat when node changes
  useEffect(() => {
    setHistory([]);
    setInput("");
  }, [node.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const newHistory: ChatMessage[] = [...history, { role: "user", content: question }];
    setHistory(newHistory);
    setInput("");
    setLoading(true);

    const res = await fetch(`/api/graphs/${graph.id}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: node.id, question, history }),
    });

    if (res.ok) {
      const data = await res.json();
      setHistory([...newHistory, { role: "assistant", content: data.answer }]);
    } else {
      setHistory([...newHistory, { role: "assistant", content: "Something went wrong. Try again." }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-0">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color }}>
              {NODE_LABELS[node.type]}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-white leading-snug">{node.label}</h2>
        </div>
        <button onClick={onClose} className="ml-3 text-gray-600 hover:text-gray-300 transition-colors text-xl leading-none flex-shrink-0 mt-0.5">
          ×
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Node info */}
        <div className="p-4 space-y-4 border-b border-white/[0.06]">
          <p className="text-sm text-gray-300 leading-relaxed">{node.description}</p>

          {node.source_quote && (
            <blockquote className="border-l-2 border-white/10 pl-3">
              <p className="text-xs text-gray-600 italic leading-relaxed">"{node.source_quote}"</p>
            </blockquote>
          )}

          {prereqs.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium">Prerequisites</p>
              <div className="space-y-1.5">
                {prereqs.map((p) => (
                  <div key={p.id} className="flex items-start gap-2 py-1.5 px-2.5 rounded-md bg-surface-2">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: NODE_COLORS[p.type] }} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-300">{p.label}</p>
                      <p className="text-xs text-gray-600 leading-snug mt-0.5 line-clamp-2">{p.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat history */}
        <div className="px-4 py-3 space-y-3">
          {history.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-2">Ask anything about this concept</p>
          )}
          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-surface-3 text-gray-100 rounded-tr-sm"
                    : "bg-surface-2 text-gray-300 rounded-tl-sm border border-white/[0.04]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-surface-2 border border-white/[0.04] rounded-2xl rounded-tl-sm px-3 py-2">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a follow-up…"
            rows={1}
            className="flex-1 bg-surface-2 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors resize-none leading-relaxed"
            style={{ maxHeight: "120px", overflowY: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-30 flex-shrink-0"
            style={{ background: `${color}22`, color }}
          >
            ↑
          </button>
        </div>
        <p className="text-[10px] text-gray-700 mt-1.5 text-center">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1 items-center h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-gray-600"
          style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,80%,100%{opacity:0.3} 40%{opacity:1} }`}</style>
    </div>
  );
}

function getPrerequisites(graph: KnowledgeGraph, nodeId: string): GraspNode[] {
  const visited = new Set<string>();
  const queue = [nodeId];
  const result: GraspNode[] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  while (queue.length) {
    const current = queue.pop()!;
    for (const edge of graph.edges) {
      if (edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target);
        const n = nodeMap.get(edge.target);
        if (n) { result.push(n); queue.push(edge.target); }
      }
    }
  }
  return result;
}
