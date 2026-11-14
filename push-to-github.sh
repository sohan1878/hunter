#!/usr/bin/env sh
# Run this inside the hunter-app folder:  sh push-to-github.sh
set -e
REPO="https://github.com/sohan1878/hunter.git"
cd "$(dirname "$0")"
[ -d .git ] || git init -b main
git add -A
git commit -m "Hunter System: quests, equipment modes, exercise library, guided sessions, reminders, progress photos" || true
git remote remove origin 2>/dev/null || true
git remote add origin "$REPO"
git push -u origin main
