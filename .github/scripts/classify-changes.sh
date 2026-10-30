#!/usr/bin/env bash
# Decides what CI has to do for this push or pull request, from the files it changed.
#
#   run=false       nothing that is built or tested changed (documentation, notes, root
#                   assets): the verify job is skipped, which GitHub reports as success
#   mode=full       a file every package depends on changed (lockfile, root package.json,
#                   workspace or Turborepo config, CI itself), or there is no reliable base
#                   to compare with (new branch, force-push): every package is checked
#   mode=affected   only the packages whose files changed, plus every package that depends
#                   on them (Turborepo's "...[base]" filter), so a change in packages/auth
#                   also tests platform-api, check-printing-backend and Clock-In
#
# Inputs (environment): EVENT_NAME, HEAD_SHA, PR_BASE_SHA (pull requests), BEFORE_SHA (pushes)
# Outputs ($GITHUB_OUTPUT): run, mode, base
set -euo pipefail

ZERO_SHA="0000000000000000000000000000000000000000"

out() { echo "$1=$2" >>"$GITHUB_OUTPUT"; }
summary() { echo "$1" >>"$GITHUB_STEP_SUMMARY"; }

run_full() {
  out run true
  out mode full
  out base ""
  summary "### Scope: everything"
  summary "$1"
  exit 0
}

if [[ "$EVENT_NAME" == "pull_request" ]]; then
  BASE_SHA="${PR_BASE_SHA:-}"
else
  BASE_SHA="${BEFORE_SHA:-}"
fi

# A new branch has no "before"; after a force-push the old tip is no longer in history.
if [[ -z "$BASE_SHA" || "$BASE_SHA" == "$ZERO_SHA" ]] || ! git cat-file -e "${BASE_SHA}^{commit}" 2>/dev/null; then
  run_full "No comparable base commit (new branch or force-push), so every package is checked."
fi

MERGE_BASE="$(git merge-base "$BASE_SHA" "$HEAD_SHA" 2>/dev/null)" ||
  run_full "The base and this commit share no history, so every package is checked."

# Every changed path. --no-renames lists a moved file under its old AND new name, so a
# deleted or moved file still marks the package it was removed from.
mapfile -t FILES < <(git diff --name-only --no-renames "$MERGE_BASE" "$HEAD_SHA")

# Files every package depends on: any change re-checks everything.
GLOBAL_RE='^(pnpm-lock\.yaml|package\.json|pnpm-workspace\.yaml|turbo\.json|\.npmrc|\.nvmrc|\.node-version|\.github/workflows/ci\.yml|\.github/scripts/.*)$'
# Not built or tested anywhere: documentation and notes.
DOCS_RE='(\.md|\.mdx|\.txt)$|^project-docs/|^docs/|(^|/)LICENSE[^/]*$|^\.vscode/|^\.gitignore$|(^|/)\.gitkeep$'

code=()
global=()
for f in "${FILES[@]}"; do
  if [[ "$f" =~ $GLOBAL_RE ]]; then
    global+=("$f")
  elif [[ "$f" =~ $DOCS_RE ]]; then
    continue
  elif [[ "$f" == apps/* || "$f" == packages/* ]]; then
    code+=("$f")
  fi
  # Anything else (root PDFs, archives, docker-compose files) is not part of any package
  # and is not built or tested here.
done

summary "Compared with \`${MERGE_BASE:0:12}\`: ${#FILES[@]} changed file(s)."

if ((${#global[@]} > 0)); then
  run_full "Shared configuration changed (${global[*]}), so every package is checked."
fi

if ((${#code[@]} == 0)); then
  out run false
  out mode none
  out base ""
  summary "### Scope: nothing to build or test"
  summary "Only documentation or files outside apps/ and packages/ changed."
  exit 0
fi

out run true
out mode affected
out base "$MERGE_BASE"
summary "### Scope: changed packages and everything that depends on them"
summary "${#code[@]} changed file(s) under apps/ and packages/."
