// Entry of the Anna app build (anna.html). The website's entry is main.tsx.
import "@fontsource/lilita-one";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/400-italic.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import { startAnnaApp } from "./app/anna";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in anna.html");
void startAnnaApp(root);
