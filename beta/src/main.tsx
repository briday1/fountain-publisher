import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/courier-prime/400.css";
import "@fontsource/courier-prime/400-italic.css";
import "@fontsource/courier-prime/700.css";
import "@fontsource/courier-prime/700-italic.css";
import App from "./App";
import "./styles.css";
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
        <h1>Fountain Publisher</h1>
        <p>
          The workspace could not open. Your saved recovery drafts have been
          kept.
        </p>
        <pre>{this.state.error}</pre>
        <button onClick={() => location.reload()}>Try again</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

if(import.meta.env.PROD && 'serviceWorker' in navigator){window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{/* Writing and local recovery do not depend on offline installation. */});});}
