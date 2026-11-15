import { useEffect, useState } from "react";
import { EXAMPLE_QUESTIONS } from "../../../logic/lab/ragToy";
import { href } from "../../../logic/route";
import { stepAt, TOURS, type PartId, type TourMode } from "../../../logic/lab/ragTour";
import { RagInspector } from "./RagInspector";
import { RagScene } from "./RagScene";
import { RagTryIt } from "./RagTryIt";
import { PanelTabs, Walkthrough, type Tab } from "./RagWalkthrough";
import "../blueprint.css";
import "./howRag.css";

/** How long autoplay stays on each step. Long enough to read the step's two sentences. */
const AUTOPLAY_MS = 3200;

/** The Lab's "How RAG works": a drawing of a RAG system to inspect part by part, a guided walkthrough, and a toy pipeline to try. */
export function HowRagWorks() {
  const [tab, setTab] = useState<Tab>("walk");
  const [mode, setMode] = useState<TourMode>("query");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inspected, setInspected] = useState<PartId | null>(null);
  const [asked, setAsked] = useState<string | null>(null);
  const [retrievalOn, setRetrievalOn] = useState(true);
  const tourStep = stepAt(mode, step);

  // Autoplay: next step every few seconds, stopping on the last one.
  useEffect(() => {
    if (!playing) return;
    if (step >= TOURS[mode].length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setStep((i) => i + 1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [playing, step, mode]);

  const changeTab = (t: Tab) => {
    if (t !== "walk") setPlaying(false);
    setTab(t);
  };
  // The "Without RAG" tour and the Try it switch are the same switch, so the drawing never contradicts itself.
  const changeMode = (m: TourMode) => {
    setMode(m);
    setStep(0);
    if (m !== "index") setRetrievalOn(m === "query");
  };
  // A Try it run lights the whole path it took: retrieval on → the RAG flow, off → straight to the LLM.
  const showPath = (on: boolean) => {
    setPlaying(false);
    setMode(on ? "query" : "norag");
    setStep(TOURS[on ? "query" : "norag"].length - 1);
  };
  const ask = (question: string) => {
    setAsked(question);
    showPath(retrievalOn);
  };
  const switchRetrieval = (on: boolean) => {
    setRetrievalOn(on);
    if (asked) showPath(on);
  };

  const state = { question: asked ?? EXAMPLE_QUESTIONS[0].text, retrievalOn };

  return (
    <div className="playground">
      <p className="banner info">
        Hover any part of the drawing to see what it does and what it holds, walk through indexing time and query time step by step,
        then switch retrieval off and watch the model guess. Nothing downloads: it all runs on this page.
        Goes with <a href={href({ page: "lesson", lesson: "rag-1" })}>lesson #1: What is RAG?</a>
      </p>
      <section className="panel how-rag blueprint" aria-labelledby="how-rag-title">
        <div className="panel-head">
          <h2 id="how-rag-title" className="panel-title">How RAG works</h2>
          <span className="muted small-text">Retrieval-augmented generation, one part at a time</span>
        </div>
        <RagScene litParts={new Set(tourStep.parts)} litEdges={new Set(tourStep.edges)} stepKey={`${mode}-${step}`}
          inspected={inspected} onInspect={setInspected} grounded={retrievalOn} />
        <div className="how-rag-below">
          <RagInspector inspected={inspected} onInspect={setInspected} state={state} />
          <aside className="play-panel">
            <PanelTabs tab={tab} onTab={changeTab} />
            {/* Both panels stay mounted (hidden when inactive), so a Try it run survives a look at the walkthrough. */}
            <div className="play-tabpanel" id="play-panel-walk" role="tabpanel" aria-labelledby="play-tab-walk" hidden={tab !== "walk"}>
              <Walkthrough mode={mode} step={step} playing={playing} onMode={changeMode} onStep={(i) => { setPlaying(false); setStep(i); }} onPlaying={setPlaying} />
            </div>
            <div className="play-tabpanel" id="play-panel-try" role="tabpanel" aria-labelledby="play-tab-try" hidden={tab !== "try"}>
              <RagTryIt asked={asked} retrievalOn={retrievalOn} onAsk={ask} onRetrieval={switchRetrieval} />
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
