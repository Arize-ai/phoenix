"""Mail Agent implemented using the openai-agents Python SDK.

This script defines an Agent equipped with Gmail-related
tools such as `send_mail`, `fetch_unread`, `search_threads``.
When the Agent decides to call one of these tools the corresponding local
function is executed.

Run the script and interact over stdio, e.g.:

    >>> Check my unread messages
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List

from agents import Agent, Runner, function_tool
from dotenv import load_dotenv
from openai import OpenAI

import phoenix as px

# ---------------------------------------------------------------------------
# Environment & instrumentation
# ---------------------------------------------------------------------------

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY must be set")
client = OpenAI(api_key=OPENAI_API_KEY)

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
phoenix_client = px.Client(endpoint=os.getenv("PHOENIX_BASE_URL"))
ASSISTANT_FILE = Path(__file__).with_suffix(".assistant_id")

# ---------------------------------------------------------------------------
# Gmail helpers (placeholder implementations)
# ---------------------------------------------------------------------------

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
]


def get_gmail_service() -> Any:
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build  # type: ignore

    token_path = os.getenv("GMAIL_TOKEN_JSON")
    client_secret = os.getenv("GMAIL_CLIENT_SECRET_JSON")
    if not token_path or not client_secret:
        raise RuntimeError("GMAIL_TOKEN_JSON and GMAIL_CLIENT_SECRET_JSON must be set")
    creds = Credentials.from_authorized_user_file(token_path, SCOPES)
    return build("gmail", "v1", credentials=creds)


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------


@function_tool
def send_mail(to: List[str], subject: str, body: str, attachments: List[str] | None = None) -> str:
    """Send an email via Gmail. Returns the message ID."""
    import base64
    import os
    from email import encoders
    from email.mime.base import MIMEBase
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    service = get_gmail_service()

    # Create message
    message = MIMEMultipart()
    message["to"] = ", ".join(to)
    message["subject"] = subject

    # Add body
    message.attach(MIMEText(body, "plain"))

    # Add attachments if provided
    if attachments:
        for file_path in attachments:
            if os.path.exists(file_path):
                with open(file_path, "rb") as attachment:
                    part = MIMEBase("application", "octet-stream")
                    part.set_payload(attachment.read())

                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f"attachment; filename= {os.path.basename(file_path)}",
                )
                message.attach(part)

    # Convert to raw format
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

    try:
        # Send the message
        sent_message = (
            service.users().messages().send(userId="me", body={"raw": raw_message}).execute()
        )

        print(f"✅ Email sent successfully to {', '.join(to)}")
        return sent_message["id"]
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
        raise


@function_tool
def fetch_unread(max_results: int = 5) -> List[Dict[str, Any]]:
    """Fetch unread messages from Gmail."""
    import base64

    service = get_gmail_service()

    try:
        # Get list of unread messages
        results = (
            service.users()
            .messages()
            .list(userId="me", q="is:unread", maxResults=max_results)
            .execute()
        )

        messages = results.get("messages", [])

        unread_messages = []
        for msg in messages:
            # Get full message details
            message = (
                service.users().messages().get(userId="me", id=msg["id"], format="full").execute()
            )

            payload = message["payload"]
            headers = payload.get("headers", [])

            # Extract relevant headers
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            sender = next((h["value"] for h in headers if h["name"] == "From"), "Unknown Sender")
            date = next((h["value"] for h in headers if h["name"] == "Date"), "Unknown Date")

            # Get message body
            body = ""
            if "parts" in payload:
                for part in payload["parts"]:
                    if part["mimeType"] == "text/plain":
                        data = part["body"]["data"]
                        body = base64.urlsafe_b64decode(data).decode("utf-8")
                        break
            elif payload["mimeType"] == "text/plain":
                data = payload["body"]["data"]
                body = base64.urlsafe_b64decode(data).decode("utf-8")

            unread_messages.append(
                {
                    "id": message["id"],
                    "thread_id": message["threadId"],
                    "subject": subject,
                    "from": sender,
                    "date": date,
                    "body": body[:200] + "..."
                    if len(body) > 200
                    else body,  # Truncate long messages
                    "snippet": message.get("snippet", ""),
                }
            )

        print(f"📧 Found {len(unread_messages)} unread messages")
        return unread_messages

    except Exception as e:
        print(f"❌ Failed to fetch unread messages: {str(e)}")
        return []


@function_tool
def search_threads(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    """Search Gmail threads using a query string."""

    service = get_gmail_service()

    try:
        # Search for threads matching the query
        results = (
            service.users().threads().list(userId="me", q=query, maxResults=max_results).execute()
        )

        threads = results.get("threads", [])

        thread_summaries = []
        for thread in threads:
            # Get thread details
            thread_details = service.users().threads().get(userId="me", id=thread["id"]).execute()

            # Get the first message in the thread for subject and participants
            messages = thread_details.get("messages", [])
            if not messages:
                continue

            first_message = messages[0]
            headers = first_message["payload"].get("headers", [])

            # Extract thread information
            subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
            participants = set()

            # Collect all participants from all messages in thread
            for msg in messages:
                msg_headers = msg["payload"].get("headers", [])
                sender = next((h["value"] for h in msg_headers if h["name"] == "From"), None)
                recipient = next((h["value"] for h in msg_headers if h["name"] == "To"), None)
                if sender:
                    participants.add(sender)
                if recipient:
                    participants.add(recipient)

            # Get snippet from the latest message
            latest_message = messages[-1]
            snippet = latest_message.get("snippet", "")

            thread_summaries.append(
                {
                    "thread_id": thread["id"],
                    "subject": subject,
                    "participants": list(participants),
                    "message_count": len(messages),
                    "snippet": snippet,
                    "histogram_id": thread_details.get("historyId", ""),
                }
            )

        print(f"🔍 Found {len(thread_summaries)} threads matching '{query}'")
        return thread_summaries

    except Exception as e:
        print(f"❌ Failed to search threads: {str(e)}")
        return []


def get_email_extraction_prompt():
    """Load the email event extraction prompt from Phoenix with production tag."""
    try:
        prompt_version = phoenix_client.prompts.get(
            prompt_identifier="email-event-extraction-prompt", tag="production"
        )
        # Format the prompt to get the OpenAI format
        formatted_prompt = prompt_version.format()

        # Extract the system message content from the formatted prompt
        if hasattr(formatted_prompt, "messages") and len(formatted_prompt.messages) > 0:
            return formatted_prompt.messages[0]["content"]
        else:
            # Fallback prompt if format not recognized
            return """You are an AI assistant that extracts meeting and event information from emails.

