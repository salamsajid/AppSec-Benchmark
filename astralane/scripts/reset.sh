#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="${COMPOSE:-docker-compose}"

echo "This removes the AstraLane Postgres and Redis volumes."
echo "All bookings, wallets, sessions, and challenge state will be recreated from seed."
printf 'Continue? [y/N] '
read -r answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) echo "Aborted."; exit 1 ;;
esac

$COMPOSE down -v --remove-orphans
$COMPOSE up -d --build
$COMPOSE ps
