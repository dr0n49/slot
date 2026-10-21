import "@fontsource/outfit/400.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// Dev page for the character rig: ?qa=character (see src/qa/CharacterQA.tsx).
const CharacterQA = lazy(() => import("./qa/CharacterQA"));
const qa = new URLSearchParams(location.search).get("qa");

createRoot(document.getElementById("root")!).render(
  qa === "character" ? (
    <Suspense fallback={null}>
      <CharacterQA />
    </Suspense>
  ) : (
    <App />
  ),
);
