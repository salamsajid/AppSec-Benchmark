#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "docker-compose is required" >&2
  exit 1
fi

echo "Stopping Aetherion and removing the database volume..."
docker-compose down -v --remove-orphans

echo "Building and starting a clean stack..."
docker-compose up -d --build

echo "Waiting for the API..."
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:18080/api/health >/dev/null 2>&1; then
    echo "Aetherion is ready at http://127.0.0.1:18080"
    echo "Collaborator: http://127.0.0.1:18081"
    exit 0
  fi
  sleep 1
done

echo "Stack did not become ready in time. Recent logs:" >&2
docker-compose ps >&2
docker-compose logs --tail=80 api edge >&2
exit 1
