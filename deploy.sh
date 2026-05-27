#!/bin/bash
set -e

git stash
git pull
git stash drop 2>/dev/null || true

npm install
npm run build
pm2 restart slumpadrotation

echo "Deploy klar."
