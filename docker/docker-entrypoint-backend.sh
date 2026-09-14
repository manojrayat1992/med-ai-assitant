#!/bin/sh
set -e

# Ensure model caches are owned by medai user
mkdir -p /home/medai/.djl.ai /home/medai/.spring-ai-onnx 2>/dev/null || true
chown -R medai:medai /home/medai 2>/dev/null || true

# Execute java as unprivileged medai user
exec gosu medai java -jar /app/app.jar "$@"
