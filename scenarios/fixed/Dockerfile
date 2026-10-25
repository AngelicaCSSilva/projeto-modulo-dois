# Usa a mesma imagem-base nos dois cenários para manter a comparação justa.
FROM node:24-alpine

# Define a pasta de trabalho dentro do container.
WORKDIR /app

# Atualiza o npm e corrige a dependência interna undici, ainda desatualizada no
# bundle do npm 12.2.1. As versões fixas tornam essa atualização reproduzível.
RUN npm install --global npm@12.2.1 --ignore-scripts --no-audit --no-fund \
    && mkdir -p /tmp/undici-patch \
    && npm pack undici@6.29.1 --pack-destination /tmp/undici-patch --ignore-scripts \
    && rm -rf /usr/local/lib/node_modules/npm/node_modules/undici \
    && mkdir -p /usr/local/lib/node_modules/npm/node_modules/undici \
    && tar -xzf /tmp/undici-patch/undici-6.29.1.tgz --strip-components=1 \
       -C /usr/local/lib/node_modules/npm/node_modules/undici \
    && rm -rf /tmp/undici-patch \
    && node -e "const root='/usr/local/lib/node_modules/npm/node_modules/'; for (const [name, expected] of [['brace-expansion','5.0.12'],['undici','6.29.1']]) { if (require(root+name+'/package.json').version !== expected) process.exitCode=1; }"

# Copia os manifests antes do código para aproveitar o cache de dependências.
COPY package.json ./
COPY package-lock.json ./

# Instala exatamente a dependência da aplicação travada no lockfile.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Copia o serviço de demonstração para dentro da imagem.
COPY app.js ./

# Executa com usuário não privilegiado node.
USER node

# Expõe a porta HTTP usada pelo servidor de demonstração.
EXPOSE 3000
# Inicia o app quando o container é executado.
CMD ["node", "app.js"]
