import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal. Por favor, intenta recargar la página.";
      
      try {
        if (this.state.error?.message) {
          const parsedError = JSON.parse(this.state.error.message);
          if (parsedError.error && parsedError.error.includes("Missing or insufficient permissions")) {
            errorMessage = "No tienes permisos suficientes para realizar esta acción. Por favor, verifica tu rol o inicia sesión de nuevo.";
          }
        }
      } catch (e) {
        // Not a JSON error, use default
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-6 text-center">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-xl max-w-md w-full border border-error/10">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-error text-4xl">error</span>
            </div>
            <h1 className="font-lexend font-bold text-2xl text-on-surface mb-4">¡Ups!</h1>
            <p className="text-on-surface-variant mb-8 leading-relaxed">
              {errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-primary text-on-primary rounded-2xl font-lexend font-bold shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
