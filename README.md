# Raio-X da Cadeia de Suprimentos
Projeto do segundo módulo da formação em Especialista em Esteira DevSecOps da ADA. 

Este projeto demonstra uma vulnerabilidade real de dependência npm: **CVE-2022-38900**, no pacote `decode-uri-component`. O exemplo usa um serviço bancário fictício para mostrar como uma entrada enviada por um cliente externo pode chegar a uma biblioteca vulnerável.

## Explicação da vulnerabilidade

O serviço simula uma consulta de pagamento. Ele recebe pela URL uma referência de pagamento e usa `decode-uri-component` para decodificar caracteres especiais.
