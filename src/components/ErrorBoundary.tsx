import { Component, type ReactNode } from 'react';
import { resetAll } from '../lib/store';

/** Never show a blank page: catch render errors and offer a reset of saved local state. */
export default class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.warn('[Leone Library] recovered from render error:', err); }
  render() {
    if (!this.state.err) return this.props.children;
    const base = import.meta.env.BASE_URL;
    return (
      <div className="err-box glass" role="alert">
        <h2>Something went wrong{this.props.label ? ` in the ${this.props.label}` : ''}.</h2>
        <p className="muted small">{String(this.state.err.message || this.state.err)}</p>
        <div className="row gap">
          <button className="btn" onClick={() => this.setState({ err: null })}>Try again</button>
          <button className="btn ghost" onClick={() => { resetAll(); location.href = base; }}>Reset saved settings</button>
        </div>
      </div>
    );
  }
}
