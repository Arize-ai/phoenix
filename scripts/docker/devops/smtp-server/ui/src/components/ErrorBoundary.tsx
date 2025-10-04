import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="card">
              <div className="card-body text-center">
                <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>

                <h1 className="text-lg font-semibold text-gray-900 mb-2">
                  Something went wrong
                </h1>

                <p className="text-sm text-gray-600 mb-6">
                  An unexpected error occurred. Please try refreshing the page
                  or contact support if the problem persists.
                </p>

                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="text-left mb-6">
                    <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                      Error Details
                    </summary>
                    <div className="mt-2 p-3 bg-gray-100 rounded-lg text-xs font-mono text-gray-800 overflow-auto">
                      <div className="mb-2">
                        <strong>Error:</strong> {this.state.error.message}
                      </div>
                      {this.state.errorInfo?.componentStack && (
                        <div>
                          <strong>Component Stack:</strong>
                          <pre className="mt-1 whitespace-pre-wrap">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex gap-3 justify-center">
                  <button onClick={this.handleReset} className="btn-primary">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </button>

                  <button
                    onClick={() => window.location.reload()}
                    className="btn-secondary"
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
