FROM node:22-alpine AS native
RUN apk add --no-cache build-base python3
WORKDIR /native
COPY targets/node/native ./
RUN npm init -y >/dev/null && npm install --no-audit --no-fund node-gyp && npx node-gyp rebuild

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY targets/node/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY targets/node/src ./src
COPY --from=native /native/build/Release/als_context.node ./src/als_context.node

USER node
EXPOSE 8082

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:8082/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
