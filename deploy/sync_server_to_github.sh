#!/bin/bash
# Brings a server's git checkout back in line with GitHub WITHOUT losing anything.
#
# Why: the beta and production servers run code that was copied in by hand (rsync), so their git
# history is behind GitHub and their working trees hold uncommitted files. A later `git pull` or
# `git reset` there could overwrite or conflict with them.
#
# What it does (runs ON the server, from the repo folder):
#   1. Lists every changed / new file and BACKS THEM ALL UP to a tar file (before touching anything)
#   2. Fetches GitHub
#   3. Checks that every changed file is identical to a version that already exists on GitHub.
#      Anything unrecognised (a server-only edit) makes it STOP. Nothing is thrown away silently.
#      Files that belong only to this server are named in KEEP_FILES and are left alone.
#   4. Discards the now-redundant local copies, then fast-forwards / merges to GitHub's branch
#   5. Puts the KEEP_FILES back exactly as they were
#
# It never restarts containers and never rebuilds anything. Running services are not affected.
#
# Environment variables (set by the wrapper script on your Mac):
#   REPO         folder of the checkout, e.g. /var/www/scooby_pets-beta
#   MERGE_FROM   GitHub branch to bring in, e.g. feature/my-new-frontend-task
#   MODE         ff    = fast-forward only (beta)
#                merge = normal merge commit (production-deploy)
#   KEEP_MODIFIED  tracked files that are server-only settings, space separated
#   KEEP_UNTRACKED untracked files that belong only to this server, space separated
#   BACKUP_DIR   where the backup tar goes (default /root)
#   TAG          short label for the backup name (beta / prod)
set -euo pipefail

REPO="${REPO:?set REPO}"
MERGE_FROM="${MERGE_FROM:?set MERGE_FROM}"
MODE="${MODE:-ff}"
KEEP_MODIFIED="${KEEP_MODIFIED:-}"
KEEP_UNTRACKED="${KEEP_UNTRACKED:-}"
BACKUP_DIR="${BACKUP_DIR:-/root}"
TAG="${TAG:-server}"
STAMP=$(date +%Y%m%d-%H%M%S)

cd "$REPO"
BRANCH=$(git branch --show-current)
BEFORE=$(git rev-parse --short HEAD)
echo "Folder : $REPO"
echo "Branch : $BRANCH   now at $BEFORE"
echo "Bring in: origin/$MERGE_FROM   (mode: $MODE)"
echo

in_list() { local x="$1"; shift; for i in "$@"; do [ "$i" = "$x" ] && return 0; done; return 1; }

# ---- 1. back up every changed / new file -------------------------------------------------------
LIST=$(mktemp)
git status --porcelain -uall | cut -c4- > "$LIST"
COUNT=$(wc -l < "$LIST" | tr -d ' ')
if [ "$COUNT" -gt 0 ]; then
  BK="$BACKUP_DIR/${TAG}-pre-sync-$STAMP.tgz"
  tar czf "$BK" -T "$LIST"
  chmod 600 "$BK"
  echo "1. Backed up $COUNT changed/new file(s) to $BK"
else
  echo "1. Nothing changed locally, nothing to back up"
fi

# ---- 2. fetch ----------------------------------------------------------------------------------
git fetch origin
TARGET="origin/$MERGE_FROM"
git rev-parse --verify -q "$TARGET" >/dev/null || { echo "ERROR: $TARGET not found after fetch"; exit 1; }
echo "2. Fetched GitHub. $TARGET is at $(git rev-parse --short "$TARGET")"

# ---- 3. verify every changed file is already on GitHub -----------------------------------------
MODIFIED=(); UNTRACKED=()
while IFS= read -r line; do
  st="${line:0:2}"; f="${line:3}"
  if [ "$st" = "??" ]; then UNTRACKED+=("$f"); else MODIFIED+=("$f"); fi
done < <(git status --porcelain -uall)

BAD=0
for f in "${MODIFIED[@]+"${MODIFIED[@]}"}"; do
  in_list "$f" $KEEP_MODIFIED && { echo "   keep   (server-only) $f"; continue; }
  if [ ! -f "$f" ]; then echo "   STOP   deleted file not expected: $f"; BAD=1; continue; fi
  found=0
  for c in $(git log --format=%H "$TARGET" -- "$f"); do
    if git show "$c:$f" 2>/dev/null | cmp -s - "$f"; then found=1; break; fi
  done
  if [ $found -eq 1 ]; then echo "   ok     same as a GitHub version: $f"; else echo "   STOP   NOT on GitHub (server-only edit): $f"; BAD=1; fi
done
for f in "${UNTRACKED[@]+"${UNTRACKED[@]}"}"; do
  in_list "$f" $KEEP_UNTRACKED && { echo "   keep   (server-only) $f"; continue; }
  if git show "$TARGET:$f" 2>/dev/null | cmp -s - "$f"; then echo "   ok     new file already on GitHub: $f"; else echo "   STOP   new file NOT on GitHub or different: $f"; BAD=1; fi
done
if [ $BAD -ne 0 ]; then
  echo; echo "STOPPED: found files that exist only on this server. Nothing was changed."
  echo "(Your backup is still at ${BK:-none}.) Tell Claude which files were listed above."
  exit 1
fi
echo "3. Every changed file is either on GitHub already or marked as server-only."

# ---- 4. discard redundant copies, then bring in GitHub -----------------------------------------
KEEPDIR=$(mktemp -d)
for f in $KEEP_MODIFIED; do
  [ -f "$f" ] && { mkdir -p "$KEEPDIR/$(dirname "$f")"; cp -p "$f" "$KEEPDIR/$f"; }
done
for f in "${MODIFIED[@]+"${MODIFIED[@]}"}"; do git checkout -- "$f"; done
for f in "${UNTRACKED[@]+"${UNTRACKED[@]}"}"; do
  in_list "$f" $KEEP_UNTRACKED || rm -f -- "$f"
done

if [ "$MODE" = "ff" ]; then
  git merge --ff-only "$TARGET"
else
  if ! git merge --no-edit "$TARGET"; then
    echo "MERGE CONFLICT. Undoing the merge and restoring your files."
    git merge --abort || true
    tar xzf "${BK:-/dev/null}" 2>/dev/null || true
    exit 1
  fi
fi
echo "4. Now at $(git rev-parse --short HEAD) on $BRANCH"

# ---- 5. put the server-only files back ---------------------------------------------------------
for f in $KEEP_MODIFIED; do
  [ -f "$KEEPDIR/$f" ] && cp -p "$KEEPDIR/$f" "$f"
done
echo "5. Restored server-only files"

echo
echo "Result:"
echo "  branch $BRANCH: $BEFORE -> $(git rev-parse --short HEAD)"
echo "  remaining local differences (should be only the server-only files):"
git status --short | sed 's/^/    /'
