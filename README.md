# Raio-X da Cadeia de Suprimentos
Projeto do segundo módulo da formação em Especialista em Esteira DevSecOps da ADA. 

Este projeto demonstra uma vulnerabilidade real de dependência npm: **CVE-2022-38900**, no pacote `decode-uri-component`. O exemplo usa um serviço bancário fictício para mostrar como uma entrada enviada por um cliente externo pode chegar a uma biblioteca vulnerável.

## Explicação da vulnerabilidade

O serviço simula uma consulta de pagamento. Ele recebe pela URL uma referência de pagamento e usa `decode-uri-component` para decodificar caracteres especiais.

Uma URL normal poderia ser:

```text
http://localhost:3000/payment?reference=pagamento-123
```

O problema aparece quando o valor contém uma sequência percent-encoded malformada, como a usada no relato da CVE:

```text
http://localhost:3000/payment?reference=%ea%ba%5a%ba
```

O símbolo `%` inicia uma sequência de bytes codificada na URL. A sequência acima não representa texto UTF-8 válido. A versão vulnerável `decode-uri-component@0.2.0` pode lançar uma exceção ao tentar decodificá-la. Como o app de demonstração não captura essa exceção, o processo Node.js encerra e deixa de atender novas requisições.

Em um serviço real, uma atacante poderia enviar essa requisição remotamente. Se o serviço vulnerável processar a entrada e encerrar, clientes podem perder acesso temporariamente até o processo ser reiniciado. Repetir o ataque pode aumentar a indisponibilidade. Isso é uma demonstração de **negação de serviço (DoS)**; não demonstra roubo de dados nem alteração de pagamentos. Uma requisição não é, por si só, um DDoS — esse termo geralmente descreve tráfego distribuído vindo de várias fontes.

O impacto depende de como a aplicação usa o pacote e trata os erros. A vulnerabilidade não significa que qualquer app com essa dependência instalada seja automaticamente explorável.

Referências: [advisory da CVE-2022-38900](https://github.com/advisories/GHSA-w573-4hg7-7wgq) e [relato com a sequência de exemplo](https://github.com/SamVerschueren/decode-uri-component/issues/5).

## Como funciona o script de ataque

O arquivo `scripts/demo-attack.mjs` funciona como um cliente externo separado do app. Ele não importa nem chama diretamente `decode-uri-component`: envia uma requisição HTTP para o endpoint `/payment`, com a referência `%ea%ba%5a%ba` na URL.

O script registra no log o cenário selecionado, destino e caminho enviados, tempo de espera, resposta HTTP ou erro de conexão. No cenário vulnerável, espera que o processo encerre e a conexão seja interrompida. No cenário corrigido, espera uma resposta HTTP 200. O workflow também consulta o estado do container e imprime os logs do servidor para confirmar se o processo realmente caiu ou permaneceu ativo.

Assim, a demonstração evidencia a sequência: cliente externo envia a entrada malformada -> app passa o valor ao pacote instalado -> a versão vulnerável lança uma exceção não tratada -> o processo Node.js encerra. O script faz uma única requisição de demonstração; não executa um ataque distribuido.
