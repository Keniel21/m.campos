# Ensaio de migracao para Neon Object Storage

O projeto `mcampos-online` (`raspy-violet-60510381`) foi criado no plano Free,
em AWS Virginia (`aws-us-east-1`), com PostgreSQL 18. O banco e os arquivos de
Sao Paulo continuam preservados. Nao houve troca de conexao do aplicativo em uso.

## Ambientes

- `production` (`br-small-dream-b7dk0ptn`): reservada, ainda sem importar os dados da loja.
- `teste-migracao-storage` (`br-restless-fog-b71l45w5`): copia de `mcampos` e bucket privado `documentos`.
- `mcampos_restore_storage`: banco separado na branch de teste para o ensaio de recuperacao.

Foi usado um dump consistente com o manifesto das tabelas e documentos. O banco
de destino vazio foi conferido antes da restauracao em transacao unica, sem
`DROP`, `--clean` ou sobrescrita. Contagens, hashes de todas as linhas das tabelas
e sequencias foram comparados com a snapshot de origem. Os nomes dos objetos
sao os hashes SHA-256 ja registrados no banco; os registros nao precisam ser
reescritos para trocar o armazenamento fisico.

## Copia e verificacao dos arquivos

```powershell
npm ci --prefix tools/storage
node --test tools/storage/migrate.test.cjs
node tools/storage/migrate.cjs --backup backups/PASTA-VERIFICADA --config .env.neon.online.storage --branch br-restless-fog-b71l45w5 --backup-destination backups/COPIA-INDEPENDENTE-NOVA --report RELATORIO.json
```

O script valida o backup antes de acessar a rede, exige TLS e o endpoint da
branch aprovada na Virginia, envia somente os arquivos referenciados pelo banco,
reutiliza os objetos existentes e baixa cada objeto para conferir tamanho e hash.
Um objeto existente com hash incorreto causa falha; nao e sobrescrito. Nao apaga
objetos nem arquivos de origem. Recusa um destino de backup ja existente.

Uma falha pode deixar objetos validos ja copiados e uma pasta de backup parcial.
A pasta parcial nao tem marcador `COMPLETE` e nao e um backup valido. Para retomar,
use um novo `--backup-destination`; os objetos existentes serao novamente verificados.

Ao fim, exige HTTP 403 para download e listagem sem credenciais. O backup separado
contem os arquivos baixados do Object Storage, o dump PostgreSQL correspondente,
um manifesto novo e o marcador de integridade. Pode ser verificado/restaurado
com os scripts existentes, sem depender da disponibilidade do bucket.

O teste de restauracao so pode usar um banco vazio chamado `mcampos_restore_*`.
Nao use credenciais/hosts de producao nos ensaios. As configuracoes locais
`.env.neon.online.*` sao ignoradas pelo Git; segredos nunca sao colocados no front.

## Resultado do ensaio em 02/11/2026

- Banco copiado: 1.085 registros CRM, um usuario e duas migracoes Flyway; hashes das tres tabelas e sequencias conferidos.
- Documentos: 426 referencias, 370 objetos unicos, 117.577.936 bytes enviados e baixados com SHA-256 conferido.
- Privacidade: HTTP 403 para leitura e listagem anonimas; credencial somente de leitura baixou um arquivo e teve gravacao bloqueada.
- Backup: copia local independente com dump e arquivos baixados, manifesto e marcador COMPLETE verificados.
- Recuperacao: restauracao em `mcampos_restore_storage`, com contagens e hashes das tres tabelas identicos ao backup.
- A branch `production` do novo projeto continua vazia. Nao houve troca de ambiente da loja nem publicacao web.

## Limites e proximas etapas

Os 426 registros correspondem a 370 arquivos unicos, aproximadamente 118 MB.
O Free inclui 5 GB de Object Storage e 5 GB mensais de transferencia de saida
por projeto, compartilhados com os demais produtos. Downloads de verificacao e
backup tambem consomem transferencia. O banco inclui 1 GB e 100 CU-horas mensais.
Reavaliar os limites antes da publicacao: https://neon.com/pricing

Este ensaio nao publica o sistema na internet. O backend Java ainda usa arquivos
locais; falta adicionar o acesso S3 privado, concluir o login web, escolher a
hospedagem e validar a aplicacao completa antes de mudar o ambiente da loja.

Referencias: https://neon.com/docs/storage/get-started,
https://neon.com/docs/storage/authentication,
https://neon.com/docs/storage/s3-compatibility.
