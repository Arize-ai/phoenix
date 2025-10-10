import React from "react";
import ReactDOM from "react-dom/client";
import UserSelector from "./UserSelector";
import ErrorPage from "./ErrorPage";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

// Check if we're on an error page
const urlParams = new URLSearchParams(window.location.search);
const error = urlParams.get("error");
const errorDescription = urlParams.get("error_description");
const state = urlParams.get("state");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      {error ? (
        <ErrorPage
          error={error}
          errorDescription={errorDescription || undefined}
          state={state || undefined}
        />
      ) : (
        <UserSelector />
      )}
    </ThemeProvider>
  </React.StrictMode>
);
