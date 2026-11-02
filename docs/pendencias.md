# Pendências do veículo

Na ficha, o campo Pendência oferece Sem pendência e opções cadastradas pela loja. Nova opção cria e seleciona uma pendência; Editar opção altera seu nome em todos os veículos vinculados. Excluir opção remove somente opções sem veículos vinculados. Troque a seleção dos veículos antes de excluir uma opção em uso.

O catálogo é persistido no PostgreSQL no módulo pendencias, usando a estrutura crm_records existente, sem alteração de esquema. Os veículos mantêm o campo documentStatus/document_status com uma referência estável; o nome aparece na coluna DOC e nos cards. Os anexos e seus vínculos permanecem independentes.

Valores antigos não são reclassificados automaticamente: sim, nao e pendente continuam preservados, exibidos como registros anteriores. Um veículo sem informação mostra Não informado; Sem pendência é uma seleção explícita. Ao revisar cada veículo, escolha a situação atual. A edição do nome não altera os vínculos.

O catálogo usa a mesma sessão, CSRF e persistência dos cadastros. A API rejeita exclusões de opções vinculadas, referências inexistentes, nomes vazios e nomes acima de 100 caracteres. Backups completos do PostgreSQL incluem o catálogo.
