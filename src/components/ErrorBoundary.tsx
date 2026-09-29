import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * A render crash used to unmount everything and leave a blank screen with no
 * way out but restarting the app. Show what went wrong and a way home instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Perlify crashed:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen screen--cream error-boundary">
        <div className="screen__body error-boundary__body">
          <h1 className="type-headline">OOPS</h1>
          <p className="type-body">Something went wrong on this screen. Your saved patterns and collections are safe.</p>
          <pre className="type-meta error-boundary__detail">{this.state.error.message}</pre>
          <button
            type="button"
            className="error-boundary__home"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            BACK TO LIBRARY
          </button>
        </div>
      </div>
    );
  }
}
