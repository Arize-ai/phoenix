"""Verifiers shared by the Harbor tasks.

Staging copies this package into the task image under ``/opt/verifier``, where a
task's ``tests/test.sh`` runs :mod:`evals.harbor.verifiers.verify` and the reference
solutions import :mod:`evals.harbor.verifiers.phoenix_api`. The judge uses the
``phoenix.evals`` library that ships with the Phoenix wheel in the image.
"""
