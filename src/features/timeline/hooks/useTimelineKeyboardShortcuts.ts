import { useEffect } from "react";

import { usePresentationTimelineStore } from "@/shared/hooks/presentationTimelineStore";

export function useTimelineKeyboardShortcuts(enabled = true): void {
  const stepDay = usePresentationTimelineStore((state) => state.stepDay);
  const setPlaybackState = usePresentationTimelineStore((state) => state.setPlaybackState);
  const isPlaying = usePresentationTimelineStore((state) => state.isPlaying);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case " ":
        case "Spacebar": {
          event.preventDefault();
          setPlaybackState(!isPlaying);
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          stepDay(1);
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          stepDay(-1);
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, isPlaying, setPlaybackState, stepDay]);
}

