import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Catches a render error in the page beneath it and shows a message in its place.
 *
 * Without one, a single throw unmounts the whole React tree: the header, sidebar and page
 * all vanish, leaving a blank window with the cause visible only in the console. That is
 * exactly how a hooks-order bug on the CDE deal page presented during development. With a
 * boundary around the routed page, the navigation survives and the user can move on.
 *
 * Callers pass the current path as `key`, so navigating away clears the error rather than
 * leaving every later page stuck behind it.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept in the console for whoever investigates; the user sees the summary below.
    console.error("Page failed to render:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main>
        <h1>Something went wrong on this page</h1>
        <div className="alert alert-error">
          The page hit an unexpected error and could not be shown. Your saved data is not affected. Try
          reloading; if it keeps happening, pass this message to support:
          <pre className="error-detail">{this.state.error.message}</pre>
        </div>
        <button onClick={() => window.location.reload()}>Reload page</button>
      </main>
    );
  }
}
