# Preparação do Neon para uma loja

O perfil desktop serve o front original e a API Java juntos no computador da loja.
O iniciador usa os perfis neon,desktop. O banco PostgreSQL fica no Neon, e as
credenciais ficam apenas no arquivo local ignorado pelo Git. A conta Windows e a
segurança do computador controlam o acesso local. Não exponha essa porta na rede.

## 1. Criar o projeto

Na conta Neon, crie um projeto `mcampos`, selecione PostgreSQL 17 e uma região
próxima do computador da loja. Crie o banco `mcampos`. Use inicialmente uma branch
de desenvolvimento para ensaiar a importação; produção deve ser separada dos testes.
No painel Connect, obtenha o host direto (sem pooler), banco, usuário e senha.
Não publique a URL completa, nem coloque credenciais no HTML ou JavaScript.

Copie `.env.neon.example` para `.env.neon` na raiz. O arquivo é ignorado pelo Git.
Preencha `DB_URL` como `jdbc:postgresql://HOST.neon.tech:5432/mcampos`, sem senha
ou parâmetros. Configure usuário e senha em seus próprios campos. O perfil Neon
força verificação de certificado e hostname usando os certificados confiáveis do
Java. Não desative essa verificação para contornar erros de conexão.

Gere `JWT_SECRET` aleatório (pelo menos 32 bytes) e senha de administrador exclusiva
(12 caracteres no mínimo, até 72 bytes). Restrinja o acesso ao arquivo local à
conta Windows responsável pelo sistema e mantenha o computador protegido por senha.

## 2. Inicializar o schema, uma vez

Compile com Java 21 e Maven: `mvn -f backend/pom.xml verify`.
No arquivo local, use temporariamente o usuário proprietário do banco criado pelo
Neon e `DB_MIGRATE=true`. Para importar os arquivos existentes, configure
`IMPORT_DIRECTORY=database`.

Execute na raiz:

```powershell
node scripts/audit-legacy.cjs database
powershell -File scripts/start-neon.ps1
```

O iniciador repete a auditoria antes de importar. Erros bloqueiam o início;
avisos sobre despesas antigas sem descrição e vendas históricas repetidas exigem
revisão, sem exclusão automática. O importador também valida vínculos e IDs na
transação. Qualquer falha desfaz a importação inteira. Os JSONs originais não são
alterados. Faça uma cópia deles antes e preserve-a fora do repositório público.
Referências antigas de leads e agenda sem veículo correspondente são avisos:
esses módulos removidos ficam arquivados com o identificador original no JSONB,
sem inventar um vínculo com outro veículo.

A aplicação inicia em http://127.0.0.1:8080 (ou APP_PORT). No perfil desktop,
GET /api/desktop/session fornece o token CSRF usado nas gravações; a API JWT fica
bloqueada. Confira as contagens na tela e no banco. A importação preserva os campos antigos em JSONB,
com IDs internos UUID e FK para veículos. Reexecutar não duplica nem atualiza
registros já importados: corrija dados importados pela API ou em uma nova branch de ensaio.

Não execute os testes apontando `TEST_DB_URL` para esse banco: a suíte apaga dados.

## 3. Credencial limitada para uso diário

Depois da migração, encerre a API com Ctrl+C. No SQL Editor conectado como
proprietário ao banco `mcampos`, crie o usuário de execução via SQL. Substitua a
senha apenas no editor privado; não salve o comando preenchido no Git:

```sql
CREATE ROLE mcampos_app LOGIN PASSWORD 'SUBSTITUA_POR_UMA_SENHA_FORTE';
GRANT CONNECT ON DATABASE mcampos TO mcampos_app;
GRANT USAGE ON SCHEMA public TO mcampos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_records TO mcampos_app;
GRANT SELECT, INSERT ON TABLE public.app_users TO mcampos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mcampos_app;
```

A permissão de INSERT em app_users permite o bootstrap idempotente existente.
O usuário de execução não recebe CREATE nem permissões na tabela de histórico do
Flyway. No arquivo local, troque `DB_USER` e `DB_PASSWORD` para esse usuário,
defina `DB_MIGRATE=false` e esvazie `IMPORT_DIRECTORY`. Reinicie pelo mesmo script.
DDL futuro deve rodar com credencial de manutenção, após backup e ensaio em branch.
Não copie a credencial de manutenção para a instalação da loja.

## Operação e limites desta etapa

O navegador conversa com o servidor local; somente o backend deve acessar o banco.
Com Neon remoto, será necessária internet para operações de banco. Não existe
sincronização offline implementada nesta etapa. A prévia com dados demonstrativos
também não é evidência de conexão real.

O pool mantém no máximo três conexões e libera conexões ociosas; não há keepalive
periódico. Confira consumo e limites do plano no painel Neon. Antes de cada versão
ou migração, faça `pg_dump` usando a credencial de manutenção e teste a restauração
em um banco separado. Proteja os backups, pois contêm dados de clientes.

Referências oficiais: [conectar Java](https://neon.com/docs/guides/java),
[permissões de banco](https://neon.com/docs/manage/database-access),
[conexões seguras](https://neon.com/docs/connect/connect-securely).

## Ambiente de desenvolvimento conectado

Projeto existente: mcampos-gestao-teste, região São Paulo, PostgreSQL 18. Banco
mcampos, branch dev-migracao-mcampos. O banco neondb da branch production foi
preservado. As migrações V1/V2 e a importação foram ensaiadas na branch de
desenvolvimento. O arquivo local desta instalação usa APP_PORT=18080 para não
conflitar com um serviço existente na porta 8080.

Os cadastros de documentos preservam os links antigos para recuperação. As cópias
locais e os novos anexos são gerenciados conforme [o guia de documentos](documents.md).
O backup da pasta storage é necessário além do backup PostgreSQL.
