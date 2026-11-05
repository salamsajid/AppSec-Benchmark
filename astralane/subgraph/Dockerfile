FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY subgraph/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY subgraph/src ./src

USER node
EXPOSE 4001

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:4001/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
