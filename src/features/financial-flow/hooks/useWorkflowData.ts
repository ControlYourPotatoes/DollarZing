import { useMemo } from "react";

import {
  NormalizedPresentationDay,
  NormalizedPresentationScenario,
  PresentationWorkflowLink,
  PresentationWorkflowNode,
} from "@/shared/presentation";
import { useActiveTimelineDay, useActiveTimelineScenario } from "@/features/timeline";

interface PositionedNode extends PresentationWorkflowNode {
  x: number;
  y: number;
  radius: number;
}

interface PositionedLink extends PresentationWorkflowLink {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface WorkflowLayoutResult {
  scenario?: NormalizedPresentationScenario;
  day?: NormalizedPresentationDay;
  nodes: PositionedNode[];
  links: PositionedLink[];
  highlightedIds: string[];
}

const DEFAULT_NODE_RADIUS = 46;
const DEFAULT_NODE_GAP_Y = 100;
const DEFAULT_NODE_GAP_X = 220;

const DEFAULT_LAYOUT: Record<string, { x: number; y: number }> = {
  total: { x: 80, y: 110 },
  platform: { x: 320, y: 40 },
  charity: { x: 320, y: 110 },
  players: { x: 320, y: 180 },
};

function resolvePosition(
  nodeId: string,
  index: number
): { x: number; y: number } {
  if (nodeId in DEFAULT_LAYOUT) {
    return DEFAULT_LAYOUT[nodeId];
  }
  const column = Math.floor(index / 3) + 1;
  const row = index % 3;
  return {
    x: DEFAULT_NODE_GAP_X * column,
    y: 40 + row * DEFAULT_NODE_GAP_Y,
  };
}

export function useWorkflowData(): WorkflowLayoutResult {
  const scenario = useActiveTimelineScenario();
  const day = useActiveTimelineDay();

  return useMemo(() => {
    if (!day || !scenario) {
      return { scenario, day, nodes: [], links: [], highlightedIds: [] };
    }

    const positionedNodes: PositionedNode[] = day.financialWorkflow.nodes.map(
      (node, index) => {
        const { x, y } = resolvePosition(node.id, index);
        return {
          ...node,
          x,
          y,
          radius: DEFAULT_NODE_RADIUS,
        };
      }
    );

    const nodeById = new Map<string, PositionedNode>(
      positionedNodes.map((node) => [node.id, node])
    );

    const positionedLinks: PositionedLink[] = day.financialWorkflow.links
      .map((link) => {
        const source = nodeById.get(link.source);
        const target = nodeById.get(link.target);
        if (!source || !target) {
          return undefined;
        }
        return {
          ...link,
          sourceX: source.x + source.radius,
          sourceY: source.y,
          targetX: target.x - target.radius,
          targetY: target.y,
        };
      })
      .filter((link): link is PositionedLink => Boolean(link));

    return {
      scenario,
      day,
      nodes: positionedNodes,
      links: positionedLinks,
      highlightedIds: positionedNodes.map((node) => node.id),
    };
  }, [day, scenario]);
}

