import { useCallback } from "react";

interface Scenario {
  id: string;
  growth: number;
  risk: string;
  charity: number;
  role: "base" | "mid" | "high";
  label: string;
}

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  selectedScenarioId: string;
  onScenarioChange: (scenarioId: string) => void;
  disabled?: boolean;
}

const ScenarioSelector = ({
  scenarios,
  selectedScenarioId,
  onScenarioChange,
  disabled = false,
}: ScenarioSelectorProps) => {
  const handleScenarioClick = useCallback(
    (scenarioId: string) => {
      if (!disabled) {
        onScenarioChange(scenarioId);
      }
    },
    [disabled, onScenarioChange]
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <span className="block text-xs uppercase tracking-widest text-slate-400 mb-3">
        Active Scenario
      </span>
      <div className="flex gap-3">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            onClick={() => handleScenarioClick(scenario.id)}
            disabled={disabled}
            className={`flex-1 rounded-lg border px-4 py-3 text-center transition-colors ${
              selectedScenarioId === scenario.id
                ? "border-sky-500 bg-sky-500/10 text-sky-400"
                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="text-sm font-semibold uppercase tracking-wider mb-1">
              {scenario.label}
            </div>
            <div className="text-xs text-slate-400">
              {scenario.growth}% growth
            </div>
            <div className="text-xs text-slate-400">
              {scenario.risk} risk · {scenario.charity}% charity
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScenarioSelector;