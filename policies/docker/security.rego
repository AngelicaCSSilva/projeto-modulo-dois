package main

import rego.v1

# Sem a instrução USER, o Docker executa o container como root por padrão.
deny contains mensagem if {
    not possui_instrucao_usuario
    mensagem := "O Dockerfile deve declarar a instrução USER com um usuário não privilegiado."
}

# Rejeita root pelo nome, inclusive quando vem acompanhado de um grupo.
deny contains mensagem if {
    some instrucao in input
    instrucao.Cmd == "user"
    count(instrucao.Value) > 0
    usuario := lower(instrucao.Value[0])
    partes_usuario := split(usuario, ":")
    partes_usuario[0] == "root"
    mensagem := "A instrução USER não pode executar o container como root."
}

# Rejeita também o UID 0, que identifica o usuário root.
deny contains mensagem if {
    some instrucao in input
    instrucao.Cmd == "user"
    count(instrucao.Value) > 0
    usuario := lower(instrucao.Value[0])
    partes_usuario := split(usuario, ":")
    partes_usuario[0] == "0"
    mensagem := "A instrução USER não pode usar o UID 0."
}

possui_instrucao_usuario if {
    some instrucao in input
    instrucao.Cmd == "user"
}
