import {
  PresentationWorkflowLink,
  PresentationWorkflowNode,
} from "@/shared/presentation";

export interface LayoutConfig {
  gapX: number;
  gapY: number;
  marginX: number;
  marginY: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  gapX: 520,
  gapY: 270,
  marginX: 80,
  marginY: 180,
};

function computeRanks(
  nodes: PresentationWorkflowNode[],
  links: PresentationWorkflowLink[]
): Map<string, number> {
  const rank = new Map<string, number>();
  const inbound = new Map<string, number>();
  const outAdj = new Map<string, string[]>();

  for (const n of nodes) {
    inbound.set(n.id, 0);
    outAdj.set(n.id, []);
  }
  for (const l of links) {
    inbound.set(l.target, (inbound.get(l.target) || 0) + 1);
    outAdj.get(l.source)?.push(l.target);
  }

  const queue: string[] = [];
  if (inbound.has("total")) {
    queue.push("total");
    rank.set("total", 0);
  }
  for (const n of nodes) {
    if ((inbound.get(n.id) || 0) === 0 && !rank.has(n.id)) {
      queue.push(n.id);
      rank.set(n.id, 0);
    }
  }

  while (queue.length > 0) {
    const u = queue.shift()!;
    const r = rank.get(u) || 0;
    for (const v of outAdj.get(u) || []) {
      const next = Math.max(r + 1, rank.get(v) ?? -Infinity);
      rank.set(v, next);
      queue.push(v);
    }
  }

  for (const n of nodes) {
    if (!rank.has(n.id)) rank.set(n.id, 1);
  }
  return rank;
}

export function layoutWorkflow(
  nodes: PresentationWorkflowNode[],
  links: PresentationWorkflowLink[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): Record<string, { x: number; y: number }> {
  const { gapX, gapY, marginX, marginY } = config;
  const ranks = computeRanks(nodes, links);
  const byRank = new Map<number, PresentationWorkflowNode[]>();
  for (const n of nodes) {
    const r = ranks.get(n.id) || 0;
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r)!.push(n);
  }

  const positions: Record<string, { x: number; y: number }> = {};
  const sortedRanks = Array.from(byRank.keys()).sort((a, b) => a - b);
  for (const r of sortedRanks) {
    const group = byRank.get(r)!;
    group.sort((a, b) => a.id.localeCompare(b.id));
    const startY = marginY;
    group.forEach((node, idx) => {
      positions[node.id] = {
        x: marginX + r * gapX,
        y: startY + idx * gapY,
      };
    });
  }
  return positions;
}
