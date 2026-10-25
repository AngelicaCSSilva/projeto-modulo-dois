const http = require("node:http");
const decodeUriComponent = require("decode-uri-component");

// A porta pode ser sobrescrita para facilitar execução local ou em container.
const port = Number(process.env.PORT || 3000);

// Este serviço bancário fictício é intencionalmente pequeno: ele simula uma
// consulta de pagamento para que a demonstração foque na dependência testada.
const server = http.createServer((request, response) => {
  // Separa caminho e query string sem decodificar a query automaticamente.
  // Assim, a sequência percent-encoded chega intacta à dependência abaixo.
  const [path, rawQuery = ""] = request.url.split("?", 2);
  console.log(`[http] ${request.method} ${request.url}`);

  // A rota inicial serve apenas para a verificação de disponibilidade do workflow.
  if (request.method !== "GET" || path !== "/payment") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("Demo bancária local. Use GET /payment?reference=...\n");
    return;
  }

  // Extrai o parâmetro de pagamento da URL recebida pelo servidor.
  const pair = rawQuery.split("&").find((part) => part.startsWith("reference="));
  const encodedReference = pair ? pair.slice("reference=".length) : "";

  // O valor controlado pelo cliente vai direto ao pacote de decodificação.
  // A versão da dependência é a única diferença entre os cenários.
  console.log(`[decode] Iniciando decodificacao da referencia recebida (${encodedReference.length} caracteres).`);
  const reference = decodeUriComponent(encodedReference);
  console.log("[decode] Decodificacao concluida.");

  // Se a decodificação terminar, responde como uma consulta fictícia normal.
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify({ status: "pagamento encontrado", reference }));
});

// Escuta em todas as interfaces do container, mas o workflow publica a porta
// apenas em 127.0.0.1 para limitar o acesso ao ambiente de demonstração.
server.listen(port, "0.0.0.0", () => console.log(`Demo escutando na porta ${port}`));
