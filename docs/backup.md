# Backup e teste de restauração

O backup contém o PostgreSQL, os arquivos de `storage/` e um manifesto SHA-256.
Não inclui `.env.neon`, credenciais de manutenção, JWT_SECRET ou arquivos de
configuração do computador. O dump inclui os registros de usuários e seus hashes
de senha, como parte dos dados da aplicação. Trate o pacote como privado.

## Pré-requisitos

- Node.js e utilitários oficiais PostgreSQL **18 ou mais recentes**, compatíveis
  com o servidor. Não é necessário instalar outro servidor PostgreSQL na loja.
- Credencial de manutenção no arquivo privado `.env.neon.maintenance`.
- `DB_URL` com host direto do Neon, sem `-pooler`, sem senha embutida e sem query
  string. Usuário/senha ficam em `DB_USER` e `DB_PASSWORD`.
- TLS com verificação de certificado/hostname é obrigatório. O script usa as
  autoridades certificadoras confiáveis distribuídas com o Node.js.

## Criar um backup no Windows

Na raiz do projeto, ajuste o caminho dos utilitários:

```powershell
powershell -File scripts/backup.ps1 -PgBin 'C:\Program Files\PostgreSQL\18\bin'
```

O resultado fica em `backups/`: pasta datada em UTC, ZIP e arquivo `.sha256`.
Pode informar `-Destination` para outro diretório autorizado, por exemplo um
dispositivo externo. Não coloque a credencial de manutenção dentro do backup.
Para identificar a versão de código, informe `-ApplicationRevision` com o commit
ou a versão distribuída; sem esse parâmetro o manifesto registra `unspecified`.

Somente a pasta com marcador `COMPLETE` e aprovada pela verificação é um backup
válido. Uma falha pode deixar uma pasta parcial sem esse marcador; ela não deve ser
usada para recuperação. Os scripts não apagam backups antigos automaticamente.

### Consistência entre banco e documentos

O script exporta uma snapshot PostgreSQL em transação de leitura e usa a mesma
snapshot para o `pg_dump` e para as contagens/hashes das tabelas. Copia os arquivos
locais e exige que todos os documentos referenciados nessa snapshot estejam no
pacote com hash e tamanho corretos. Isso aproveita o armazenamento por conteúdo:
anexos são gravados antes do cadastro e arquivos existentes não são removidos
automaticamente. Não edite/apague arquivos manualmente durante o backup.

O formato custom do `pg_dump` inclui schema, dados, sequência de IDs e histórico
Flyway. Roles globais e permissões do cluster não são exportadas; a restauração
usa `--no-owner --no-acl`. Configure o usuário limitado da aplicação no destino
antes de usar a instalação restaurada em produção.

## Conferir uma cópia, sem acessar o banco

Confira o SHA-256 do ZIP com `Get-FileHash`, comparando com o `.sha256` que o acompanha.
Extraia em uma pasta nova, preservando os arquivos na raiz do ZIP, e execute:

```powershell
node scripts/verify-backup.cjs --backup 'C:\BackupExtraido'
```

O verificador recusa arquivos alterados, ausentes, extras, links simbólicos e
caminhos fora da pasta, e confere os documentos vinculados ao banco exportado.
Hashes detectam alterações acidentais; restaure somente pacotes de origem confiável.

## Restaurar para teste

Crie um banco **novo e vazio**, com nome começando por `mcampos_restore_`.
Configure sua conexão direta em um arquivo privado separado, como
`.env.neon.restore`. Não use o arquivo/conexão da aplicação ativa.

```powershell
node scripts/restore-backup.cjs --backup 'C:\BackupExtraido' --target-config .env.neon.restore --pg-bin 'C:\Program Files\PostgreSQL\18\bin'
```

O comando verifica todos os arquivos antes de escrever, recusa o banco de origem
e destinos não vazios, não usa DROP/--clean, copia a pasta de documentos para uma
pasta nova em `backups/restore-*` e executa `pg_restore` em uma única transação.
Compara contagens e SHA-256 de todas as linhas das tabelas públicas com a snapshot
e verifica que a sequência de IDs não ficou abaixo dos IDs existentes.

Para abrir a cópia restaurada, use esse arquivo separado com `DB_MIGRATE=false`,
`IMPORT_DIRECTORY=` vazio, `DOCUMENT_DIRECTORY` apontando para a pasta
`storage/documents` restaurada e `APP_PORT` diferente da instalação ativa. Exemplo:

```powershell
powershell -File scripts/start-neon.ps1 -ConfigFile .env.neon.restore
```

O relatório `restore-report.json` fica junto à pasta restaurada. Não remova a
instalação original antes de testar os fluxos e abrir os documentos restaurados.

## Ensaio realizado

O backup de 02/11/2026 foi restaurado em `mcampos_restore_20261102`, na branch de
desenvolvimento, com uma pasta de documentos separada. Foram conferidos 1.085
registros de CRM, um usuário e duas migrações Flyway, além dos 426 documentos. O
ZIP foi extraído e novamente verificado. A tentativa de restaurar sobre o destino
já preenchido foi recusada. As credenciais não fazem parte do pacote.

Uma cópia no mesmo computador ainda precisa ser copiada para outro dispositivo
ou destino privado definido pelo responsável. Teste periodicamente a restauração,
especialmente antes de mudanças de versão ou migrações.

Referências: [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) e
[backup e restauração](https://www.postgresql.org/docs/18/backup.html).
