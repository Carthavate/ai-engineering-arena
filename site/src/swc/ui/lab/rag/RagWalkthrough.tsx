import { useRef, type KeyboardEvent } from "react";
import { STAGE_LABELS, stepAt, TOUR_LABELS, TOUR_MODES, TOURS, type TourMode } from "../../../logic/lab/ragTour";

export type Tab = "walk" | "try";
const TABS: readonly (readonly [Tab, string])[] = [["walk", "Walkthrough"], ["try", "Try it"]];

interface WalkProps {
  readonly mode: TourMode;
  readonly step: number;
  readonly playing: boolean;
  readonly onMode: (m: TourMode) => void;
  readonly onStep: (i: number) => void;
  readonly onPlaying: (p: boolean) => void;
}

export function Walkthrough({ mode, step, playing, onMode, onStep, onPlaying }: WalkProps) {
  const tour = TOURS[mode];
  const s = stepAt(mode, step);
  const last = step >= tour.length - 1;
  return (
    <div className="play-copy">
      <div className="seg" role="group" aria-label="Which part of the flow">
        {TOUR_MODES.map((m) => (
          <button key={m} type="button" className={m === mode ? "is-on" : ""} aria-pressed={m === mode} onClick={() => onMode(m)}>{TOUR_LABELS[m]}</button>
        ))}
      </div>
      <p className={`play-stage stage-${s.stage}`}>{STAGE_LABELS[s.stage]}</p>
      {/* Announce steps the user moves to, not every autoplay tick. */}
      <div aria-live={playing ? "off" : "polite"}>
        <h3>{step + 1}. {s.title}</h3>
        <p>{s.text}</p>
      </div>
      <div className="walk-controls">
        <button type="button" className="btn btn-ghost btn-small" disabled={step === 0} onClick={() => onStep(step - 1)} aria-label="Previous step">←</button>
        <button type="button" className="btn btn-primary btn-small" onClick={() => (last && !playing ? (onStep(0), onPlaying(true)) : onPlaying(!playing))}>
          {playing ? "Pause" : last ? "Replay" : "Play"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={last} onClick={() => onStep(step + 1)} aria-label="Next step">→</button>
        <span className="walk-dots" role="group" aria-label={`Step ${step + 1} of ${tour.length}`}>
          {tour.map((t, i) => <button key={t.title} type="button" className={i === step ? "is-on" : ""} onClick={() => onStep(i)} aria-label={`Step ${i + 1}: ${t.title}`} aria-current={i === step ? "step" : undefined} />)}
        </span>
      </div>
    </div>
  );
}

/** Tabs with arrow-key, Home and End navigation (WAI-ARIA tabs pattern, automatic activation). */
export function PanelTabs({ tab, onTab }: { readonly tab: Tab; readonly onTab: (t: Tab) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex(([id]) => id === tab);
    const to = e.key === "ArrowRight" ? (i + 1) % TABS.length
      : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? TABS.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    e.stopPropagation();
    onTab(TABS[to][0]);
    refs.current[to]?.focus();
  };
  return (
    <div className="play-tabs" role="tablist" aria-label="Explorer panels" onKeyDown={onKeyDown}>
      {TABS.map(([id, label], i) => (
        <button key={id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`play-tab-${id}`}
          aria-selected={tab === id} aria-controls={`play-panel-${id}`} tabIndex={tab === id ? 0 : -1}
          className={tab === id ? "is-on" : ""} onClick={() => onTab(id)}>{label}</button>
      ))}
    </div>
  );
}

