import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <main>Law Analyzer</main>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
