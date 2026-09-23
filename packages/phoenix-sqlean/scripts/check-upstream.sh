#!/usr/bin/env bash
#
# Reports -- and with --apply, rewrites -- the upstream pins in ../Makefile when
# a newer release exists. No dependency bot can see those pins: Dependabot has
# no custom-regex manager, and SQLite's packed version maps to no standard
# versioning scheme.
#
#   check-upstream.sh sqlite            # detection only, no downloads
#   check-upstream.sh sqlite --apply    # resolve, hash, and rewrite the pins
#   check-upstream.sh sqlean [--apply]
#
# Detection is kept cheap (one HTTP request or one ls-remote) so callers can
# decide whether the expensive path is worth running.
#
# Edits only, verifies nothing -- the tripwires live in `make prepare-src
# download-sqlite download-sqlean`, which the caller runs afterwards. So writing
# a wrong hash is safe: the next fetch refuses to proceed.
#
# Machine-readable results go to $GITHUB_OUTPUT when set; a Markdown PR body
# goes to stdout.

set -euo pipefail

cd "$(dirname "$0")/.."

SQLITE_DOWNLOAD_PAGE="https://sqlite.org/download.html"
XXHASH_REPO="https://github.com/Cyan4973/xxHash.git"

component=${1:-}
apply=${2:-}

if [ "$component" != "sqlite" ] && [ "$component" != "sqlean" ]; then
    echo "usage: $0 {sqlite|sqlean} [--apply]" >&2
    exit 2
fi
if [ -n "$apply" ] && [ "$apply" != "--apply" ]; then
    echo "usage: $0 {sqlite|sqlean} [--apply]" >&2
    exit 2
fi

# The Makefile is the single source of truth; nothing here keeps its own copy.
pin() {
    sed -n "s/^$1 := \(.*\)/\1/p" Makefile | head -1
}

# Through a temp file rather than `sed -i`: the BSD and GNU spellings of that
# flag are incompatible, and this runs on both macOS and the CI runners.
set_pin() {
    local file=$1 name=$2 value=$3 tmp
    tmp=$(mktemp)
    awk -v n="$name" -v v="$value" -v sep="$4" '
        $0 ~ "^" n " " sep " " { print n " " sep " " v; next }
        { print }
    ' "$file" > "$tmp"
    mv "$tmp" "$file"
}

emit() {
    [ -n "${GITHUB_OUTPUT:-}" ] && echo "$1=$2" >> "$GITHUB_OUTPUT"
    return 0
}

# Peel an annotated tag to its commit; a lightweight tag has no ^{} line, so
# fall back to the ref. Pinning a tag object instead of a commit would make the
# later `git checkout` behave differently than intended.
tag_commit() {
    local repo=$1 tag=$2 refs peeled
    refs=$(git ls-remote "$repo" "refs/tags/$tag" "refs/tags/$tag^{}")
    peeled=$(echo "$refs" | grep '\^{}$' | cut -f1)
    if [ -n "$peeled" ]; then echo "$peeled"; else echo "$refs" | cut -f1; fi
}

