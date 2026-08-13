FROM node:20-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY server.js ./
COPY services/ ./services/
COPY src/ ./src/

EXPOSE 3001

CMD ["npm", "start"]