import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface TimelinePoint {
  id: string;
  label: string;
  netPayouts: number;
  totalCharity: number;
  totalFees: number;
}

interface TimelineScrubberProps {
  data: TimelinePoint[];
  activeIndex: number;
  onChange: (index: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

const TimelineScrubber = ({ data, activeIndex, onChange, isPlaying, onPlayToggle }: TimelineScrubberProps) => {
  const progress = data.length > 1 ? (activeIndex / (data.length - 1)) * 100 : 0;
  const current = data[activeIndex];
  const next = data[(activeIndex + 1) % data.length];
  const controlRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);
  const [tickPulse, setTickPulse] = useState(0);
  const [tickShift, setTickShift] = useState(0);
  const [tickOffset, setTickOffset] = useState(0);
  const directionTimeoutRef = useRef<number>();
  const previousIndexRef = useRef(activeIndex);

  const gestureStartRef = useRef<number | null>(null);

  const stepTo = useCallback(
    (delta: number) => {
      if (delta === 0) return;
      const target = Math.min(Math.max(activeIndex + delta, 0), data.length - 1);
      if (target === activeIndex) return;
      const dir = delta > 0 ? 'forward' : 'backward';
      setDirection(dir);
      setTickPulse((prev) => prev + 1);
      setTickOffset((prev) => prev + (delta > 0 ? 1 : -1));
      onChange(target);
    },
    [activeIndex, data.length, onChange],
  );

  const handleDragStart = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest('button')) {
        return;
      }
      event.preventDefault();
      setIsDragging(true);
      gestureStartRef.current = event.clientX;

      const threshold = Math.max(controlRef.current?.offsetWidth ?? 0, 360) / 20;

      const handleMove = (moveEvent: PointerEvent) => {
        if (gestureStartRef.current === null) return;
        const delta = moveEvent.clientX - gestureStartRef.current;
        if (delta > threshold) {
          gestureStartRef.current = moveEvent.clientX;
          stepTo(1);
        } else if (delta < -threshold) {
          gestureStartRef.current = moveEvent.clientX;
          stepTo(-1);
        }
      };

      const handleUp = () => {
        setIsDragging(false);
        gestureStartRef.current = null;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp, { once: true });
    },
    [stepTo],
  );

  useEffect(() => {
    const previous = previousIndexRef.current;
    if (previous !== activeIndex) {
      setDirection(activeIndex > previous ? 'forward' : 'backward');
      setTickPulse((prev) => prev + 1);
      if (directionTimeoutRef.current) {
        window.clearTimeout(directionTimeoutRef.current);
      }
      directionTimeoutRef.current = window.setTimeout(() => setDirection(null), 200);
      previousIndexRef.current = activeIndex;
    }
  }, [activeIndex]);

  useEffect(
    () => () => {
      if (directionTimeoutRef.current) {
        window.clearTimeout(directionTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!direction) {
      return;
    }
    const offset = direction === 'forward' ? -16 : 16;
    setTickShift(offset);
    const raf = window.requestAnimationFrame(() => setTickShift(0));
    return () => window.cancelAnimationFrame(raf);
  }, [direction, tickPulse]);

  const containerStyle = useMemo(() => {
    const accent = 'rgba(14,165,233,0.18)';
    const base = 'rgba(15,23,42,0.92)';
    return {
      background: `linear-gradient(90deg, ${accent} ${progress}%, ${base} ${progress}%)`,
    };
  }, [progress]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-40 w-full max-w-3xl -translate-x-1/2 px-4">
      <div
        ref={controlRef}
        className={`pointer-events-auto flex cursor-grab flex-col gap-3 rounded-2xl border border-slate-800 p-4 shadow-2xl shadow-sky-900/20 backdrop-blur ${
          isDragging ? 'cursor-grabbing ring-1 ring-sky-400/60' : ''
        }`}
        style={containerStyle}
        onPointerDown={handleDragStart}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPlayToggle}
              className={`flex size-10 items-center justify-center rounded-full border border-slate-700 text-sm font-semibold transition ${
                isPlaying ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest text-slate-500">Current Snapshot</p>
              <p className="text-lg font-semibold text-slate-100">{current?.label ?? '—'}</p>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-xs uppercase tracking-widest text-slate-500">Next</p>
            <p className="text-sm font-semibold text-slate-300">{next?.label ?? '—'}</p>
          </div>
        </div>

        <div className="relative">
          <div className="relative mt-4 h-5 overflow-hidden">
            <div
              className="absolute inset-0 flex text-[9px] uppercase tracking-[0.25em] text-slate-500 transition-transform duration-250 ease-out"
              style={{ transform: `translateX(${tickShift}px)` }}
            >
              {data.map((point, index) => {
                const showLabel = index === 0 || index === data.length - 1 || data.length <= 4;
                const active = index === activeIndex;
                const tickIndex = tickOffset + index;
                return (
                  <div
                    key={`tick-${point.id}-${tickOffset}`}
                    className={`relative flex w-full max-w-[72px] flex-1 flex-col items-center gap-1 transition-colors ${
                      active ? 'text-sky-100' : 'text-slate-500'
                    }`}
                    style={{ transform: `translateX(${tickIndex * 20}px)` }}
                  >
                    <span
                      className={`block h-3 w-[1px] ${
                        index <= activeIndex ? 'bg-sky-400' : 'bg-slate-700'
                      }`}
                    />
                    {showLabel ? <span className="text-[9px] tracking-[0.35em]">{point.label}</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineScrubber;
