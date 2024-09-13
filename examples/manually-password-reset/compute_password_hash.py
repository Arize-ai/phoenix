"""
This script is valid for arize-phoenix>=5.0.0
"""

from argparse import ArgumentParser

from phoenix.auth import compute_password_hash

parser = ArgumentParser()
parser.add_argument("--password", type=str, required=True)
parser.add_argument("--salt", type=str, required=True)
args = parser.parse_args()
password = args.password
assert (args.salt).startswith("0x"), "The salt should be a hex string starting with the prefix '0x'"
salt = bytes.fromhex(args.salt[2:])
password_hash = compute_password_hash(password=password, salt=salt)
password_hash_hex = "0x" + password_hash.hex()
print(f"{type(password_hash_hex)=}")
print(password_hash_hex)
