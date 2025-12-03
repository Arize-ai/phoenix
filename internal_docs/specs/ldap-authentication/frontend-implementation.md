# Frontend Implementation

## New Component: LDAPLoginForm.tsx

```typescript
import { useState, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Button, Flex, Form, Input, Label, TextField, Alert, View } from "@phoenix/components";
import { getReturnUrl, prependBasename } from "@phoenix/utils/routingUtils";

export function LDAPLoginForm() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(prependBasename("/auth/ldap/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      
      if (!response.ok) {
        const errorMessage =
          response.status === 429
            ? "Too many requests. Please try again later."
            : response.status === 503
            ? "Authentication service temporarily unavailable"
            : "Invalid credentials";
        setError(errorMessage);
        return;
      }
      
      // Success - navigate to app
      const returnUrl = getReturnUrl();
      navigate(returnUrl);
    } catch (error) {
      setError("Authentication service unavailable");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      {error && (
        <View paddingBottom="size-100">
          <Alert variant="danger">{error}</Alert>
        </View>
      )}
      <Form onSubmit={handleSubmit}>
        <Flex direction="column" gap="size-100">
          <TextField
            isRequired
            onChange={(v) => setUsername(v)}
            value={username}
            autoComplete="username"
          >
            <Label>Username</Label>
            <Input placeholder="your LDAP username" />
          </TextField>
          <TextField
            type="password"
            isRequired
            onChange={(v) => setPassword(v)}
            value={password}
            autoComplete="current-password"
          >
            <Label>Password</Label>
            <Input placeholder="your password" />
          </TextField>
          <Button variant="primary" type="submit" isDisabled={isLoading}>
            {isLoading ? "Logging In..." : "Log In with LDAP"}
          </Button>
        </Flex>
      </Form>
    </>
  );
}
```

## Update LoginPage.tsx

```typescript
import { LDAPLoginForm } from "./LDAPLoginForm";

export function LoginPage() {
  const showLoginForm = !window.Config.basicAuthDisabled;
  const showLDAPLogin = window.Config.ldapEnabled;
  const oAuth2Idps = window.Config.oAuth2Idps;
  const hasOAuth2Idps = oAuth2Idps.length > 0;
  
  return (
    <AuthLayout>
      <Flex direction="column" gap="size-200" alignItems="center">
        <View paddingBottom="size-200">
          <PhoenixLogo />
        </View>
      </Flex>
      
      {/* Basic auth form */}
      {showLoginForm && <LoginForm />}
      
      {/* Separator */}
      {showLoginForm && (showLDAPLogin || hasOAuth2Idps) ? (
        <div css={separatorCSS}>or</div>
      ) : null}
      
      {/* LDAP login form */}
      {showLDAPLogin && <LDAPLoginForm />}
      
      {/* Separator */}
      {showLDAPLogin && hasOAuth2Idps ? (
        <div css={separatorCSS}>or</div>
      ) : null}
      
      {/* OAuth2 provider buttons */}
      {hasOAuth2Idps && (
        <ul css={oAuthLoginButtonListCSS}>
          {oAuth2Idps.map((idp) => (
            <li key={idp.name}>
              <OAuth2Login
                idpName={idp.name}
                idpDisplayName={idp.displayName}
                returnUrl={returnUrl}
              />
            </li>
          ))}
        </ul>
      )}
    </AuthLayout>
  );
}
```

## Update UsersTable.tsx

```typescript
// app/src/pages/settings/UsersTable.tsx

{
  header: "method",
  accessorKey: "authMethod",
  size: 10,
  cell: ({ row }) => {
    const authMethod = row.original.authMethod;
    
    // If using Approach 1 (zero-migration)
    // Need to check oauth2_client_id prefix to distinguish LDAP
    if (authMethod === "OAUTH2") {
      const isLDAP = row.original.oauth2ClientId?.startsWith("\ue000LDAP(stopgap)");
      return isLDAP ? "ldap" : "oauth2";
    }
    
    // If using Approach 2 (migration)
    // GraphQL returns "LDAP" directly
    return authMethod.toLowerCase();
  }
}
```

## Update Window Config

```typescript
// app/src/globals.d.ts

interface WindowConfig {
  // Existing
  basicAuthDisabled: boolean;
  oAuth2Idps: Array<{ name: string; displayName: string }>;
  
  // Add for LDAP
  ldapEnabled: boolean;
  ldapDisplayName?: string;  // Optional custom display name
}
```

```python
# src/phoenix/server/main.py

@app.get("/config")
async def get_config():
    auth_settings = get_env_auth_settings()
    return {
        "basicAuthDisabled": auth_settings.disable_basic_auth,
        "oAuth2Idps": [
            {"name": c.name, "displayName": c.display_name}
            for c in auth_settings.oauth2_clients
        ],
        "ldapEnabled": auth_settings.ldap_config is not None,
        "ldapDisplayName": auth_settings.ldap_config.display_name 
            if auth_settings.ldap_config else None,
    }
```

