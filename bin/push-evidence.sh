#!/usr/bin/env bash
# Usage: push-evidence.sh <project-data-folder> <KEY>      (run from the target repo root)
#
# Publishes the screenshots in <project-data-folder>/screenshots/<KEY>/ to the orphan branch
# `agent-evidence`, under <KEY>/<timestamp>/, so evidence never lands in the code history.
# Prints one "<file> <url>" line per published file, for PR bodies and escalation records.
set -euo pipefail
[[ $# -eq 2 ]] || { echo "usage: push-evidence.sh <project-data-folder> <KEY>" >&2; exit 1; }
src=$1/screenshots/$2
[[ -d "$src" ]] || { echo "push-evidence: nothing to publish in $src" >&2; exit 0; }

branch=agent-evidence
dest=$2/$(date -u +%Y%m%dT%H%M%SZ)
nwo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
tmp=$(mktemp -d); local_branch=""
cleanup() {
  git worktree remove --force "$tmp" 2>/dev/null || rm -rf "$tmp"
  [[ -z "$local_branch" ]] || git branch -q -D "$local_branch" 2>/dev/null || true
}
trap cleanup EXIT

if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  git fetch -q origin "$branch"
  git worktree add -q --detach "$tmp" FETCH_HEAD
else
  local_branch=tessera-evidence-$$
  git worktree add -q --detach "$tmp" HEAD
  git -C "$tmp" checkout -q --orphan "$local_branch"
  git -C "$tmp" rm -rq --cached . && git -C "$tmp" clean -fdxq
fi

mkdir -p "$tmp/$dest"
cp -R "$src"/. "$tmp/$dest/"
git -C "$tmp" add -A "$dest"
git -C "$tmp" commit -q -m "$2: evidence $(basename "$dest")"
git -C "$tmp" push -q origin "HEAD:refs/heads/$branch"

(cd "$tmp/$dest" && find . -type f | sed 's|^\./||' | sort) | while read -r f; do
  echo "$f https://github.com/$nwo/blob/$branch/$dest/$f"
done
