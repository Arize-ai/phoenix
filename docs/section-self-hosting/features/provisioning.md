---
description: How to provision Phoenix at deploy time
---

Phoenix can be configured to immediately recieve data via 

## Admin Access

Phoenix supports the use of the `PHOENIX_ADMIN_SECRET` environment variable to enable immediate, programmatic access for sending data to your Phoenix instance. This secret acts as a bearer token, authenticating as the first system user, and can be used in place of an API key for secure automation and provisioning workflows.

- Set the `PHOENIX_ADMIN_SECRET` environment variable at deploy time.
- The value must be at least 32 characters long, include at least one digit and one lowercase letter, and must be different from `PHOENIX_SECRET`.
- When set, you can use this secret as a bearer token in the `Authorization` header to authenticate API requests and immediately send data to Phoenix.

## Initial Admin User Provisioning

Phoenix allows you to provision the first set of admin users at deploy time using the `PHOENIX_ADMINS` environment variable. This is useful for bootstrapping access in self-hosted or automated environments.

- Set the `PHOENIX_ADMINS` environment variable to a semicolon-separated list of `username=email` pairs.
- On startup, Phoenix will create admin users for each pair if they do not already exist.
- Passwords for these users will be randomly generated and must be reset by the user.
- If a username or email already exists, the user record will not be modified.

```
PHOENIX_ADMINS="username1=email1@example.com;username2=email2@example.com"
```
