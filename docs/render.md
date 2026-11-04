# Homologacao gratuita no Render

Um unico Web Service Docker serve a interface original e o backend Java 21.
O PostgreSQL e o bucket privado permanecem no Neon, na branch de homologacao
`teste-migracao-storage`. Nao criar outro banco, disco ou worker no Render.

## Servico

- Repositorio: `Keniel21/m.campos`.
- Branch: `feat/stack-roadmap` (homologacao; nao fazer merge para publicar o teste).
- Nome sugerido: `mcampos-homologacao`.
- Runtime: Docker; Dockerfile: `Dockerfile.render`; contexto: raiz do repositorio.
- Plano: Free, uma instancia; regiao: Virginia, proxima do Neon.
- Health check: `/healthz`.
- Auto-deploy inicialmente desativado; publicar manualmente o commit validado.
- Nao sobrescrever o comando do Docker.

O entrypoint utiliza `PORT` (padrao 10000) e `RENDER_EXTERNAL_URL` como origem
HTTPS quando `APP_ORIGIN` nao e definido. Cookie Secure permanece habilitado.
O processo roda sem root e o Java inicia com heap de ate 256 MB, deixando espaco
para memoria nativa dentro dos 512 MB do plano Free. O consumo real deve ser
verificado nos logs e nas metricas depois da publicacao.

## Variaveis privadas

Configurar no ambiente do servico, nunca no Dockerfile, Git ou front:

`DB_URL`, `DB_USER`, `DB_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`,
`AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`STORAGE_BUCKET`.

Usar as credenciais limitadas da homologacao ja preparada. A URL JDBC precisa
apontar para `mcampos`, e a credencial S3 deve ter leitura e escrita explicitas
no bucket privado `documentos`. O hash do usuario existente e preservado; a senha
de bootstrap nao redefine a senha do usuario ja cadastrado.

Os perfis `neon,web`, bind publico, diretorio do front, migracoes desabilitadas
e importacao vazia estao definidos no container. Nao ativar `desktop`, nao
enviar `SERVER_SERVLET_SESSION_COOKIE_SECURE=false` e nao importar os JSONs.

## Validacao depois da publicacao

1. Aguardar o deploy ficar Live e abrir o endereco HTTPS real fornecido pelo Render.
2. Confirmar que dados e documentos retornam 401 antes do login.
3. Entrar com o usuario existente e conferir os 173 veiculos e 425 documentos.
4. Conferir os sete vinculos corrigidos e a ausencia do anexo 450 do JDH5D09.
5. Abrir um PDF pelo Java e testar upload temporario, recarregamento e logout.
6. Confirmar bloqueio de escrita sem CSRF, cookies Secure/HttpOnly e logout.
7. Conferir memoria, falhas de conexao e ausencia de erros de inicializacao.

O health check so confirma que o Java iniciou; nao substitui testes autenticados
do banco e do armazenamento. Publicacoes e suspensoes encerram sessoes em memoria.
O plano Free pode suspender por inatividade; os dados persistem no Neon. Backups
independentes continuam separados do servico. Nao usar pings artificiais para
contornar a suspensao do plano.
