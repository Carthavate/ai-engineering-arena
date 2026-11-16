import type { KeyboardEvent } from "react";
import { captionOf, EDGES, PARTS, type EdgeId, type PartId } from "../../../logic/lab/ragTour";
import { LABEL_DY, LANES, NOTES, PartDrawing, ROUTES, routePath, SHEET, SPOTS } from "./ragDrawing";

/** Arrowhead length and half-width, in sheet pixels. */
const ARROW_LEN = 10;
const ARROW_HALF = 5.5;

interface Props {
  readonly litParts: ReadonlySet<PartId>;
  readonly litEdges: ReadonlySet<EdgeId>;
  /** Changes on every tour step, so lit wires draw themselves in again. */
  readonly stepKey: string;
  /** The part shown in the inspector. */
  readonly inspected: PartId | null;
  readonly onInspect: (id: PartId | null) => void;
  /** Whether the answer is grounded (tick) or a guess (cross). */
  readonly grounded: boolean;
}

/** A solid arrowhead at the end of a route, pointing along its last segment. */
function ArrowHead({ edge, className }: { readonly edge: EdgeId; readonly className: string }) {
  const route = ROUTES[edge];
  const [x2, y2] = route[route.length - 1];
  const [x1, y1] = route[route.length - 2];
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  const bx = x2 - dx * ARROW_LEN;
  const by = y2 - dy * ARROW_LEN;
  const pts = `${x2},${y2} ${bx - dy * ARROW_HALF},${by + dx * ARROW_HALF} ${bx + dy * ARROW_HALF},${by - dx * ARROW_HALF}`;
  return <polygon className={className} points={pts} />;
}

/** The drawing: hover, focus or click a part to inspect it; lit wires draw themselves in as the tour moves. */
export function RagScene({ litParts, litEdges, stepKey, inspected, onInspect, grounded }: Props) {
  const onPartKey = (id: PartId) => (e: KeyboardEvent<SVGGElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onInspect(id);
  };
  const onSheetKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && inspected) onInspect(null);
  };

  return (
    <div className="scene-sheet" onKeyDown={onSheetKey}>
      <svg className="scene-svg" viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} role="group"
        aria-label="Diagram of a RAG system. Each part is a button; focus one to inspect it below the drawing.">
        <defs>
          <pattern id="rag-grid" width={20} height={20} patternUnits="userSpaceOnUse">
            <path d="M20,0 H0 V20" className="grid-line" />
          </pattern>
        </defs>
        <rect className="paper" width={SHEET.w} height={SHEET.h} onClick={() => onInspect(null)} />
        <rect width={SHEET.w} height={SHEET.h} fill="url(#rag-grid)" pointerEvents="none" />
        {LANES.map((l) => (
          <g key={l.label} className="lane" pointerEvents="none">
            <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={12} />
            <text x={l.x + 14} y={l.y + 22}>{l.label}</text>
          </g>
        ))}
        {NOTES.map((n) => <text key={n.text} className="sheet-note" x={n.x} y={n.y} textAnchor="end" pointerEvents="none">{n.text}</text>)}

        <g pointerEvents="none">
          {EDGES.map((e) => (
            <g key={e.id} className={`wire${e.id === "question-llm" ? " wire-norag" : ""}`}>
              <path d={routePath(ROUTES[e.id])} />
              <ArrowHead edge={e.id} className="arrow" />
            </g>
          ))}
          {/* Lit wires: a stroke that draws itself in over the base wire, then its arrowhead. Keyed by step to replay. */}
          {EDGES.filter((e) => litEdges.has(e.id)).map((e) => (
            <g key={`${stepKey}-${e.id}`} className={`wire-lit${e.id === "question-llm" ? " wire-lit-norag" : ""}`}>
              <path d={routePath(ROUTES[e.id])} pathLength={1} />
              <ArrowHead edge={e.id} className="arrow" />
            </g>
          ))}
        </g>

        {PARTS.map((part) => {
          const { x, y } = SPOTS[part.id];
          const cls = `part${litParts.has(part.id) ? " is-lit" : ""}${inspected === part.id ? " is-inspected" : ""}`;
          return (
            <g key={part.id} className={cls} transform={`translate(${x} ${y})`}
              role="button" tabIndex={0} aria-pressed={inspected === part.id} aria-controls="rag-inspector"
              aria-label={`${part.label}: ${captionOf(part, grounded)}`}
              onPointerEnter={() => onInspect(part.id)} onFocus={() => onInspect(part.id)}
              onClick={() => onInspect(part.id)} onKeyDown={onPartKey(part.id)}>
              <rect className="hit" x={-62} y={-52} width={124} height={52 + LABEL_DY + 12} rx={10} />
              <g className="shadow" transform="translate(4 4)"><PartDrawing id={part.id} answerOk={grounded} /></g>
              <PartDrawing id={part.id} answerOk={grounded} />
              <text className="part-label" y={LABEL_DY} textAnchor="middle">{part.label.toUpperCase()}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
