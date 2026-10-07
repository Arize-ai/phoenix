#!/usr/bin/env python3
"""Control: sessions with inverted timestamps"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(str(scalar("select count(*) from project_sessions where start_time > end_time")))
