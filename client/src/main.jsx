// Imported first and deliberately has a module-load side effect: attaches
// the beforeinstallprompt listener before anything else runs, since that
// event can fire very early and must not be missed (see the module for why
// this can't just live inside the component that shows the install button).
import "./lib/pwaInstall";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "katex/dist/katex.min.css";
import "./styles/index.css";

// No-op during `npm run dev` (devOptions.enabled: false in vite.config.js);
// registers the generated service worker in production builds.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
