import "./fonts/fonts.css";
import { recordDiagnostic, supportAddress } from "./support/diagnostics";
import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/400-italic.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/courier-prime/700-italic.css";
import App from "./App";
import { isWriteShape } from "./product";
import "./styles.css";
import "./mobile-settings.css";
import "./writeshape-ui.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>{isWriteShape ? "WriteShape" : "Fountain Publisher"}</h1>
        <p>
          The workspace could not open. Your saved recovery drafts have been
          kept.
        </p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>Try again</button>
        {isWriteShape && (
          <p>
            <a
              href={`mailto:${supportAddress}?subject=WriteShape%20could%20not%20open`}
            >
              Report this problem
            </a>
          </p>
        )}
      </main>
    ) : (
      this.props.children
    );
  }
}
if (isWriteShape) {
  document.documentElement.dataset.product = "writeshape";
  window.addEventListener("error", () => recordDiagnostic("app-error"));
  window.addEventListener("unhandledrejection", () =>
    recordDiagnostic("unhandled-promise"),
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const registerOfflineShell = () => {
    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .catch((error: unknown) => {
        // A failed network/cache install must never interrupt writing or local saves.
        console.warn(
          "Offline support could not finish installing; it will retry on the next visit.",
          error,
        );
      });
  };
  if (document.readyState === "complete") registerOfflineShell();
  else window.addEventListener("load", registerOfflineShell, { once: true });
}
