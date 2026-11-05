# UVP API Gateway - NGINX
# INTENTIONALLY VULNERABLE - LAB ONLY. Do not expose to internet.
# Phase 4: H1+H2 dual front-end, TE/CL passthrough, flawed cache keys.
FROM nginx:1.27-alpine
RUN apk add --no-cache openssl && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/key.pem -out /etc/nginx/cert.pem -subj "/CN=uvp-lab"
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 8080 8443