Analyze the email content and extract any meeting or event details. Return a JSON object with the following structure:
{
    "has_event": boolean,  // whether the email contains event information
    "event_title": string or null,  // meeting/event title
    "event_description": string or null,  // meeting description/agenda
    "start_datetime": string or null,  // ISO format datetime (YYYY-MM-DDTHH:MM:SS)
    "end_datetime": string or null,    // ISO format datetime (YYYY-MM-DDTHH:MM:SS)
    "attendees": [string] or null,     // list of email addresses
    "location": string or null,        // meeting location/venue
    "is_invitation": boolean,          // whether this is a meeting invitation
    "requires_response": boolean       // whether a response is needed
}

Look for:
- Meeting invitations or requests
- Date and time mentions (convert to ISO format, assume current year if not specified)
- Duration information
- Attendee information
- Location details
- Calendar-related keywords

If no event information is found, set has_event to false and other fields to null.
For date/time parsing, be flexible with formats and make reasonable assumptions about timezone (use local time)."""
    except Exception as e:
        print(f"⚠️  Failed to load email extraction prompt from Phoenix: {e}")
        # Fallback prompt
        return """You are an AI assistant that extracts meeting and event information from emails.

Analyze the email content and extract any meeting or event details. Return a JSON object with the following structure:
{
    "has_event": boolean,  // whether the email contains event information
    "event_title": string or null,  // meeting/event title
    "event_description": string or null,  // meeting description/agenda
    "start_datetime": string or null,  // ISO format datetime (YYYY-MM-DDTHH:MM:SS)
    "end_datetime": string or null,    // ISO format datetime (YYYY-MM-DDTHH:MM:SS)
    "attendees": [string] or null,     // list of email addresses
    "location": string or null,        // meeting location/venue
    "is_invitation": boolean,          // whether this is a meeting invitation
    "requires_response": boolean       // whether a response is needed
}

