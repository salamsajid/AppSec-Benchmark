FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY public ./public
RUN chown -R node:node /app

USER node
EXPOSE 8081
CMD ["node", "src/index.js"]
