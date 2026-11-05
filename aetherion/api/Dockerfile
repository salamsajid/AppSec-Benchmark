FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
RUN mkdir -p /app/keys/invoices && printf '%s\n' 'aetherion-partner-shipment-hmac-2026-7f31c9' > /app/keys/partner-2026.pem && printf '%s\n' 'AETH{invoice_path_traversal_1e7a}' 'settled,txn,amount' 'INV-1001,aeth-txn-7741,449999' > /app/keys/reconciliation-2026.csv && printf '%s\n' 'Aetherion invoice current' 'No balance due.' > /app/keys/invoices/current.txt && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "src/index.js"]
