Extend `/app/wc.py` with a `--top N` option that reports the most frequent words.

Requirements:
- `python3 /app/wc.py <path>` must keep printing the total word count as before.
- `python3 /app/wc.py --top N <path>` prints the N most frequent words, one per line, formatted as `<word> <count>`.
- Words are compared case-insensitively and reported in lowercase, with leading and trailing punctuation removed (for example, `Dog.` and `dog` are the same word).
- Sort by count descending, then by word ascending.
