import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./app/Root";
import { createRte } from "./bsw";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
  <StrictMode>
    <Root create={createRte} />
  </StrictMode>,
);
