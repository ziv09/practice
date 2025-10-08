import React from "react";

type Props = {
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ padding: 16 }}>Something went wrong. Please refresh.</div>
      );
    }
    return this.props.children;
  }
}

