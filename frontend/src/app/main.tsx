import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css"; // у TailAdmin це src/index.css — підлаштуйте шлях
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
