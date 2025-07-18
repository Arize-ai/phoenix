# Email Configuration

Optionally, you can configure an SMTP server to send transactional emails. These are used for password resets, user invitations, and more.


* **PHOENIX_SMTP_HOSTNAME:** The SMTP hostname to use for sending password reset emails.
* **PHOENIX_SMTP_PORT:** The SMTP port. Defaults to `587`.
* **PHOENIX_SMTP_USERNAME:** The SMTP username.
* **PHOENIX_SMTP_PASSWORD:** The SMTP password.
* **PHOENIX_SMTP_MAIL_FROM:** The `from` address in the emails. Defaults to `noreply@arize.com`.
* **PHOENIX_SMTP_VALIDATE_CERTS:** Whether to validate the SMTP server's certificate. Defaults to `true`.

Example usage:

```bash
export PHOENIX_SMTP_HOSTNAME="smtp.example.com"
export PHOENIX_SMTP_PORT=587
export PHOENIX_SMTP_USERNAME="phoenix-user"
export PHOENIX_SMTP_PASSWORD="yourpassword"
export PHOENIX_SMTP_MAIL_FROM="noreply@yourdomain.com"
export PHOENIX_SMTP_VALIDATE_CERTS=true
```

These settings are required for password reset flows when authentication is enabled in Phoenix.


## FAQ

- **Which SMTP service should I use?**
  - It is recommended to use a reputable SMTP service for transactional emails to ensure delivery and prevent abuse. If you do not have a preferred service from your cloud provider, consider providers like Resend, Mailgun, Sendgrid, or Postmark, which are easy to set up and offer generous free tiers.