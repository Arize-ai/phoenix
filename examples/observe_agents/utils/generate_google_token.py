#!/usr/bin/env python3
"""
Script to generate Gmail + Calendar OAuth token for the observe_agents example.

This script will:
1. Load your Gmail client secret JSON file
2. Start the OAuth flow with Gmail AND Calendar permissions
3. Open a browser for you to authorize the app
4. Save the resulting token to a JSON file

Usage:
    python utils/generate_google_token.py

Make sure you have set:
    GMAIL_CLIENT_SECRET_JSON=/path/to/your/client_file.json

Or the script will prompt you for the path.
"""

import json
import os
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

# Gmail and Calendar API scopes
SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
]


def main():
    """Generate Gmail + Calendar OAuth token."""
    # Get client secret path
    client_json_path = os.getenv("GMAIL_CLIENT_SECRET_JSON")

    if not client_json_path:
        client_json_path = input("Enter path to your Gmail client secret JSON file: ").strip()

    if not client_json_path or not Path(client_json_path).exists():
        print(f"Error: Client secret file not found at {client_json_path}")
        return

    # Set up the OAuth flow
    flow = InstalledAppFlow.from_client_secrets_file(client_json_path, SCOPES)

    print("Starting OAuth flow...")
    print("This will open a browser window for you to authorize the app.")
    print("You'll be asked to grant permissions for both Gmail AND Calendar access.")
    print("After authorization, you'll be redirected to a success page.")

    # Run the OAuth flow
    creds = flow.run_local_server(port=0)

    # Save the token
    token_path = Path("../keys/gmail_token.json")
    token_path.parent.mkdir(exist_ok=True, parents=True)

    # Convert credentials to dictionary format
    token_data = {
        "token": creds.token,
        "refresh_token": creds.refresh_token,
        "token_uri": creds.token_uri,
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "scopes": creds.scopes,
    }

    with open(token_path, "w") as f:
        json.dump(token_data, f, indent=2)

    print(f"✅ Token saved to: {token_path.absolute()}")
    print(f"Now set: export GMAIL_TOKEN_JSON={token_path.absolute()}")
    print(f"And set: export GMAIL_CLIENT_SECRET_JSON={client_json_path}")


if __name__ == "__main__":
    main()
