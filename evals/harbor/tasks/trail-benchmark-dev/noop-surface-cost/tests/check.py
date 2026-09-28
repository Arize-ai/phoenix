import rewardkit as rk

# The instruction asks for the fixed reply "ok". Markdown emphasis, letter case,
# surrounding whitespace, and final punctuation do not count against the reply.
rk.file_contains_regex("/logs/verifier/reply.txt", r"(?i)\A\s*[*`_]*ok[*`_]*[.!]?\s*\Z")
