# Projeto Final do Segundo Módulo - Especialista em Esteira DevSecOps

> [!IMPORTANT]
> **Última atualização: 31/10/2026.** Vulnerabilidades divulgadas após essa data não serão corrigidas neste projeto.

Projeto final do segundo módulo da formação em Especialista em Esteira DevSecOps da ADA. A demonstração usa uma aplicação fictícia de pagamentos para mostrar dois riscos: uma dependência vulnerável e a execução de um container como `root`.

> [!NOTE]
> **Escopo da demonstração:** este projeto aborda um risco de segurança na cadeia de suprimentos de software causado por uma dependência de terceiros vulnerável e demonstra riscos de configuração da imagem definidos nos Dockerfiles: execução do processo como `root` e inclusão de componentes herdados da imagem-base. Ele não simula a publicação deliberada de código malicioso, o comprometimento do mantenedor ou do processo de build. A biblioteca contém uma falha que um atacante pode explorar enviando uma entrada HTTP preparada; neste cenário, o efeito demonstrado é DoS.

<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/7a03aa63-046d-443d-8bdc-4367907744f4" />


## Navegação

- [Visão geral](#projeto-final-do-segundo-módulo---especialista-em-esteira-devsecops)
- [Cadeia de suprimentos](#vulnerabilidade-na-cadeia-de-suprimentos)
- [Usuário privilegiado](#vulnerabilidade-de-usuário-privilegiado)
- [Comparação dos cenários](#comparação-dos-cenários)
- [Demonstrações](#indisponibilidade-via-http--cadeia-de-suprimentos)
- [Correções](#correções-realizadas)
- [Workflow Security Scan](#funcionamento-do-workflow-security-scan)
- [Como executar](#como-executar)

## Vulnerabilidade na cadeia de suprimentos

A aplicação usa o pacote npm `decode-uri-component` para decodificar a referência de um pagamento recebida pela URL. No cenário vulnerável, a dependência está fixada na versão **0.2.0**, afetada pela CVE-2022-38900.

### O que significa a sequência com %

Em uma URL, o caractere `%` inicia uma sequência de codificação percentual: os dois caracteres seguintes representam o valor de um byte em hexadecimal. Por exemplo, `%5A` representa o byte hexadecimal 5A, correspondente à letra ASCII **Z**. Essa codificação permite transportar bytes especiais dentro de uma URL.

A referência usada na demonstração é:

```text
%ea%ba%5a%ba
```

Ela representa os bytes EA BA 5A BA. Essa sequência não forma texto UTF-8 válido: EA inicia um caractere UTF-8 de três bytes, BA é um byte de continuação, mas 5A representa a letra Z e não pode ocupar essa posição de continuação. Ao tentar decodificar a entrada malformada, a versão 0.2.0 de `decode-uri-component` pode lançar uma exceção não tratada.

### Como a entrada chega ao pacote

O serviço recebe a referência no parâmetro `reference` da rota `/payment`. O `app` extrai a query string sem decodificá-la previamente e passa o valor recebido diretamente para `decode-uri-component`. Isso permite que a dependência processe a sequência original e reproduza o erro.

```text
http://localhost:3000/payment?reference=%ea%ba%5a%ba
```

Uma pessoa atacante que consiga alcançar o serviço pode enviar uma requisição HTTP como essa; não precisa executar código dentro do servidor nem ter a dependência instalada em sua máquina. Como a aplicação não captura a exceção, o processo Node.js encerra e deixa de atender a novas requisições. Repetir as requisições pode prolongar a indisponibilidade, inclusive quando um gerenciador de processos reinicia o serviço após cada queda.

Isso demonstra uma negação de serviço (DoS), não roubo de dados nem alteração de pagamentos. Uma única origem enviando requisições não caracteriza um DDoS, que normalmente envolve tráfego distribuído de várias fontes. O impacto depende de como a aplicação usa a dependência e trata erros; nem todo aplicativo que instala o pacote é automaticamente explorável.

Para reproduzir localmente, com o cenário vulnerável em execução:

```bash
curl -i 'http://localhost:3000/payment?reference=%ea%ba%5a%ba'
```

No workflow, o cliente separado `scripts/demo-attack.mjs` envia essa única requisição e registra a falha de conexão. O workflow então confere se o container vulnerável encerrou. No cenário corrigido, a dependência 0.5.1 processa a entrada e o serviço responde HTTP 200.

### Outra falha na mesma dependência: CVE-2026-118664

O [advisory GHSA-qr28-fpjm-wq7f](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) identifica uma segunda vulnerabilidade de negação de serviço em `decode-uri-component` nas versões até 0.5.0. Portanto, a versão 0.2.0 do cenário vulnerável é afetada tanto pela CVE-2022-38900 quanto pela CVE-2026-118664. A versão 0.5.1, usada no cenário corrigido, contém a correção dessa falha mais recente.

A CVE-2026-118664 é diferente do crash reproduzido acima: entradas longas com muitos trechos percent-encoded distintos, seguidas de uma sequência inválida como %zz, podem acionar um processamento de complexidade quadrática e ocupar o event loop do Node.js. O advisory estima que uma entrada de cerca de 224 KB possa bloquear o processo por aproximadamente 20 segundos.

O workflow deste projeto não reproduz essa segunda CVE: ele envia a sequência curta %ea%ba%5a%ba para demonstrar a CVE-2022-38900. O advisory observa que limites de tamanho da requisição reduzem o impacto prático quando a entrada vem de uma URL; aplicações que decodificam corpos de requisição não confiáveis podem ter maior exposição.
Referências: [aviso da CVE-2022-38900](https://github.com/advisories/GHSA-w573-4hg7-7wgq) e [relato da sequência de exemplo](https://github.com/SamVerschueren/decode-uri-component/issues/5).

## Vulnerabilidade de usuário privilegiado

Quando um Dockerfile não define a instrução `USER`, o container executa como `root` por padrão. Se um processo da aplicação for comprometido, esse privilégio pode permitir que ele altere arquivos protegidos dentro do container e amplia o impacto potencial do comprometimento.

O cenário vulnerável não define `USER`. O cenário corrigido executa a aplicação como o usuário sem privilégios `app`. A demonstração tenta alterar um arquivo-canário protegido dentro do container e compara os resultados. O teste fica restrito ao container descartável e não altera arquivos do runner.

## Comparação dos cenários

| Controle | Vulnerável | Corrigido |
|---|---|---|
| Dependência | `decode-uri-component` 0.2.0 | `decode-uri-component` 0.5.1 |
| Usuário do container | Root por padrão, sem `USER` | Usuário `app`, declarado com `USER` |
| Requisição malformada | O processo encerra | O serviço responde HTTP 200 |
| Escrita no arquivo-canário | Permitida como `root` | Bloqueada para o usuário `app` |

Os arquivos JavaScript são iguais nos dois cenários. A versão da dependência e a configuração do usuário do container são as diferenças relevantes para as demonstrações.

### Indisponibilidade via HTTP — cadeia de suprimentos

O script `scripts/demo-attack.mjs` funciona como um cliente externo: envia uma requisição HTTP real ao endpoint `/payment` com a sequência malformada. Ele não importa nem chama diretamente a dependência.

No cenário vulnerável, o cliente espera que a conexão seja interrompida porque o processo encerra. No cenário corrigido, espera uma resposta HTTP 200. O workflow também verifica se o container continua ativo e registra as observações e os logs do servidor.

### Abuso de privilégio

No workflow `.github/workflows/vulnerabilty-test.yml`, o teste prepara dentro do container um arquivo-canário em `/root/privilege-canary.txt`, pertencente a `root` e com permissão de escrita somente para esse usuário. Em seguida, tenta anexar conteúdo ao arquivo usando o usuário padrão do processo da aplicação.

- No cenário vulnerável, o processo executa como `UID 0` e a escrita deve ser permitida.
- No cenário corrigido, o processo executa como `app` e a escrita deve ser bloqueada.

O Summary registra o `UID` observado, o resultado da tentativa e o resultado esperado. Se os resultados não corresponderem, o job falha. O container é removido ao final.

Essa simulação é independente da CVE-2022-38900. A CVE demonstra negação de serviço por entrada HTTP malformada; o arquivo-canário demonstra o impacto potencial de um processo comprometido que já executa como `root` dentro do container.

## Correções realizadas

### Atualização do pacote

O cenário corrigido usa `decode-uri-component` 0.5.1, versão que corrige a CVE-2022-38900 e a [CVE-2026-118664](https://github.com/advisories/GHSA-qr28-fpjm-wq7f). A versão está registrada em `scenarios/fixed/package.json` e `scenarios/fixed/package-lock.json`. O cenário vulnerável permanece em 0.2.0 para conservar a demonstração.

Para atualizar a dependência corrigida:

```bash
npm install --prefix scenarios/fixed --save-exact `decode-uri-component`@0.5.1
```

Como a versão 0.5.1 é ESM e a versão 0.2.0 é CommonJS, os dois apps carregam a exportação padrão com import() dinâmico.

### Dockerfile em múltiplos estágios

A análise do `Trivy` identificou achados em brace-expansion 5.0.9 e undici 6.28.0, dependências que acompanham o npm incluído na imagem-base Node.js. Elas não são dependências diretas da aplicação, mas ficam disponíveis na imagem final quando se usa a imagem Node.js completa em um build de estágio único.

O Dockerfile corrigido usa um build em múltiplos estágios para retirar essas dependências herdadas do ambiente de execução. O estágio builder, baseado em Node.js, instala as dependências da aplicação. O estágio final, baseado em Alpine, copia somente o executável Node.js, o código, os arquivos do projeto e o node_modules da aplicação. Ele não copia o npm nem as dependências internas do npm, como undici e brace-expansion. A aplicação executa ainda como usuário `app`.

Essa abordagem não atualiza essas dependências do npm: ela evita incluí-las na imagem de runtime quando não são necessárias. O Dockerfile vulnerável permanece em estágio único para que a demonstração também exponha os componentes herdados da imagem-base.

### Política `Rego` e `Conftest`

A política em `policies/docker/security.rego` reprova Dockerfiles que não declaram `USER` ou que definem `root` ou `UID 0`. O `Conftest` deve reprovar o cenário vulnerável e aprovar o corrigido:

```bash
conftest test scenarios/vulnerable/Dockerfile --policy policies/docker/
conftest test scenarios/fixed/Dockerfile --policy policies/docker/
```

Essa política verifica a configuração declarada no Dockerfile. A demonstração do arquivo-canário verifica em runtime qual usuário executa o processo e se consegue alterar o arquivo protegido.

## Funcionamento do workflow Security Scan

O workflow `.github/workflows/security-scan.yml` é iniciado manualmente no GitHub Actions, escolhendo o cenário vulnerável ou corrigido. Antes da análise da imagem, o job `pre-scan` executa o `zizmor` para auditar os workflows do GitHub Actions. Os achados são enviados ao GitHub Advanced Security e exibidos no log; se o gate do `zizmor` falhar, o job de scan não começa.

Depois, o job de scan constrói a imagem escolhida e executa os controles:

1. `Syft` gera um SBOM CycloneDX, inventariando os componentes da imagem. O JSON completo é impresso no log da execução; o Summary mostra até 10 componentes e informa o total. Se houver mais de 10, os componentes restantes ficam no arquivo `reports/sbom.cdx.json`, incluído no artefato `relatorios-de-seguranca-<cenário>`.
2. `Trivy` verifica vulnerabilidades do sistema operacional e das bibliotecas. O gate considera achados `HIGH` e `CRITICAL` com correção disponível e registra os detalhes no Summary e nos artefatos.
3. **`Conftest` e `Rego`** verificam se o Dockerfile define um usuário não privilegiado.
4. **`Cosign`** assina o arquivo da imagem em modo keyless usando OIDC do GitHub, verifica a assinatura e confirma que uma cópia alterada é rejeitada.

### Exemplo de achados do `Trivy` no cenário vulnerável

O relatório abaixo mostra os achados observados na imagem vulnerável. Os pacotes undici e brace-expansion vêm do npm presente na imagem-base; `decode-uri-component` é a dependência usada diretamente pela aplicação.

| CVE | Severidade | Pacote | Versão instalada | Versão corrigida indicada pelo `Trivy` |
|---|---|---|---:|---|
| [CVE-2026-102276](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | `HIGH` | brace-expansion | 5.0.9 | 5.0.10, 3.0.7, 2.1.5, 1.1.19 |
| [CVE-2026-102278](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | `HIGH` | brace-expansion | 5.0.9 | 5.0.11, 3.0.8, 2.1.6, 1.1.20 |
| [CVE-2022-38900](https://github.com/advisories/GHSA-w573-4hg7-7wgq) | `HIGH` | `decode-uri-component` | 0.2.0 | 0.2.1 ou superior |
| [CVE-2026-118664](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) | `HIGH` | `decode-uri-component` | 0.2.0 | 0.5.1 |
| [CVE-2026-109383](https://github.com/advisories/GHSA-2m5v-pch6-74hx) | `HIGH` | undici | 6.28.0 | 6.29.1, 7.30.1, 8.12.2 |
| [CVE-2026-109869](https://github.com/advisories/GHSA-xjj6-f33q-929c) | `HIGH` | undici | 6.28.0 | 6.29.1, 7.30.1, 8.12.2 |
| [CVE-2026-19534](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) | `HIGH` | undici | 6.28.0 | 6.28.1, 7.29.1, 8.10.2 |
| [CVE-2026-87018](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) | `HIGH` | undici | 6.28.0 | 6.29.1, 7.30.1, 8.12.2 |

Os relatórios são publicados como artefato do workflow. O `Syft` gera o SBOM para inventariar os componentes da imagem, enquanto o `Trivy` faz o scan da própria imagem em busca de vulnerabilidades conhecidas no sistema operacional e nas bibliotecas. No fluxo atual, o `Trivy` não consome o SBOM gerado pelo `Syft`. Uma nova execução do workflow faz um novo scan da imagem; o processo não atualiza dependências automaticamente nem monitora imagens continuamente.

Em uma empresa, os SBOMs poderiam ser armazenados em um repositório central com os inventários dos projetos. Uma rotina periódica poderia verificar esses SBOMs contra vulnerabilidades recém-divulgadas, concentrando a verificação, o armazenamento e a auditoria em um único lugar. Essa arquitetura complementaria os scans executados nos workflows; não faz parte da implementação atual deste projeto.

## Como executar

No GitHub, abra **Actions**, selecione **Demonstração de vulnerabilidades da imagem** ou **Análise de segurança da cadeia de suprimentos**, escolha o cenário e inicie o workflow. Consulte o Summary e os artefatos da execução para ver os resultados e relatórios.
