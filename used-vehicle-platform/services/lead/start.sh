#!/bin/sh
# Run Flask HTTP + WS sidecar (both intentionally vulnerable)
python ws_server.py &
python app.py
