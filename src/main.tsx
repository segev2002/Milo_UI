import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-day-picker/style.css";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