case "$component" in
sqlite)
    current=$(pin SQLITE_VERSION)
    # sqlite.org's machine-readable line carries the whole bump:
    #   PRODUCT,<version>,<year>/sqlite-amalgamation-<packed>.zip,<size>,<sha3>
    product=$(curl -fsSL "$SQLITE_DOWNLOAD_PAGE" \
        | grep -E '^PRODUCT,[^,]+,[0-9]{4}/sqlite-amalgamation-[0-9]+\.zip,' | head -1)
    if [ -z "$product" ]; then
        echo "::error::No amalgamation PRODUCT line found on $SQLITE_DOWNLOAD_PAGE" >&2
        exit 1
    fi
    IFS=, read -r _ human relpath _ sha3 <<< "$product"
    year=${relpath%%/*}
    packed=${relpath##*/sqlite-amalgamation-}
    packed=${packed%.zip}

    emit current "$current"
    emit latest "$packed"
    if [ "$packed" -le "$current" ]; then
        emit outdated false
        echo "SQLite pin $current is current (latest $packed)." >&2
        exit 0
    fi
    emit outdated true
    emit version "$human"
    emit title "fix(phoenix-sqlean): bump bundled SQLite to $human"
    emit branch "deps/phoenix-sqlean-sqlite-$human"

    if [ "$apply" != "--apply" ]; then
        echo "SQLite $human ($packed) is newer than the pinned $current." >&2
        exit 0
    fi

    # Before set_pin runs: pin() would otherwise read back the new value.
    old_year=$(pin SQLITE_RELEASE_YEAR)
    old_sha=$(pin SQLITE_SHA256)

    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' EXIT
    curl -fsSL "https://sqlite.org/$relpath" --output "$tmpdir/sqlite.zip"
    # Confirm against the published SHA3-256 before recording anything;
    # skipping it would make the pin trust-on-first-use.
    got=$(python3 -c "import hashlib,sys;print(hashlib.sha3_256(open(sys.argv[1],'rb').read()).hexdigest())" "$tmpdir/sqlite.zip")
    if [ "$got" != "$sha3" ]; then
        echo "::error::SHA3-256 mismatch for $relpath (published $sha3, got $got)" >&2
        exit 1
    fi
    # shasum is the one hash tool on both macOS and the CI runners, and it
    # cannot do SHA3 -- hence the two-hash dance.
    sha256=$(shasum -a 256 "$tmpdir/sqlite.zip" | cut -d' ' -f1)

    set_pin Makefile SQLITE_RELEASE_YEAR "$year" ":="
    set_pin Makefile SQLITE_VERSION "$packed" ":="
    set_pin Makefile SQLITE_SHA256 "$sha256" ":="

    cat <<EOF
Bumps the bundled SQLite amalgamation to **$human**.

