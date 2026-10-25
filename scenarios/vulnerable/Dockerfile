# Usa a mesma imagem-base nos dois cenários para manter a comparação justa.
FROM node:24-alpine

# Define a pasta de trabalho dentro do container.
WORKDIR /app

# Copia manifests antes do código para facilitar cache das dependências.
COPY package.json ./
COPY package-lock.json ./

# Instala exatamente a dependência travada no lockfile, sem scripts ou auditoria npm.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Copia o serviço de demonstração para dentro da imagem.
COPY app.js ./

# Expõe a porta HTTP usada pelo servidor de demonstração.
EXPOSE 3000
# Inicia o app quando o container é executado.
CMD ["node", "app.js"]
