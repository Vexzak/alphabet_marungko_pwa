import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const analyticsEndpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT as string | undefined;
const analyticsWebsiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID as string | undefined;

if (analyticsEndpoint && analyticsWebsiteId) {
  const script = document.createElement("script");
  script.defer = true;
  script.src = `${analyticsEndpoint.replace(/\/+$/, "")}/umami`;
  script.setAttribute("data-website-id", analyticsWebsiteId);
  document.head.appendChild(script);
}

// Register Service Worker for offline PWA functionality in production only.
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.log("Service Worker registration failed:", err);
      });
    });
  } else {
    // In dev, remove existing SW so UI changes are not served from old cache.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    });
  }
}

createRoot(document.getElementById("root")!).render(<App />);
