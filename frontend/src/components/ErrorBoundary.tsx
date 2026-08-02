import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render-time errors anywhere below it in the tree so a bug in
 * one page (or one dashboard widget) can't take down the whole app with
 * a blank white screen. Logs to the console for now; if/when the Git
 * Sync Engine or a telemetry layer lands, this is the single place to
 * wire in remote error reporting. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Unhandled error in component tree:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-base-950 p-6">
          <div className="glass-panel max-w-md rounded-2xl p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-urgency-critical/10 text-urgency-critical">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="font-display text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This page hit an unexpected error. Your data is safe -- it's stored locally and wasn't touched.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
