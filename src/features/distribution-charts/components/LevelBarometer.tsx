import { useState } from "react";
import {
  useLevelBarometer,
  type LevelScenarioKey,
} from "../hooks/useLevelBarometer";

export function LevelBarometer() {
  const { series, activeDayIndex } = useLevelBarometer();
  const [selectedScenario, setSelectedScenario] =
    useState<LevelScenarioKey>("base");

  // Get available scenarios for the toggle buttons
  const availableScenarios = series.map((s) => s.key);

  // Set default to first available scenario if current selection is not available
  if (
    availableScenarios.length > 0 &&
    !availableScenarios.includes(selectedScenario)
  ) {
    setSelectedScenario(availableScenarios[0]);
  }

  const selectedSeries = series.find((s) => s.key === selectedScenario);

  if (series.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500">
        <p>No level data available for day {activeDayIndex + 1}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          Level Retention Analysis
        </h3>
        <span className="text-sm text-slate-400">Day {activeDayIndex + 1}</span>
      </div>

      {/* Scenario Toggle Buttons */}
      <div className="flex gap-2">
        {availableScenarios.map((scenarioKey) => {
          const scenario = series.find((s) => s.key === scenarioKey);
          return (
            <button
              key={scenarioKey}
              onClick={() => setSelectedScenario(scenarioKey)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                selectedScenario === scenarioKey
                  ? "bg-slate-700 text-slate-100"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
              }`}
            >
              {scenario?.label || scenarioKey.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Selected Scenario Display */}
      {selectedSeries && (
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-slate-200">
            {selectedSeries.label}
          </h4>

          <div className="grid grid-cols-5 gap-3">
            {selectedSeries.steps.map((step) => (
              <div
                key={step.level}
                className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-center"
              >
                <div className="text-xs font-medium text-slate-400 mb-1">
                  Level {step.level}
                </div>

                <div className="space-y-2">
                  <div className="text-lg font-semibold text-slate-100">
                    {step.gamesPlayed.toLocaleString()}
                  </div>

                  <div className="text-xs text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Progress:</span>
                      <span className="text-green-400">
                        {step.progressions.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Cashout:</span>
                      <span className="text-yellow-400">
                        {step.cashouts.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Survival:</span>
                      <span className="text-blue-400">
                        {(step.survivalRate * 100).toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Retention:</span>
                      <span className="text-purple-400">
                        {(step.retentionRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
