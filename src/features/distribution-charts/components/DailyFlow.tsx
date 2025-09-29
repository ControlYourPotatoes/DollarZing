import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DollarSign, Heart, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { useActiveTimelineScenario } from "@/features/timeline";
import { useScenarioComparisons } from "@/shared/hooks/useScenarioComparisons";
import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";

interface FlowItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface ScenarioData {
  key: "base" | "mid" | "high";
  label: string;
  color: string;
  total: number;
  items: FlowItem[];
  trends: Record<string, 'up' | 'down' | 'same'>;
}

const SCENARIO_COLORS = {
  base: "#0ea5e9", // sky-500
  mid: "#10b981", // emerald-500
  high: "#f59e0b", // amber-500
};

export function DailyFlow() {
  const baseScenario = useActiveTimelineScenario();
  const { mid: midScenario, high: highScenario } = useScenarioComparisons();
  const activeDayIndex = usePresentationTimelineStore(
    (state) => state.activeDayIndex
  );
  const hoveredRingKey = usePresentationTimelineStore(
    (state) => state.hoveredRingKey
  );

  const scenariosData = useMemo(() => {
    const scenarios: ScenarioData[] = [];

    const addScenario = (
      key: "base" | "mid" | "high",
      scenario: any,
      label: string
    ) => {
      if (!scenario?.days?.[activeDayIndex]) return;

      const day = scenario.days[activeDayIndex];
      const prevDay = scenario.days[activeDayIndex - 1];
      const total =
        day.summary.dailyFees +
        day.summary.dailyCharity +
        day.summary.dailyPayouts;

      const items: FlowItem[] = [
        {
          id: "fees",
          label: "Platform Fees",
          value: day.summary.dailyFees,
          color: "#f59e0b", // amber-500
        },
        {
          id: "charity",
          label: "Charity",
          value: day.summary.dailyCharity,
          color: "#10b981", // emerald-500
        },
        {
          id: "payouts",
          label: "Player Payouts",
          value: day.summary.dailyPayouts,
          color: "#8b5cf6", // violet-500
        },
      ];

      const trends: Record<string, 'up' | 'down' | 'same'> = {};
      if (prevDay) {
        trends.fees = day.summary.dailyFees > prevDay.summary.dailyFees ? 'up' : day.summary.dailyFees < prevDay.summary.dailyFees ? 'down' : 'same';
        trends.charity = day.summary.dailyCharity > prevDay.summary.dailyCharity ? 'up' : day.summary.dailyCharity < prevDay.summary.dailyCharity ? 'down' : 'same';
        trends.payouts = day.summary.dailyPayouts > prevDay.summary.dailyPayouts ? 'up' : day.summary.dailyPayouts < prevDay.summary.dailyPayouts ? 'down' : 'same';
      }

      scenarios.push({
        key,
        label,
        color: SCENARIO_COLORS[key],
        total,
        items,
        trends,
      });
    };

    addScenario("base", baseScenario, "Base Scenario");
    addScenario("mid", midScenario, "Mid Scenario");
    addScenario("high", highScenario, "High Scenario");

    return scenarios;
  }, [baseScenario, midScenario, highScenario, activeDayIndex]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}k`;
    } else {
      return amount.toFixed(0);
    }
  };

  if (scenariosData.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-slate-500">
        <p>No flow data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {scenariosData.map((scenario, index) => (
        <div key={scenario.key}>
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-sm font-semibold uppercase tracking-widest"
              style={{ color: scenario.color }}
            >
              {scenario.label}
            </span>
            {hoveredRingKey === scenario.key && (
              <div className="flex items-center gap-1">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: scenario.color }}
                />
                <span className="text-xs text-slate-400">Active</span>
              </div>
            )}
          </div>

          <motion.div
            className={`rounded-lg p-2 transition-all duration-200 ${
              hoveredRingKey === scenario.key
                ? "border border-sky-400 shadow-[0_0_20px_-5px_rgba(14,165,233,0.5)]"
                : "border border-transparent"
            }`}
            animate={{
              borderColor: hoveredRingKey === scenario.key ? "#0ea5e9" : "transparent",
              boxShadow: hoveredRingKey === scenario.key ? "0 0 20px -5px rgba(14,165,233,0.5)" : "none",
            }}
            transition={{ duration: 0.2 }}
          >
            <div className="grid grid-cols-4 gap-2">
              {/* Total Card */}
              <div className="rounded-md border border-slate-600 bg-slate-800/50 p-2 text-center shadow-sm">
                <span className="text-xs uppercase tracking-widest text-slate-400 block mb-1">
                  Total
                </span>
                <div className="flex items-center justify-center">
                  <DollarSign className="w-3 h-3 text-slate-400 mr-1" />
                  <p className="text-sm font-semibold text-slate-100">
                    {formatNumber(scenario.total)}
                  </p>
                </div>
              </div>

              {/* Distribution Cards */}
              {scenario.items.map((item) => {
                const [isHovered, setIsHovered] = useState(false);
                const Icon = item.id === 'fees' ? DollarSign : item.id === 'charity' ? Heart : TrendingUp;
                return (
                  <motion.div
                    key={item.id}
                    className="rounded-md border bg-slate-800/50 p-2 shadow-sm cursor-pointer"
                    style={{
                      borderColor: item.color,
                      boxShadow: `0 0 10px -5px ${item.color}20`,
                    }}
                    whileHover={{
                      scale: 1.05,
                      borderColor: "#0ea5e9",
                      boxShadow: "0 0 20px -5px rgba(14,165,233,0.5)",
                    }}
                    onHoverStart={() => setIsHovered(true)}
                    onHoverEnd={() => setIsHovered(false)}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-center mb-1">
                      <Icon className="w-3 h-3 text-slate-400 mr-1" />
                      <span className="text-xs uppercase tracking-widest text-slate-400">
                        {item.id === 'fees' ? 'Fee' : item.id === 'charity' ? 'Char' : 'Pay'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center">
                        <span className="text-xs font-semibold text-slate-100">
                          {isHovered ? formatCurrency(item.value) : formatNumber(item.value)}
                        </span>
                        {scenario.trends[item.id] && scenario.trends[item.id] !== 'same' && (
                          <div className="ml-1">
                            {scenario.trends[item.id] === 'up' ? (
                              <ArrowUp className="w-3 h-3 text-green-500" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {Math.round((item.value / scenario.total) * 100)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {index < scenariosData.length - 1 && (
            <hr className="mt-4 border-slate-700" />
          )}
        </div>
      ))}
    </div>
  );
}
