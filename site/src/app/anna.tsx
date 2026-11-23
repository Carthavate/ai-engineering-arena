import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createAnnaRte } from "../bsw/anna";
import { connectAnna } from "../bsw/anna/host";
import { Root } from "./Root";

/** Composition root of the Anna app: connect to Anna, build its basic software, then run the same App. */
export async function startAnnaApp(element: HTMLElement): Promise<void> {
  element.textContent = "Loading the Arena…";
  try {
    const host = await connectAnna();
    const rte = await createAnnaRte(host);
    createRoot(element).render(
      <StrictMode>
        <Root create={() => rte} />
      </StrictMode>,
    );
  } catch (e) {
    console.error("The Arena couldn't start in Anna", e);
    element.textContent = "The Arena couldn't connect to Anna. Close this window and open the app again.";
  }
}
