# Stage 1: Build da aplicação React/Vite
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Servidor leve Nginx para produção
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuração simples para rotas estáticas e fallback SPA
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
