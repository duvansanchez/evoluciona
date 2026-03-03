// Polyfill: crypto.randomUUID no está disponible en HTTP (contextos no seguros).
// Se usa crypto.getRandomValues que sí está disponible en HTTP.
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  (crypto as any).randomUUID = function () {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: string) => {
      const n = parseInt(c);
      return (n ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4)))).toString(16);
    });
  };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
