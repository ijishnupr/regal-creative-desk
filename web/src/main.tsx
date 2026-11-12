import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AuthProvider } from "./auth";
import { ToastProvider } from "./components/ui";
import "./styles.css";

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || undefined}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Fade out the inline splash once React has painted.
requestAnimationFrame(() => {
  const s = document.getElementById("splash");
  if (s) { s.style.opacity = "0"; setTimeout(() => s.remove(), 400); }
});
