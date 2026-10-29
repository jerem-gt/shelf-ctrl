#!/bin/sh
# Contrôles propres à shelf-ctrl, après ceux du workflow commun (santé, front, docs).
# Usage : smoke-test.sh <url de base> <nom du conteneur>
set -eu
BASE_URL=$1
CONTAINER=$2

# Jeton de premier démarrage lu dans les logs du conteneur
TOKEN=$(docker logs "$CONTAINER" 2>&1 | grep -o 'setup token: [A-Za-z0-9_-]*' | tail -1 | cut -d' ' -f3)
if [ -z "$TOKEN" ]; then
  echo "Jeton de setup introuvable dans les logs" >&2
  exit 1
fi

# Création du premier compte (admin) : bcrypt et SQLite
curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"username\":\"smoke\",\"password\":\"smoke-password\"}" \
  "$BASE_URL/api/auth/setup"

# Login avec ce compte
curl -fsS -o /dev/null -X POST -H 'Content-Type: application/json' \
  -d '{"username":"smoke","password":"smoke-password"}' \
  "$BASE_URL/api/auth/login"

# sharp : binaire musl et libvips chargés, conversion WebP
docker exec "$CONTAINER" node -e \
  "require('sharp')({create:{width:1,height:1,channels:3,background:'#000'}}).webp().toBuffer()"
