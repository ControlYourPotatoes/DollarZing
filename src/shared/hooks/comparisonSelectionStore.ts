import { create } from "zustand";

interface ComparisonSelectionState {
  midScenarioId: string | null;
  highScenarioId: string | null;
  setMidScenarioId: (id: string | null) => void;
  setHighScenarioId: (id: string | null) => void;
  clearSelections: () => void;
}

export const useComparisonSelectionStore = create<ComparisonSelectionState>()(
  (set) => ({
    midScenarioId: null,
    highScenarioId: null,
    setMidScenarioId: (id) => set({ midScenarioId: id }),
    setHighScenarioId: (id) => set({ highScenarioId: id }),
    clearSelections: () => set({ midScenarioId: null, highScenarioId: null }),
  })
);

