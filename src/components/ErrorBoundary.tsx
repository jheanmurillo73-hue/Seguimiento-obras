import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Captured handled UI boundary error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f3faff] p-6">
          <div className="max-w-md w-full bg-white rounded-2xl border border-[#c2c6d4] shadow-xl p-6 text-center font-['Inter']">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
              <span className="material-symbols-outlined text-[24px]">refresh</span>
            </div>
            <h2 className="font-['Hanken_Grotesk'] font-bold text-lg text-[#071e27] mb-2">
              Se restableció la vista
            </h2>
            <p className="text-xs text-[#424752] mb-6">
              El sistema recuperó el estado de la aplicación. Puedes continuar navegando normalmente.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-2.5 px-4 bg-[#004d99] hover:bg-[#1565c0] text-white font-bold text-xs rounded-xl shadow-xs transition-all"
            >
              Reintentar y Continuar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
