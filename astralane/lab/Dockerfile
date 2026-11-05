FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY lab/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY lab/src ./src
COPY shared/flags.json ./shared/flags.json

USER node
EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:8081/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
