FROM mcr.microsoft.com/playwright:v1.64.1-noble

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app
COPY targets/browser/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY targets/browser/src ./src

EXPOSE 8094
CMD ["node", "src/index.js"]
