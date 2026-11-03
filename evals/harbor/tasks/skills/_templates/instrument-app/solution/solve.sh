#!/bin/sh
# Add the reference instrumentation and turn it on from the bot's entry point.
set -eu
cp /solution/tracing.py /app/tracing.py
python3 - <<'EOF'
from pathlib import Path

bot = Path("/app/support_bot.py")
entry = 'if __name__ == "__main__":\n    main()\n'
traced = '''if __name__ == "__main__":
    import sys

    from tracing import instrument

    provider = instrument(
        sys.modules[__name__], "support-bot-dev", "http://127.0.0.1:6006/v1/traces"
    )
    main()
    provider.force_flush()
'''
source = bot.read_text()
assert entry in source, "support_bot.py has no main block to instrument"
bot.write_text(source.replace(entry, traced))
EOF
