# Status adicionais e remoção da FIPE

Status MC e Status são dois campos independentes, com catálogos globais separados. Cada veículo guarda uma referência estável em statusMc e customStatus. Os módulos status_mc_options e status_options usam a persistência e as permissões já existentes, sem alteração de esquema. Não informado é o estado inicial, sem atribuir valores aos veículos antigos.

Os menus permitem adicionar, renomear e excluir opções no próprio campo, com Enter para salvar e Esc para cancelar, assim como Pendência. Uma renomeação atualiza o nome para todos os veículos vinculados. A exclusão de opções em uso é bloqueada até alterar seus vínculos. Os catálogos são atualizados ao abrir o menu. Os três campos compartilham o mesmo componente, com estado de edição independente por campo.

A situação operacional (Status no Pátio, identificada como Situação no pátio na listagem) permanece independente e continua controlando disponível, vendido, preparação e reserva. Os novos status não criam vendas nem alteram estoque, despesas ou financeiro.

A lista de estoque inclui Status MC e Status como duas novas colunas, com filtro e classificação. O CSV inclui os nomes dos novos status. A consulta FIPE, seus campos de código/valor, modal e chamadas externas foram removidos. Valores FIPE históricos permanecem no banco e não são apagados ou sobrescritos ao salvar a ficha.
