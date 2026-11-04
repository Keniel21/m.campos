# Pendências do veículo

Na ficha, abra o menu Pendência para selecionar Sem pendência ou uma opção cadastrada. Adicionar item permite digitar o nome no próprio menu; Enter ou Salvar cria e seleciona a pendência. Editar ao lado do item permite renomear no lugar: Enter ou Salvar confirma e Esc ou Cancelar descarta. O nome é atualizado em todos os veículos vinculados. Excluir pede confirmação dentro da própria linha e remove somente opções sem veículos vinculados. Troque a seleção dos veículos antes de excluir uma opção em uso. Não há janelas, prompts nem modais para gerenciar o catálogo.

O catálogo é persistido no PostgreSQL no módulo pendencias, usando a estrutura crm_records existente, sem alteração de esquema. Os veículos mantêm o campo documentStatus/document_status com uma referência estável; o nome aparece na coluna DOC e nos cards. Os anexos e seus vínculos permanecem independentes.

O menu sempre contém Sem pendência, Não informado e o mesmo catálogo global, independentemente da seleção ou do status do veículo. Ao abrir o menu, o catálogo é atualizado pelo servidor para refletir alterações de outras abas. A seleção pertence ao veículo; criar ou renomear uma opção modifica o catálogo de toda a loja.

A migração V3 converte sim, nao e pendente em referências às opções Documento na loja, Não possui documento e Entrega de documento pendente, criando apenas as opções necessárias. Ela não deduz Sem pendência a partir da existência de documentos, nem mistura opções criadas pelo usuário que tenham significado diferente. O valor original fica em documentStatusBeforeCatalogMigration. Os demais campos e vínculos são preservados. A migração é transacional e idempotente, com bloqueio para inicializações simultâneas. PendingCatalogMigration a executa também após a importação de dados antigos e nos ambientes onde Flyway está desabilitado. Pode ser aplicada explicitamente antes da publicação a partir do mesmo arquivo SQL versionado. Não requer mudança de esquema.

O backend normaliza valores antigos enviados por páginas ainda abertas para as referências atuais e rejeita valores fora do catálogo. Se uma opção antiga já tiver sido excluída, exige atualizar a página e selecionar outra, sem recriá-la silenciosamente. Uma referência desconhecida nunca é adicionada ao menu de uma única ficha.

O catálogo usa a mesma sessão, CSRF e persistência dos cadastros. A API rejeita exclusões de opções vinculadas, referências inexistentes, nomes vazios e nomes acima de 100 caracteres. Backups completos do PostgreSQL incluem o catálogo.
