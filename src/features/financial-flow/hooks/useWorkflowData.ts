import { useMemo } from "react";

import {
  NormalizedPresentationDay,
  NormalizedPresentationScenario,
  PresentationWorkflowLink,
  PresentationWorkflowNode,
  PresentationWorkflowLayer,
} from "@/shared/presentation";
import {
  DEFAULT_LAYOUT_CONFIG,
  layoutWorkflow,
} from "../layout/simpleLayout";
import {
  useActiveTimelineDay,
  useActiveTimelineScenario,
} from "@/features/timeline";
// import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";

interface PositionedNode extends PresentationWorkflowNode {
  x: number;
  y: number;
  radius: number;
  // display-only comparison extras
  midSegments?: PresentationWorkflowLayer[];
  highSegments?: PresentationWorkflowLayer[];
  baseValue?: number;
  midValue?: number;
  highValue?: number;
  baseDeltaPercent?: number;
  midDeltaPercent?: number;
  highDeltaPercent?: number;
  comparisonMax?: number;
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

const DEFAULT_NODE_RADIUS = 70;

const LAYOUT_CONFIG = DEFAULT_LAYOUT_CONFIG;

function computePositions(
  nodes: PresentationWorkflowNode[],
  links: PresentationWorkflowLink[]
): Record<string, { x: number; y: number }> {
  return layoutWorkflow(nodes, links, LAYOUT_CONFIG);
}

export function useWorkflowData(): WorkflowLayoutResult {
  const scenario = useActiveTimelineScenario();
  const day = useActiveTimelineDay();
  // const manifest = usePresentationTimelineStore((s) => s.index);
  // const scenariosMap = usePresentationTimelineStore((s) => s.scenarios);
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();

  return useMemo(() => {
    if (!day || !scenario) {
      return { scenario, day, nodes: [], links: [], highlightedIds: [] };
    }

    let globalMax = 0;
    const nodeComparisonMax: Record<string, number> = {};

    const trackMaxValue = (nodeId: string, rawValue: number | undefined) => {
      if (rawValue === undefined || Number.isNaN(rawValue)) {
        return;
      }
      const value = Math.max(0, rawValue);
      nodeComparisonMax[nodeId] = Math.max(nodeComparisonMax[nodeId] ?? 0, value);
    };
    const scenariosToCheck = [scenario, midScenario, highScenario].filter(
      Boolean
    ) as NormalizedPresentationScenario[];

    const activeDayIndex = day.dayIndex ?? 0;
    scenariosToCheck.forEach((sc) => {
      if (!sc?.dayLookup) return;
      Object.entries(sc.dayLookup).forEach(([dayKey, d]) => {
        if (!d?.timelineTick) return;
        const idx = Number(dayKey);
        if (!Number.isFinite(idx) || idx > activeDayIndex) return;
        const tick = d.timelineTick;
        globalMax = Math.max(
          globalMax,
          tick.cumulativeRevenue || 0,
          tick.cumulativeFees || 0,
          tick.cumulativeCharity || 0,
          tick.cumulativePayouts || 0
        );

        trackMaxValue("total", tick.cumulativeRevenue || 0);
        trackMaxValue("platform", tick.cumulativeFees || 0);
        trackMaxValue("charity", tick.cumulativeCharity || 0);
        trackMaxValue("players", tick.cumulativePayouts || 0);

        if (d.financialWorkflow?.nodes) {
          d.financialWorkflow.nodes.forEach((workflowNode) => {
            trackMaxValue(workflowNode.id, workflowNode.aggregateValue);
          });
        }
      });
    });

    const HEADROOM_FACTOR = 1.1;
    if (globalMax === 0) {
      globalMax = 1;
    } else {
      globalMax *= HEADROOM_FACTOR;
    }

    // Derive canonical nodes/links if missing from snapshot
    const sourceNodes = [...day.financialWorkflow.nodes];
    const sourceLinks = [...day.financialWorkflow.links];

    // Use cumulative aggregates as the source of truth
    const totalValue = Math.max(0, day.timelineTick.cumulativeRevenue || 0);
    const platformValue = Math.max(0, day.timelineTick.cumulativeFees || 0);
    const charityValue = Math.max(0, day.timelineTick.cumulativeCharity || 0);
    const playersValue = Math.max(0, day.timelineTick.cumulativePayouts || 0);

    // Update existing nodes with cumulative values
    sourceNodes.forEach((node) => {
      switch (node.id) {
        case "total":
          node.aggregateValue = totalValue;
          break;
        case "platform":
          node.aggregateValue = platformValue;
          break;
        case "charity":
          node.aggregateValue = charityValue;
          break;
        case "players":
          node.aggregateValue = playersValue;
          break;
      }
    });

    // Update existing links with cumulative values
    sourceLinks.forEach((link) => {
      switch (link.id) {
        case "total->platform":
        case "flow-platform":
          link.value = platformValue;
          break;
        case "total->charity":
        case "flow-charity":
          link.value = charityValue;
          break;
        case "total->players":
        case "flow-players":
          link.value = playersValue;
          break;
      }
    });

    // Add missing nodes if they don't exist
    const haveTotal = sourceNodes.some((n) => n.id === "total");
    const havePlatform = sourceNodes.some((n) => n.id === "platform");
    const haveCharity = sourceNodes.some((n) => n.id === "charity");
    const havePlayers = sourceNodes.some((n) => n.id === "players");

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

    // Comparison rings (display-only): attempt to find mid/high scenarios for same charity
    // midScenario/highScenario are ensured/returned by useScenarioComparisons

    const layoutPositions = computePositions(sourceNodes, sourceLinks);
    const positionedNodes: PositionedNode[] = sourceNodes.map((node) => {
      const pos = layoutPositions[node.id] || { x: 80, y: 60 };

      // Base/Mid/High values for this node id
      const collectValue = (
        sc: NormalizedPresentationScenario | undefined,
        id: string,
        overrideIndex?: number
      ) => {
        if (!sc) return undefined;
        const baseIndex = overrideIndex ?? day.dayIndex;
        const idx = Math.min(baseIndex, Math.max(0, sc.duration - 1));
        const d = sc.dayLookup[idx];
        if (!d) return undefined;
        switch (id) {
          case "total":
            return d.timelineTick.cumulativeRevenue || 0;
          case "platform":
            return d.timelineTick.cumulativeFees || 0;
          case "charity":
            return d.timelineTick.cumulativeCharity || 0;
          case "players":
            return d.timelineTick.cumulativePayouts || 0;
          default:
            return undefined;
        }
      };

      const baseValue = node.aggregateValue;
      const midValue = collectValue(midScenario, node.id);
      const highValue = collectValue(highScenario, node.id);

      const midDeltaAmount =
        midValue !== undefined && baseValue !== undefined
          ? midValue - baseValue
          : undefined;
      const highDeltaAmount =
        highValue !== undefined && baseValue !== undefined
          ? highValue - baseValue
          : undefined;

      const previousBaseValue =
        day.dayIndex > 0
          ? collectValue(scenario, node.id, day.dayIndex - 1)
          : undefined;
      const baseDeltaPercent =
        previousBaseValue !== undefined &&
        previousBaseValue !== 0 &&
        baseValue !== undefined
          ? ((baseValue - previousBaseValue) / previousBaseValue) * 100
          : undefined;

      const midDeltaPercent =
        midValue !== undefined && baseValue !== undefined && baseValue !== 0
          ? ((midValue - baseValue) / baseValue) * 100
          : undefined;
      const highDeltaPercent =
        highValue !== undefined && baseValue !== undefined && baseValue !== 0
          ? ((highValue - baseValue) / baseValue) * 100
          : undefined;

      // Comparison mode: 'normalized' (default) or 'delta'
      const comparisonMode: "normalized" | "delta" = "normalized";

      let midSegments: PresentationWorkflowLayer[] | undefined;
      let highSegments: PresentationWorkflowLayer[] | undefined;
      let baseSegmentsOverride: PresentationWorkflowLayer[] | undefined;

      if (comparisonMode === "normalized") {
        const historicalMax = nodeComparisonMax[node.id] ?? 0;
        const immediateMax = Math.max(
          baseValue || 0,
          midValue || 0,
          highValue || 0,
          0
        );
        const baseComparisonMax = Math.max(historicalMax, immediateMax);
        const comparisonMax = Math.max(1, baseComparisonMax * HEADROOM_FACTOR);
        const mkGauge = (
          val: number | undefined,
          max: number,
          color: string,
          key: string
        ): PresentationWorkflowLayer[] | undefined => {
          if (val === undefined || max <= 0) return undefined;
          const filled = Math.max(0, Math.min(val, max));
          const rest = Math.max(0, max - filled);
          return [
            { id: `${key}-filled`, label: "filled", value: filled, color },
            {
              id: `${key}-rest`,
              label: "rest",
              value: rest,
              color: "transparent",
            },
          ];
        };

        const COLORS = {
          base: "#e2e8f0",
          mid: "#38bdf8",
          high: "#a78bfa",
        } as const;
        baseSegmentsOverride = mkGauge(baseValue, comparisonMax, COLORS.base, "base");
        midSegments = mkGauge(midValue, comparisonMax, COLORS.mid, "mid");
        highSegments = mkGauge(highValue, comparisonMax, COLORS.high, "high");

        return {
          ...node,
          x: pos.x,
          y: pos.y,
          radius: DEFAULT_NODE_RADIUS,
          midSegments,
          highSegments,
          baseValue,
          midValue,
          highValue,
          baseDeltaPercent,
          midDeltaPercent,
          highDeltaPercent,
          layers: baseSegmentsOverride ?? node.layers,
          comparisonMax,
        } as PositionedNode;
      } else {
        // Delta mode (previous behavior)
        // For the 'total' node, segment by category deltas (platform/charity/players)
        if (node.id === "total") {
          const byCat = (sc?: NormalizedPresentationScenario) => {
            if (!sc) return undefined;
            const d = sc.dayLookup[day.dayIndex];
            if (!d) return undefined;
            return {
              platform: Math.max(0, d.timelineTick.cumulativeFees || 0),
              charity: Math.max(0, d.timelineTick.cumulativeCharity || 0),
              players: Math.max(0, d.timelineTick.cumulativePayouts || 0),
            };
          };
          const baseCats = byCat(scenario);
          const midCats = byCat(midScenario);
          const highCats = byCat(highScenario);

          const deltaCat = (
            k: "platform" | "charity" | "players",
            cats?: { platform: number; charity: number; players: number }
          ) => {
            if (!cats || !baseCats) return 0;
            return Math.max(0, cats[k] - baseCats[k]);
          };

          const COLORS = {
            platform: "#38bdf8",
            charity: "#f472b6",
            players: "#34d399",
          } as const;

          if (midCats) {
            const m: PresentationWorkflowLayer[] = [];
            const dPlatform = deltaCat("platform", midCats);
            const dCharity = deltaCat("charity", midCats);
            const dPlayers = deltaCat("players", midCats);
            if (dPlatform > 0)
              m.push({
                id: "platform",
                label: "Platform",
                value: dPlatform,
                color: COLORS.platform,
              });
            if (dCharity > 0)
              m.push({
                id: "charity",
                label: "Charity",
                value: dCharity,
                color: COLORS.charity,
              });
            if (dPlayers > 0)
              m.push({
                id: "players",
                label: "Players",
                value: dPlayers,
                color: COLORS.players,
              });
            if (m.length > 0) midSegments = m;
          }
          if (highCats) {
            const h: PresentationWorkflowLayer[] = [];
            const dPlatform = deltaCat("platform", highCats);
            const dCharity = deltaCat("charity", highCats);
            const dPlayers = deltaCat("players", highCats);
            if (dPlatform > 0)
              h.push({
                id: "platform",
                label: "Platform",
                value: dPlatform,
                color: COLORS.platform,
              });
            if (dCharity > 0)
              h.push({
                id: "charity",
                label: "Charity",
                value: dCharity,
                color: COLORS.charity,
              });
            if (dPlayers > 0)
              h.push({
                id: "players",
                label: "Players",
                value: dPlayers,
                color: COLORS.players,
              });
            if (h.length > 0) highSegments = h;
          }
        } else {
          // For other nodes, single segment using node primary color
          const baseLayer = (node.layers && node.layers[0]) || undefined;
          const defaultSeg =
            baseLayer ||
            ({
              id: "value",
              label: "Value",
              color: "#64748b",
              value: 0,
            } as PresentationWorkflowLayer);
          if (midDeltaAmount !== undefined && midDeltaAmount > 0) {
            midSegments = [
              {
                id: defaultSeg.id,
                label: defaultSeg.label,
                value: midDeltaAmount,
                color: defaultSeg.color,
              },
            ];
          }
          if (highDeltaAmount !== undefined && highDeltaAmount > 0) {
            highSegments = [
              {
                id: defaultSeg.id,
                label: defaultSeg.label,
                value: highDeltaAmount,
                color: defaultSeg.color,
              },
            ];
          }
        }
      }

      return {
        ...node,
        x: pos.x,
        y: pos.y,
        radius: DEFAULT_NODE_RADIUS,
        midSegments,
        highSegments,
        baseValue,
        midValue,
        highValue,
        baseDeltaPercent,
        midDeltaPercent,
        highDeltaPercent,
        layers: baseSegmentsOverride ?? node.layers,
        comparisonMax: nodeComparisonMax[node.id],
      } as PositionedNode;
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
  }, [day, scenario, midScenario, highScenario]);
}
