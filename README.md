# Raio-X da Cadeia de Suprimentos
Projeto final do segundo módulo da formação em Especialista em Esteira DevSecOps da ADA.

Este projeto demonstra uma vulnerabilidade real de dependência npm: **CVE-2022-38900**, no pacote `decode-uri-component`. O exemplo usa um serviço bancário fictício para mostrar como uma entrada enviada por um cliente externo pode chegar a uma biblioteca vulnerável.

## Explicação da vulnerabilidade

O serviço simula uma consulta de pagamento. Ele recebe uma referência pela URL e usa `decode-uri-component` para decodificar caracteres especiais.

Uma URL normal poderia ser:

```text
http://localhost:3000/payment?reference=pagamento-123
```

O problema aparece quando o valor contém uma sequência malformada de codificação percentual (percent-encoding), como a usada no relato da CVE:

```text
http://localhost:3000/payment?reference=%ea%ba%5a%ba
```

O símbolo `%` inicia uma sequência de bytes codificada na URL. A sequência acima não representa texto UTF-8 válido. A versão vulnerável `decode-uri-component@0.2.0` pode lançar uma exceção ao tentar decodificá-la. Como o aplicativo de demonstração não captura essa exceção, o processo Node.js é encerrado e deixa de atender a novas requisições.

Em um serviço real, uma pessoa atacante poderia enviar essa requisição remotamente. Se o serviço vulnerável processar a entrada e encerrar, os clientes poderão perder o acesso temporariamente, até que o processo seja reiniciado. Repetir o ataque pode prolongar a indisponibilidade. Isso demonstra uma **negação de serviço (DoS)**; não demonstra roubo de dados nem alteração de pagamentos. Uma requisição, por si só, não caracteriza um DDoS — esse termo geralmente descreve tráfego distribuído proveniente de várias fontes.

O impacto depende de como a aplicação usa o pacote e trata os erros. A vulnerabilidade não significa que qualquer aplicativo com essa dependência instalada seja automaticamente explorável.

Referências: [aviso de segurança da CVE-2022-38900](https://github.com/advisories/GHSA-w573-4hg7-7wgq) e [relato com a sequência de exemplo](https://github.com/SamVerschueren/decode-uri-component/issues/5).

## Como funciona o script de ataque

O arquivo `scripts/demo-attack.mjs` funciona como um cliente externo, separado do aplicativo. Ele não importa nem chama diretamente `decode-uri-component`; envia uma requisição HTTP para o endpoint `/payment` com a referência `%ea%ba%5a%ba` na URL.

O script registra o cenário selecionado, o destino e o caminho da requisição, o tempo de espera e a resposta HTTP ou o erro de conexão. No cenário vulnerável, espera que o processo seja encerrado e a conexão, interrompida. No cenário corrigido, espera uma resposta HTTP 200. O fluxo de trabalho do GitHub Actions também consulta o estado do contêiner e exibe os registros do servidor para confirmar se o processo foi encerrado ou permaneceu ativo.

Assim, a demonstração evidencia a sequência: o cliente externo envia a entrada malformada → o aplicativo passa o valor ao pacote instalado → a versão vulnerável lança uma exceção não tratada → o processo Node.js é encerrado. O script envia uma única requisição de demonstração; não executa um ataque distribuído.
