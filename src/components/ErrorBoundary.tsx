import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureUnlessBenign } from '@/lib/sentry';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
    captureUnlessBenign(error, { componentStack: info.componentStack });
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.hash = '#/dashboard';
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center">
          <div className="text-3xl font-semibold tracking-tight">Algo salió mal</div>
          <p className="max-w-lg text-sm text-muted-foreground">
            {this.state.error.message || 'Error inesperado en la aplicación.'}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Reiniciar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