| Pin | Was | Now |
|---|---|---|
| \`SQLITE_RELEASE_YEAR\` | $old_year | $year |
| \`SQLITE_VERSION\` | $current | $packed |
| \`SQLITE_SHA256\` | \`${old_sha:0:16}...\` | \`${sha256:0:16}...\` |

The download's SHA3-256 was confirmed against the \`PRODUCT\` line on
<$SQLITE_DOWNLOAD_PAGE> before \`SQLITE_SHA256\` was recorded, so this pin is
anchored to what upstream publishes rather than to a single fetch.

Release notes: <https://sqlite.org/releaselog/${human//./_}.html>

Reviewer checklist:

- [ ] \`src/test_windirent.h\` is **not** re-synced. It is pinned at 3.50.4, the
      last release that shipped it, and is deliberately unrelated to this bump.

Generated by \`.github/workflows/phoenix-sqlean-upstream.yml\`.
EOF
    ;;

sqlean)
    repo=$(pin SQLEAN_REPO)
    current=$(pin SQLEAN_VERSION)
    base=${current%%+*}
    # sqlean carries a non-version tag (`incubator`), which a bare
    # `sort -V | tail -1` would pick. Filter to version-shaped tags.
    latest=$(git ls-remote --tags "$repo" | grep -v '\^{}' | sed 's|.*refs/tags/||' \
        | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
    if [ -z "$latest" ]; then
        echo "::error::No version-shaped tags found in $repo" >&2
        exit 1
    fi

    emit current "$base"
    emit latest "$latest"
    # sort -V, not string compare, so a pin deliberately ahead of the newest
    # tag reads as current instead of being walked backwards.
    newest=$(printf '%s\n%s\n' "$base" "$latest" | sort -V | tail -1)
    if [ "$newest" = "$base" ]; then
        emit outdated false
        echo "sqlean pin $current is current (latest tag $latest)." >&2
        exit 0
    fi
    emit outdated true
    emit version "$latest"
    emit title "fix(phoenix-sqlean): bump bundled sqlean to $latest"
    emit branch "deps/phoenix-sqlean-sqlean-$latest"

    if [ "$apply" != "--apply" ]; then
        echo "sqlean $latest is newer than the pinned $base." >&2
        exit 0
    fi

    old_commit=$(pin SQLEAN_COMMIT)
    commit=$(tag_commit "$repo" "$latest")
    tmpdir=$(mktemp -d)
    trap 'rm -rf "$tmpdir"' EXIT

    # Fetched only to read its Makefile: sqlean pins its own xxHash, and ours
    # must move with it (download-sqlean asserts this).
    git -C "$tmpdir" init -q --template=
    git -C "$tmpdir" remote add origin "$repo"
    git -C "$tmpdir" fetch -q --depth 1 origin "$commit"
    git -C "$tmpdir" checkout -q FETCH_HEAD
    xxhash_tag=$(sed -n 's|.*xxhash/raw/\([^/]*\)/xxhash.h.*|\1|p' "$tmpdir/Makefile" | head -1)
    if [ -z "$xxhash_tag" ]; then
        echo "::error::sqlean $latest no longer fetches xxhash.h the expected way; bump by hand" >&2
        exit 1
    fi

    set_pin Makefile SQLEAN_COMMIT "$commit" ":="
    # No +<sha> suffix: this lands exactly on a tag, and check-sqlean-pin
    # rejects a stale one -- so the tripwire validates this script's output.
    set_pin Makefile SQLEAN_VERSION "$latest" ":="
    set_pin setup.py SQLEAN_VERSION "\"$latest\"" "="

    xxhash_note="unchanged (\`$(pin XXHASH_TAG)\`)"
    if [ "$xxhash_tag" != "$(pin XXHASH_TAG)" ]; then
        xxhash_commit=$(tag_commit "$XXHASH_REPO" "$xxhash_tag")
        curl -fsSL "https://github.com/cyan4973/xxhash/raw/$xxhash_commit/xxhash.h" \
            --output "$tmpdir/xxhash.h"
        xxhash_sha=$(shasum -a 256 "$tmpdir/xxhash.h" | cut -d' ' -f1)
        old_tag=$(pin XXHASH_TAG)
        set_pin Makefile XXHASH_TAG "$xxhash_tag" ":="
        set_pin Makefile XXHASH_COMMIT "$xxhash_commit" ":="
        set_pin Makefile XXHASH_SHA256 "$xxhash_sha" ":="
        tmp=$(mktemp)
        sed "s|from xxHash $old_tag |from xxHash $xxhash_tag |" THIRD_PARTY_LICENSES > "$tmp"
        mv "$tmp" THIRD_PARTY_LICENSES
        xxhash_note="**moved $old_tag -> $xxhash_tag** (sqlean changed its own pin)"
    fi

    cat <<EOF
Bumps the bundled sqlean to **$latest**.

| Pin | Was | Now |
|---|---|---|
| \`SQLEAN_VERSION\` | $current | $latest |
| \`SQLEAN_COMMIT\` | \`${old_commit:0:12}...\` | \`$commit\` |
| xxHash | | $xxhash_note |

\`SQLEAN_VERSION\` is set to the plain tag with no \`+<sha>\` suffix, because
this pin lands exactly on \`$latest\`. \`setup.py\` was moved in lockstep, so
\`sqlean_version()\` reports the same string.

Reviewer checklist:

- [ ] **Tag or past it?** This pins the release tag. If a post-release fix is
      wanted instead, retarget \`SQLEAN_COMMIT\` at that commit and add the
      \`+<short sha>\` suffix back to both \`SQLEAN_VERSION\` values.
- [ ] \`src/sqlean-time-msvc.patch\` still applies. If \`patch(1)\` failed in
      CI, regenerate it against the new time sources -- that failure is the
      intended tripwire, not a breakage.

Generated by \`.github/workflows/phoenix-sqlean-upstream.yml\`.
EOF
    ;;
esac
