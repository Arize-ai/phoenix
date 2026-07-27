#!/bin/sh
# Harbor only discovers .sh/.bat solution entry points; this shim is the
# minimum required to hand off to the real solution.
exec python /solution/solve.py
