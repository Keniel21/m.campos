# Documentos locais

O banco Neon guarda os cadastros, vínculos, hash SHA-256, tamanho e tipo do arquivo.
Os bytes de PDFs e imagens JPEG ficam em `storage/documents`, fora do Git e dos
artefatos de frontend. Isso evita armazenar os anexos em base64 no PostgreSQL.

A pasta usa o hash do conteúdo como nome interno; arquivos idênticos compartilham
a mesma cópia, mantendo todos os cadastros e nomes originais. A exclusão de um
cadastro não apaga automaticamente o arquivo físico. Não faça limpeza manual dessa
pasta sem conferir os vínculos e os backups.

## Cópia e conferência dos documentos legados

Com o backend desktop rodando em `http://127.0.0.1:18080`, na raiz do projeto:

```powershell
node scripts/migrate-documents.cjs
node scripts/migrate-documents.cjs --link
```

O primeiro comando baixa os links atuais do bucket `documentos` do Supabase original,
confere tamanho, assinatura PDF/JPEG e SHA-256, e relê o arquivo gravado para comparar
o hash. Não altera os cadastros. O segundo reutiliza as cópias conferidas, vincula
cada registro pela API local com CSRF e baixa a resposta local para comparar o hash
mais uma vez. Os arquivos originais no Supabase não são apagados nem modificados.

O diário privado `storage/document-migration.json` permite retomar a execução.
Ele contém IDs e endereços originais; não o publique. Arquivos faltantes/corrompidos
são novamente baixados. Mudanças no vínculo original ou substituição do arquivo
depois da cópia bloqueiam a atualização daquele cadastro. Falhas ficam no diário e
no resumo por contagens, sem interromper os demais arquivos; a saída é diferente
de zero se houver falhas. Uma nova execução pode completar o que faltou.

Os comandos usam a pasta padrão `storage/documents`. Se configurar
`DOCUMENT_DIRECTORY` para outra pasta, faça a cópia para o mesmo destino antes de
vincular, ou use a função `migrate` exportada pelo script com o diretório de storage
correspondente. Não vincule arquivos presentes apenas no computador de desenvolvimento
se for promover o banco para a instalação da loja.

## Abertura e novos anexos

A interface original abre e baixa arquivos via
`/api/desktop/documents/{id}/content`. O endpoint resolve o cadastro no banco,
confere o hash ao ler o arquivo e só permite abrir o conteúdo local correspondente.
O diretório de storage não é publicado como pasta estática. PDFs são exibidos em
iframe do próprio sistema (SAMEORIGIN); imagens JPEG mantêm a visualização original.

Novos PDFs/JPEGs enviados pela tela são extraídos da data URL recebida e gravados
em arquivo, com limite de 20 MB por anexo. Somente metadados são persistidos no
cadastro. Conteúdo inválido, arquivo ausente ou hash diferente produz erro, sem
buscar silenciosamente uma cópia remota.

## Backup e instalação

O backup completo tem **duas partes inseparáveis**: banco PostgreSQL e pasta
`storage/`, incluindo seu diário. Ao instalar ou trocar de computador, restaure
essa pasta e configure `DOCUMENT_DIRECTORY` se o caminho mudar. Copie também os
arquivos para um backup em outro dispositivo/local; o Neon não faz backup desses
bytes locais. Valide a restauração abrindo documentos no novo computador antes
de desativar a instalação antiga.

Nesta migração de desenvolvimento: 426 cadastros, 370 arquivos de conteúdo distinto,
165.044.743 bytes lógicos copiados, sem falhas. Os links antigos foram preservados
no campo `legacyFileUrl` para recuperação. O Supabase deve permanecer ativo até
validar os backups e a instalação definitiva da loja.
