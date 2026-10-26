#!/bin/sh
# Contrôles propres à shelf-ctrl, après ceux du workflow commun (santé, front, docs).
# Usage : smoke-test.sh <url de base> <nom du conteneur>
set -eu
BASE_URL=$1
CONTAINER=$2

# Login : bcrypt et SQLite
curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"smoke-password"}' \
  "$BASE_URL/api/auth/login"

# sharp : binaire musl et libvips chargés, conversion WebP
docker exec "$CONTAINER" node -e \
  "require('sharp')({create:{width:1,height:1,channels:3,background:'#000'}}).webp().toBuffer()"
