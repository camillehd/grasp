export type NodeType =
  | "core_contribution"
  | "method"
  | "theory"
  | "dataset"
  | "metric"
  | "external_prerequisite";

export interface GraspNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  source_quote: string | null;
  depth: number;
  is_external: boolean;
}

export interface GraspEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  rationale: string;
}

export interface KnowledgeGraph {
  id: string;
  paper_title: string;
  paper_abstract: string;
  paper_file: string | null;
  nodes: GraspNode[];
  edges: GraspEdge[];
  created_at: string;
}

export interface GraphSummary {
  id: string;
  paper_title: string;
  created_at: string;
  node_count: number;
  edge_count: number;
}

export const NODE_COLORS: Record<NodeType, string> = {
  core_contribution: "#8b7cf6",
  method: "#60a5fa",
  theory: "#2dd4bf",
  dataset: "#fbbf24",
  metric: "#fb7185",
  external_prerequisite: "#6b7280",
};

export const NODE_LABELS: Record<NodeType, string> = {
  core_contribution: "Core contribution",
  method: "Method",
  theory: "Theory",
  dataset: "Dataset",
  metric: "Metric",
  external_prerequisite: "Background",
};
