import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Tab render error:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // Recover automatically when the user switches to a different tab
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 gap-4">
          <AlertTriangle size={48} className="text-yellow-400" />
          <p className="text-2xl text-yellow-400">SIGNAL LOST</p>
          <p className="text-cyan-300 text-lg">This channel hit an error. The rest of the broadcast is still on air.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-900/50 border border-cyan-500 rounded-lg text-cyan-300 hover:bg-cyan-800/50 transition-colors"
          >
            <RefreshCw size={18} /> RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
