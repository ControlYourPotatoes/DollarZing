import { useMemo } from "react";

import {
  NormalizedPresentationDay,
  NormalizedPresentationScenario,
  PresentationWorkflowLink,
  PresentationWorkflowNode,
} from "@/shared/presentation";
import { layoutWorkflow } from "../layout/simpleLayout";
import {
  useActiveTimelineDay,
  useActiveTimelineScenario,
} from "@/features/timeline";

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

const DEFAULT_NODE_RADIUS = 48;

function computePositions(
  nodes: PresentationWorkflowNode[],
  links: PresentationWorkflowLink[]
): Record<string, { x: number; y: number }> {
  return layoutWorkflow(nodes, links);
}

export function useWorkflowData(): WorkflowLayoutResult {
  const scenario = useActiveTimelineScenario();
  const day = useActiveTimelineDay();

  return useMemo(() => {
    if (!day || !scenario) {
      return { scenario, day, nodes: [], links: [], highlightedIds: [] };
    }

    // Derive canonical nodes/links if missing from snapshot
    const sourceNodes = [...day.financialWorkflow.nodes];
    const sourceLinks = [...day.financialWorkflow.links];

    const haveTotal = sourceNodes.some((n) => n.id === "total");
    const havePlatform = sourceNodes.some((n) => n.id === "platform");
    const haveCharity = sourceNodes.some((n) => n.id === "charity");
    const havePlayers = sourceNodes.some((n) => n.id === "players");

    // Use daily aggregates as fallback values
    const totalValue = Math.max(0, day.summary.dailyRevenue || 0);
    const platformValue = Math.max(0, day.summary.dailyFees || 0);
    const charityValue = Math.max(0, day.summary.dailyCharity || 0);
    const playersValue = Math.max(0, day.summary.dailyPayouts || 0);

    if (!haveTotal) {
      sourceNodes.push({
        id: "total",
        label: "Total",
        aggregateValue: totalValue,
      });
    }
    if (!havePlatform) {
      sourceNodes.push({
        id: "platform",
        label: "Platform Fees",
        aggregateValue: platformValue,
      });
    }
    if (!haveCharity) {
      sourceNodes.push({
        id: "charity",
        label: "Charity",
        aggregateValue: charityValue,
      });
    }
    if (!havePlayers) {
      sourceNodes.push({
        id: "players",
        label: "Player Payouts",
        aggregateValue: playersValue,
      });
    }

    const ensureLink = (
      id: string,
      source: string,
      target: string,
      value: number
    ) => {
      if (value <= 0) return;
      const exists = sourceLinks.some(
        (l) => l.source === source && l.target === target
      );
      if (!exists) {
        sourceLinks.push({ id, source, target, value });
      }
    };

    ensureLink("flow-platform", "total", "platform", platformValue);
    ensureLink("flow-charity", "total", "charity", charityValue);
    ensureLink("flow-players", "total", "players", playersValue);

    const layoutPositions = computePositions(sourceNodes, sourceLinks);
    const positionedNodes: PositionedNode[] = sourceNodes.map((node) => {
      const pos = layoutPositions[node.id] || { x: 80, y: 60 };
      return {
        ...node,
        x: pos.x,
        y: pos.y,
        radius: DEFAULT_NODE_RADIUS,
      };
    });

    const nodeById = new Map<string, PositionedNode>(
      positionedNodes.map((node) => [node.id, node])
    );

    const positionedLinks: PositionedLink[] = sourceLinks
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
