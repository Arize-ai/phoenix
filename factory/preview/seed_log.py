"""The lines launch.py writes to the container log about the seed, as deploy.py reads them.

Shared so the two cannot drift: the launcher imports it inside the image, deploy.py from
the base-branch checkout.
"""

START_LINE = "preview: running the seed script"
NO_SEED_LINE = "preview: no seed script; the instance starts empty"
UNHEALTHY_LINE = "preview: the server exited before it became healthy; skipping the seed"
FINISHED_LINE = "preview: seed finished"
FAILED_PREFIX = "preview: seed failed with exit "
TIMED_OUT_PREFIX = "preview: seed timed out after "
OUTPUT_PREFIX = "seed| "

SUCCESS_LINES = (FINISHED_LINE, NO_SEED_LINE)
OUTCOME_PREFIXES = SUCCESS_LINES + (FAILED_PREFIX, TIMED_OUT_PREFIX, UNHEALTHY_LINE)

# Here rather than in launch.py so deploy.py's wait for the outcome derives from them.
SEED_TIMEOUT_SECONDS = 480
RELAY_DRAIN_SECONDS = 30
