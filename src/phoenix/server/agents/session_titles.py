MAX_AGENT_SESSION_TITLE_LENGTH = 100


def validate_agent_session_title(title: str, *, allow_empty: bool) -> str:
    normalized_title = title.strip()
    if not normalized_title and not allow_empty:
        raise ValueError("Agent session title cannot be empty")
    if len(normalized_title) > MAX_AGENT_SESSION_TITLE_LENGTH:
        raise ValueError(
            f"Agent session title cannot exceed {MAX_AGENT_SESSION_TITLE_LENGTH} characters"
        )
    return normalized_title


def truncate_agent_session_title(title: str) -> str:
    return title.strip()[:MAX_AGENT_SESSION_TITLE_LENGTH].rstrip()
