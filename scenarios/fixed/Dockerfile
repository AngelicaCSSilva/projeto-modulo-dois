
# Etapa 1: instalação das dependências
FROM node:24-alpine3.23 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY app.js ./

# Etapa 2: imagem final sem npm
FROM alpine:3.23

RUN apk add --no-cache libstdc++ \
    && addgroup -S app \
    && adduser -S -G app app

WORKDIR /app

# Copia somente o executável Node.js
COPY --from=builder /usr/local/bin/node /usr/local/bin/node

# Copia a aplicação e suas dependências
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/package.json ./package.json
COPY --from=builder --chown=app:app /app/app.js ./app.js

ENV NODE_ENV=production

USER app

EXPOSE 3000

CMD ["node", "app.js"]
