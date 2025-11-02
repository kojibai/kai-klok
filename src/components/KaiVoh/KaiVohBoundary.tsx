"use client";
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class KaiVohBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surface the actual reason in dev tools
    console.error("[KaiVoh] render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "1rem", textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>KaiVoh failed to load</h2>
          <p style={{ opacity: 0.8, marginTop: 8 }}>{this.state.error.message}</p>
          <details style={{ opacity: 0.65, marginTop: 12, textAlign: "left" }}>
            <summary>Details</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{String(this.state.error.stack ?? "")}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
