# INTENTIONALLY VULNERABLE - LAB ONLY
FROM node:20-alpine
WORKDIR /code
COPY package.json .
RUN npm install --no-audit --no-fund
COPY server.js .
EXPOSE 3001
CMD ["node", "server.js"]
