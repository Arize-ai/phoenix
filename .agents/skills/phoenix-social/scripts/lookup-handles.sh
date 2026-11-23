#!/usr/bin/env bash
# Prints the social accounts GitHub users list on their own profiles, to credit them in a post.
#
#   lookup-handles.sh <github-login> [<github-login> ...]
#
# Output is tab-separated: login, name, X, Bluesky, LinkedIn, other. A dash means the user lists
# no such account. Only accounts the user published are printed; nothing is inferred.
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $(basename "$0") <github-login> [<github-login> ...]" >&2
  exit 2
fi

printf 'login\tname\tx\tbluesky\tlinkedin\tother\n'
for login in "$@"; do
  profile="$(gh api "users/${login}")"
  accounts="$(gh api "users/${login}/social_accounts")"
  name="$(jq -r '.name // "-"' <<<"$profile")"
  x="$(jq -r --argjson profile "$profile" '
    ([.[] | select(.provider == "twitter") | .url | capture("(?:x|twitter)\\.com/(?<h>[^/?#]+)").h]
      + [($profile.twitter_username // empty)])
    | unique | map("@" + .) | join(",") | if . == "" then "-" else . end' <<<"$accounts")"
  bluesky="$(jq -r '[.[] | select(.provider == "bluesky") | .url | capture("profile/(?<h>[^/?#]+)").h]
    | map("@" + .) | join(",") | if . == "" then "-" else . end' <<<"$accounts")"
  linkedin="$(jq -r '[.[] | select(.provider == "linkedin") | .url] | join(",") | if . == "" then "-" else . end' <<<"$accounts")"
  other="$(jq -r '[.[] | select(.provider != "twitter" and .provider != "bluesky" and .provider != "linkedin") | .url]
    | join(",") | if . == "" then "-" else . end' <<<"$accounts")"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$login" "$name" "$x" "$bluesky" "$linkedin" "$other"
done
