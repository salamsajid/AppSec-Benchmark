FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY targets/qpack/package.json ./
COPY targets/qpack/src ./src
USER node
EXPOSE 8086
HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD wget -q -O /dev/null http://127.0.0.1:8086/health || exit 1
CMD ["node", "src/index.js"]
