#!/usr/bin/env python3
"""Count OK spans with errors beneath them"""

from harbor_verifiers.phoenix_api import scalar, write_answer

write_answer(
    str(
        scalar("select count(*) from spans where cumulative_error_count > 0 and status_code = 'OK'")
    )
)
