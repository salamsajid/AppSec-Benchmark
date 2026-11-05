# INTENTIONALLY VULNERABLE - LAB ONLY
FROM python:3.11-slim

LABEL maintainer="fleet-leads@automarket.internal"
LABEL org.automarket.fleet.dispatch_version="v2.4-telemetry"
LABEL org.automarket.fleet.sync_secret="LAB{docker_lead_image_label_secret}"

WORKDIR /code
RUN apt-get update && apt-get install -y --no-install-recommends iputils-ping curl dnsutils libxml2-dev libxslt-dev gcc libc6-dev && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ws_server.py start.sh evil.dtd ./

# Flaw: SUID root helper binary compiled into image filesystem
RUN echo '#include <stdio.h>\n#include <unistd.h>\nint main() { setuid(0); printf("FLEET_DIAGNOSTIC_ROOT_EVAL: LAB{docker_suid_privilege_escalation}\\n"); return 0; }' > /tmp/fleet-diag.c && \
    gcc -O2 -o /usr/local/bin/fleet-diag /tmp/fleet-diag.c && \
    chmod 4755 /usr/local/bin/fleet-diag && \
    rm -f /tmp/fleet-diag.c

RUN chmod +x start.sh && mkdir -p exports && echo "LAB{xxe_secret_flag}" > /secret.txt && echo "LAB{xxe_secret_flag}" > ./secret.txt && echo "lead-secret" > /tmp/lead-flag.txt
EXPOSE 5000 5001
CMD ["sh", "start.sh"]