Look for:
- Meeting invitations or requests
- Date and time mentions (convert to ISO format, assume current year if not specified)
- Duration information
- Attendee information
- Location details
- Calendar-related keywords

If no event information is found, set has_event to false and other fields to null.
For date/time parsing, be flexible with formats and make reasonable assumptions about timezone (use local time)."""


@function_tool
def extract_event_info(email_content: str, email_subject: str, email_from: str) -> Dict[str, Any]:
    """Extract meeting/event information from email content using AI."""
    import json

    # Get the system prompt from Phoenix
    system_prompt = get_email_extraction_prompt()

    user_prompt = f"""
    Email Subject: {email_subject}
    Email From: {email_from}
    Email Content:
    {email_content}

    Extract event information from this email and return as JSON.
    """

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,
        )

        # Parse the JSON response
        result_text = response.choices[0].message.content.strip()

        # Try to extract JSON from the response
        if result_text.startswith("```json"):
            result_text = result_text[7:-3].strip()
        elif result_text.startswith("```"):
            result_text = result_text[3:-3].strip()

        result = json.loads(result_text)

        print(
            f"📅 Extracted event info: {result.get('event_title', 'No event')} - Has event: {result.get('has_event', False)}"
        )
        return result

    except Exception as e:
        print(f"❌ Failed to extract event info: {str(e)}")
        return {
            "has_event": False,
            "event_title": None,
            "event_description": None,
            "start_datetime": None,
            "end_datetime": None,
            "attendees": None,
            "location": None,
            "is_invitation": False,
            "requires_response": False,
        }


@function_tool
def fetch_unread_with_events(max_results: int = 5) -> List[Dict[str, Any]]:
    """Fetch unread messages and extract event information from each one."""
    unread_messages = fetch_unread(max_results)

    messages_with_events = []
    for message in unread_messages:
        # Extract event information from each message
        event_info = extract_event_info(
            email_content=message.get("body", ""),
            email_subject=message.get("subject", ""),
            email_from=message.get("from", ""),
        )

        # Combine message info with event info
        message_with_event = {
            **message,  # All original message fields
            "event_info": event_info,
        }

        messages_with_events.append(message_with_event)

    # Count how many emails have events
    event_count = sum(
        1 for msg in messages_with_events if msg["event_info"].get("has_event", False)
    )
    print(
        f"📧➡️📅 Processed {len(messages_with_events)} unread emails, found {event_count} with event information"
    )

    return messages_with_events


# ---------------------------------------------------------------------------
# Agent definition
# ---------------------------------------------------------------------------


def get_mail_agent_prompt():
    """Load the mail agent prompt from Phoenix with production tag."""
    try:
        prompt_version = phoenix_client.prompts.get(
            prompt_identifier="mail-agent-prompt", tag="production"
        )
        # Format the prompt to get the OpenAI format
        formatted_prompt = prompt_version.format()

        # Extract the system message content from the formatted prompt
        if hasattr(formatted_prompt, "messages") and len(formatted_prompt.messages) > 0:
            return formatted_prompt.messages[0]["content"]
        else:
            # Fallback instructions if prompt format not recognized
            return (
                "You are an email assistant with access to Gmail. "
                "Use the provided tools to send and manage email."
            )
    except Exception as e:
        print(f"⚠️  Failed to load prompt from Phoenix: {e}")
        # Fallback instructions
        return (
            "You are an email assistant with access to Gmail. "
            "Use the provided tools to send and manage email."
        )


MAIL_AGENT = Agent(
    name="Mail Agent",
    instructions=get_mail_agent_prompt(),
    tools=[send_mail, fetch_unread, search_threads, extract_event_info, fetch_unread_with_events],
)

# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("📬 Mail Agent (openai-agents) ready. Type your email-related request ('exit' to quit).")
    while True:
        try:
            user_input = input(">>> ").strip()
        except (KeyboardInterrupt, EOFError):
            print()
            break
        if user_input.lower() in {"exit", "quit"}:
            break
        if user_input:
            result = Runner.run_sync(MAIL_AGENT, user_input)
            print("🤖:", result.final_output)
