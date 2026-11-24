import { useState } from "react";
import type { Rte } from "../rte/ports";
import { RteProvider } from "../rte/RteContext";
import { App } from "./App";

interface RootProps {
  /** Builds the basic software: the website's (main.tsx) or the Anna app's (app/anna.tsx). */
  readonly create: () => Rte;
}

/** Composition root (the "ECU configuration"): wires the basic software into the RTE once. */
export function Root({ create }: RootProps) {
  const [rte] = useState(create);
  return (
    <RteProvider rte={rte}>
      <App />
    </RteProvider>
  );
}
