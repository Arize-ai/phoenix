import { useState, useEffect } from "react";
import { config } from "./config";
import { ThemeToggle } from "./components/ThemeToggle";

interface User {
  id: string;
  name: string;
  email: string;
}

export default function UserSelector() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [urlParams, setUrlParams] = useState<URLSearchParams>(
    new URLSearchParams()
  );

  const [isPKCE, setIsPKCE] = useState(false);

  useEffect(() => {
    const currentParams = new URLSearchParams(window.location.search);
    setUrlParams(currentParams);
    // Detect PKCE flow by checking for code_challenge parameter
    setIsPKCE(currentParams.has("code_challenge"));
    window.history.replaceState(null, "", "/phoenix");
    fetch(`${config.apiBase}/users`)
      .then((response) => response.json())
      .then((data: User[]) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users");
        setLoading(false);
      });
  }, []);

  const getInitials = (name: string, email: string): string => {
    if (name && name !== email.split("@")[0]) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="container">
        <ThemeToggle />
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <ThemeToggle />
      <h1 className="title">Select User</h1>
      <p className="subtitle">Choose which user to sign in as</p>

      {error && <div className="error">{error}</div>}

      {users.length > 0 ? (
        <div className="users-grid-compact">
          {users.map((user) => (
            <a
              key={user.id}
              href={`${config.apiBase}/${isPKCE ? "pkce/" : ""}select-user?userId=${user.id}&${urlParams.toString()}`}
              className="user-card-compact"
              title={`${user.name} (${user.email})`}
            >
              <div className="user-avatar-compact">
                {getInitials(user.name, user.email)}
              </div>
              <div className="user-info-compact">
                <div className="user-name-compact">{user.name}</div>
                <div className="user-email-compact">{user.email}</div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        !error && (
          <div className="error">No users available for authentication.</div>
        )
      )}
    </div>
  );
}
