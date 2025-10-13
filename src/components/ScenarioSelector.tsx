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
  variant?: "card" | "inline";
}

const ScenarioSelector = ({
  scenarios,
  selectedScenarioId,
  onScenarioChange,
  disabled = false,
  variant = "card",
}: ScenarioSelectorProps) => {
  const handleScenarioClick = useCallback(
    (scenarioId: string) => {
      if (!disabled) {
        onScenarioChange(scenarioId);
      }
    },
    [disabled, onScenarioChange]
  );

  if (variant === "inline") {
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-lg border border-slate-800/60 bg-slate-900/40 px-3 py-2 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <span className="text-[10px] uppercase tracking-[0.28em] text-slate-400">
          Scenario
        </span>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => handleScenarioClick(scenario.id)}
              disabled={disabled}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
                selectedScenarioId === scenario.id
                  ? "bg-slate-100 text-slate-900"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100"
              }`}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

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
