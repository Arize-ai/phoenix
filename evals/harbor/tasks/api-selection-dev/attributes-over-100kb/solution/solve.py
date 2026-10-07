#!/usr/bin/env python3
"""Count spans with oversized attributes"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(str(scalar("select count(*) from spans where length(attributes) > 102400")))
