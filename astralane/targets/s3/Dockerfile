FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY targets/s3/package.json ./
COPY targets/s3/src ./src
USER node
EXPOSE 9000
HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD wget -q -O /dev/null http://127.0.0.1:9000/health || exit 1
CMD ["node", "src/index.js"]
