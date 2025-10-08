# Phoenix SMTP Development Server

A simple SMTP server for visualizing and debugging emails emitted from Phoenix during development. **Not for production use.**

## What It Does

- Catches emails sent by Phoenix during development
- Provides a web UI to view email content (HTML, text, headers)
- Stores emails in memory for easy debugging
- No actual email delivery - just visualization

## Quick Start

The SMTP server runs automatically with the Phoenix development environment:

```bash
# Start Phoenix dev environment (includes SMTP server)
tox r -e docker_devops

# View emails at:
# http://localhost:18273/mail
```

## How to Use

1. **Start the dev environment** - SMTP server starts automatically
2. **Trigger emails in Phoenix** - use your app's email functionality  
3. **View emails** - go to http://localhost:18273/mail
4. **Debug email content** - see exactly what Phoenix sent

## Email Viewing

- **HTML view**: See rendered emails
- **Text view**: Plain text content
- **Raw view**: Full email data as JSON
- **Headers view**: SMTP headers and metadata

## Configuration

The server uses these defaults (configured in Phoenix dev environment):

- **SMTP Port**: 1025 (where Phoenix sends emails)
- **Web Port**: 8025 (served via Traefik at `/mail`)
- **Storage**: In-memory (emails reset on restart)
- **Max Emails**: 1000 (oldest emails auto-deleted)

## Troubleshooting

**No emails showing?**
- Check Phoenix is configured to send emails to `localhost:1025`
- Verify the dev environment is running
- Check browser console for errors

**Can't access web UI?**
- Ensure you're using http://localhost:18273/mail (not port 8025 directly)
- Confirm Traefik is routing properly in dev environment

That's it! This is intentionally a simple tool focused on email debugging during Phoenix development.