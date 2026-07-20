"""Benchmark comparing Phoenix MCP surfaces on observability questions.

Three arms answer the same questions through the same model, differing only in
how the Phoenix API is presented to it. A pytest session puts one arm under
test; successive sessions record successive experiments on a shared Phoenix
dataset. See ``README.md``.
"""
