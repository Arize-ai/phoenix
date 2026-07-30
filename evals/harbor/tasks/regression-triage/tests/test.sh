#!/bin/bash
# No reward fallback on failure: a verifier crash should surface as an errored
# trial, not as an agent that scored 0.
exec python /tests/check.py
