# =========================
# Stage 1: Build React app
# =========================
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY public/ ./public/
COPY src/ ./src/

# Backend URL used by the browser
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build


# =========================
# Stage 2: Nginx
# =========================
FROM nginx:alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy React production build
COPY --from=builder /app/build /usr/share/nginx/html

# SPA routing support
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]