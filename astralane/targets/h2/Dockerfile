FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY targets/h2/package.json ./
COPY targets/h2/src ./src

USER node
EXPOSE 8084

HEALTHCHECK --interval=10s --timeout=3s --retries=12 \
  CMD node -e "const h=require('node:http2');const c=h.connect('http://127.0.0.1:8084');c.on('connect',()=>{c.close();process.exit(0)});c.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)"

CMD ["node", "src/index.js"]
