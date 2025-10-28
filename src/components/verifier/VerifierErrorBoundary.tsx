// src/components/verifier/VerifierErrorBoundary.tsx
/* ────────────────────────────────────────────────────────────────
   VerifierErrorBoundary
   • Catches crashes inside VerifierStamper so the whole app doesn't die
   • Emits kk:error event on window for debug UI / telemetry
────────────────────────────────────────────────────────────────── */

import React from "react";

export interface VerifierErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

export interface VerifierErrorBoundaryState {
  hasError: boolean;
  error?: unknown;
}

export class VerifierErrorBoundary extends React.Component<
  VerifierErrorBoundaryProps,
  VerifierErrorBoundaryState
> {
  constructor(props: VerifierErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }

  static getDerivedStateFromError(error: unknown): VerifierErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[VerifierStamper] crashed", error, info);
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("kk:error", {
            detail: {
              where: "VerifierStamper",
              error: error instanceof Error ? error.message : String(error),
            },
          })
        );
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[VerifierStamper] failed to dispatch kk:error", e);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const msg =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error ?? "Unknown error");
      const stack =
        this.state.error instanceof Error ? this.state.error.stack : undefined;

      return (
        <div role="alert" style={{ padding: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <strong>Verifier crashed</strong>
            <button
              className="secondary"
              onClick={this.handleReset}
              title="Reset Verifier"
              aria-label="Reset Verifier"
            >
              Reset
            </button>
          </div>
          <div style={{ fontSize: 14, color: "var(--dim, #999)" }}>{msg}</div>
          {stack && (
            <details style={{ marginTop: 8 }}>
              <summary>Stack</summary>
              <pre style={{ whiteSpace: "pre-wrap" }}>{stack}</pre>
            </details>
          )}
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default VerifierErrorBoundary;
