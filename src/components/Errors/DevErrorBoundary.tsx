import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class DevErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[KaiSigil] boundary caught", error, info);
    }
  }

  render() {
    if (this.state.error && process.env.NODE_ENV !== "production") {
      return (
        <div style={{
          border: "1px solid #f33", padding: 12, background: "#2b0000",
          color: "#fff", borderRadius: 8, maxWidth: 680
        }}>
          <strong>Sigil Error</strong>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <button onClick={() => this.setState({ error: null })}>Reset</button>
        </div>
      );
    }
    return this.props.children;
  }
}
