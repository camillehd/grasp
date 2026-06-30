import { useEffect, useRef } from "react";
import * as d3 from "d3";
import type { KnowledgeGraph, GraspNode, GraspEdge } from "../types/graph";
import { NODE_COLORS, NODE_LABELS } from "../types/graph";

interface Props {
  graph: KnowledgeGraph;
  selectedNode: GraspNode | null;
  highlightIds: Set<string>;
  onNodeSelect: (node: GraspNode | null) => void;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: GraspNode["type"];
  depth: number;
  _node: GraspNode;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  weight: number;
}

export default function GraphView({ graph, selectedNode, highlightIds, onNodeSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !graph.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = svgRef.current.getBoundingClientRect();
    const tooltip = d3.select(tooltipRef.current!);

    // Build sim data
    const simNodes: SimNode[] = graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      depth: n.depth,
      _node: n,
    }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: SimLink[] = graph.edges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, weight: e.weight }));

    // Zoom container
    const g = svg.append("g");
    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 3])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // Arrow marker
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#3a3a40");

    // Links
    const linkSel = g.append("g").selectAll<SVGLineElement, SimLink>("line")
      .data(simLinks)
      .join("line")
      .attr("stroke", "#2a2a2f")
      .attr("stroke-width", (d) => Math.max(0.5, d.weight * 2))
      .attr("marker-end", "url(#arrow)");

    // Node radius based on type
    const nodeRadius = (n: SimNode) => {
      if (n.type === "core_contribution") return 20;
      if (n.depth === 1) return 13;
      return 9;
    };

    // Nodes
    const nodeSel = g.append("g").selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end", (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (_event, d) => onNodeSelect(d._node))
      .on("mousemove", (event, d) => {
        tooltip
          .style("display", "block")
          .style("left", `${event.clientX + 12}px`)
          .style("top", `${event.clientY - 8}px`)
          .html(`<strong>${d.label}</strong><br/><span style="color:#6b7280;font-size:11px">${NODE_LABELS[d.type]}</span>`);
      })
      .on("mouseleave", () => tooltip.style("display", "none"));

    nodeSel.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d) => NODE_COLORS[d.type])
      .attr("fill-opacity", 0.15)
      .attr("stroke", (d) => NODE_COLORS[d.type])
      .attr("stroke-width", 1.5);

    nodeSel.append("text")
      .text((d) => d.label.length > 18 ? d.label.slice(0, 17) + "…" : d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => nodeRadius(d) + 13)
      .attr("font-size", 10)
      .attr("fill", "#9ca3af")
      .attr("pointer-events", "none");

    // Legend
    const legend = svg.append("g").attr("transform", `translate(16, ${height - 16})`);
    const types = Object.entries(NODE_COLORS) as [GraspNode["type"], string][];
    types.forEach(([type, color], i) => {
      const row = legend.append("g").attr("transform", `translate(0, ${-i * 18})`);
      row.append("circle").attr("r", 5).attr("fill", color).attr("fill-opacity", 0.2).attr("stroke", color).attr("stroke-width", 1.2);
      row.append("text").text(NODE_LABELS[type]).attr("x", 12).attr("dy", "0.35em").attr("font-size", 10).attr("fill", "#6b7280");
    });

    // Force simulation
    const sim = d3.forceSimulation(simNodes)
      .force("link", d3.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(120).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d) => nodeRadius(d as SimNode) + 30))
      .on("tick", () => {
        linkSel
          .attr("x1", (d) => (d.source as SimNode).x!)
          .attr("y1", (d) => (d.source as SimNode).y!)
          .attr("x2", (d) => (d.target as SimNode).x!)
          .attr("y2", (d) => (d.target as SimNode).y!);
        nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    return () => { sim.stop(); };
  }, [graph]);

  // Update highlight styles without re-running simulation
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);

    svg.selectAll<SVGGElement, SimNode>("g g g")
      .each(function (d: SimNode) {
        const isHighlighted = highlightIds.size === 0 || highlightIds.has(d.id);
        const isSelected = d.id === selectedNode?.id;
        d3.select(this).select("circle")
          .attr("fill-opacity", isHighlighted ? (isSelected ? 0.4 : 0.2) : 0.04)
          .attr("stroke-opacity", isHighlighted ? 1 : 0.2)
          .attr("stroke-width", isSelected ? 2.5 : 1.5);
        d3.select(this).select("text")
          .attr("fill", isHighlighted ? (isSelected ? "#e5e7eb" : "#9ca3af") : "#3a3a40");
      });

    svg.selectAll<SVGLineElement, SimLink>("g line")
      .attr("stroke-opacity", (d) => {
        if (highlightIds.size === 0) return 0.5;
        const srcId = typeof d.source === "object" ? (d.source as SimNode).id : d.source;
        const tgtId = typeof d.target === "object" ? (d.target as SimNode).id : d.target;
        return highlightIds.has(srcId) && highlightIds.has(tgtId) ? 0.8 : 0.06;
      });
  }, [highlightIds, selectedNode]);

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" onClick={(e) => { if (e.target === svgRef.current) onNodeSelect(null); }} />
      <div ref={tooltipRef} className="grasp-tooltip" style={{ display: "none" }} />
    </div>
  );
}
