#!/usr/bin/env python3
"""The fixed reply the instruction asks for."""

import sys

sys.path.insert(0, "/opt/verifier")

from evals.harbor.verifiers.phoenix_api import write_answer

write_answer("ok")
