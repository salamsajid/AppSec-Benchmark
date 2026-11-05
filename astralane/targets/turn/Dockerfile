FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY targets/turn/package.json ./
COPY targets/turn/src ./src
USER node
EXPOSE 3478/udp
HEALTHCHECK --interval=10s --timeout=4s --retries=12 \
  CMD node -e "const d=require('node:dgram').createSocket('udp4');d.send(Buffer.from('ping'),3478,'127.0.0.1',()=>{d.close();process.exit(0)});setTimeout(()=>process.exit(1),2000)"
CMD ["node", "src/index.js"]
