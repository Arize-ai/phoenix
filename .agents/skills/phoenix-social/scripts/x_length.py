"""Counts X post length the way the Typefully composer enforces it for a non-Premium account.

    python3 x_length.py "post text" ["post text" ...]
    python3 x_length.py < post.txt

X weights most characters outside Latin and common punctuation (CJK, Hangul, emoji) as 2, so 280
weighted characters is about 140 Chinese or Japanese characters. Typefully counts URLs at their
full length, so this does too. Prints the weighted length and OK or OVER for each post.
"""

import sys
import unicodedata

LIMIT = 280
# Code point ranges X counts as weight 1 (twitter-text v3 config); everything else counts 2.
LIGHT_RANGES = ((0x0000, 0x10FF), (0x2000, 0x200D), (0x2010, 0x201F), (0x2032, 0x2037))


def measure_weighted_length(*, text: str) -> int:
    normalized_text = unicodedata.normalize("NFC", text)
    num_weighted = 0
    for character in normalized_text:
        code_point = ord(character)
        is_light = any(low <= code_point <= high for low, high in LIGHT_RANGES)
        num_weighted += 1 if is_light else 2
    return num_weighted


def main() -> None:
    posts = sys.argv[1:] or [sys.stdin.read().rstrip("\n")]
    for index, post in enumerate(posts, start=1):
        num_weighted = measure_weighted_length(text=post)
        status = "OK" if num_weighted <= LIMIT else "OVER"
        print(f"post {index}: {num_weighted}/{LIMIT} {status}")


if __name__ == "__main__":
    main()
