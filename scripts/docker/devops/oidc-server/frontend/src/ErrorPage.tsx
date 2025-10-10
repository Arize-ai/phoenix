import { ThemeToggle } from "./components/ThemeToggle";

interface ErrorPageProps {
  error: string;
  errorDescription?: string;
  state?: string;
}

export default function ErrorPage({ error, errorDescription }: ErrorPageProps) {
  const getErrorMessage = (error: string): string => {
    switch (error) {
      case "invalid_request":
        return "Invalid authentication request";
      case "unsupported_response_type":
        return "Unsupported authentication method";
      case "access_denied":
        return "Access denied";
      case "invalid_client":
        return "Invalid client configuration";
      case "invalid_grant":
        return "Invalid authentication grant";
      case "unsupported_grant_type":
        return "Unsupported authentication grant type";
      case "server_error":
        return "Server error occurred";
      default:
        return "Authentication error occurred";
    }
  };

  const getErrorDescription = (error: string, description?: string): string => {
    if (description) {
      return decodeURIComponent(description);
    }

    switch (error) {
      case "invalid_request":
        return "The authentication request is missing required parameters or contains invalid values.";
      case "unsupported_response_type":
        return "The requested authentication method is not supported.";
      case "access_denied":
        return "The user denied the authentication request or no users are available.";
      case "invalid_client":
        return "The client authentication failed. Please check your OAuth configuration.";
      case "invalid_grant":
        return "The authorization code is invalid or has expired.";
      case "unsupported_grant_type":
        return "The requested authentication method is not supported.";
      case "server_error":
        return "An internal server error occurred. Please try again later.";
      default:
        return "An unexpected error occurred during authentication.";
    }
  };

  return (
    <div className="container">
      <ThemeToggle />
      <h1 className="title error-title">Authentication Error</h1>

      <div className="error-card">
        <div className="error-icon">⚠️</div>
        <h2 className="error-message">{getErrorMessage(error)}</h2>
        <p className="error-description">
          {getErrorDescription(error, errorDescription)}
        </p>
      </div>
    </div>
  );
}
