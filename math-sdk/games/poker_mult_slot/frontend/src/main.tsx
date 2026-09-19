import { createRoot } from "react-dom/client";
import App from "./App";
import { applyLiteFxClass } from "./game/fxMode";
import "./index.css";
import "./noir.css";

applyLiteFxClass();

// No StrictMode — double-mounting was able to race wallet updates in dev.
createRoot(document.getElementById("root")!).render(<App />);
