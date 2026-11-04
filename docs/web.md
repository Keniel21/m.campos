# Java web com documentos privados

Execute o Spring Boot com os perfis `neon,web`. A mesma origem serve a interface
original, a API de dados e o conteudo dos documentos. O perfil `desktop` permanece
disponivel para a instalacao local; nao combine `desktop` e `web`.

Use `backend/.env.web.example` como referencia para as variaveis do servidor.
O arquivo e apenas um exemplo: Spring Boot nao carrega arquivos .env sozinho;
configure as variaveis no gerenciador de segredos da hospedagem ou no processo.
Nunca inclua credenciais em HTML, JavaScript, Dockerfile ou argumentos do Java.

## Login

O login existente foi adaptado para e-mail/senha reais. Nao ha entrada demo,
cadastro publico ou botoes sociais simulados. Usuarios existentes em app_users
continuam com o hash BCrypt. O bootstrap nao redefine senhas existentes.
O usuario inicial deve ser preparado pelo mantenedor antes da publicacao.

- GET `/api/desktop/session`: modo, estado da autenticacao e token CSRF; nao expoe dados da loja para visitantes.
- POST `/api/web/login`: formulario email/password, com token CSRF no header indicado pela sessao; retorna 204 ou 401.
- Apos login, consulte novamente a sessao para renovar o token CSRF. Spring Security troca o identificador da sessao.
- POST `/api/web/logout`: exige CSRF e invalida a sessao. O front recarrega a pagina, descartando dados e formularios privados.
- Dados e documentos exigem autenticacao. Credenciais JWT legadas e a rota de vinculacao de copias locais nao sao acessiveis no perfil web.
- Tentativas de login: ate dez por minuto por IP observado no servidor; armazenamento da contagem e limitado em memoria e reinicia com a instancia. Para varias replicas, usar limitacao compartilhada/no proxy.

Cookie `MCAMPOS_SESSION`, HttpOnly, Secure, SameSite Strict, com 30 minutos de
inatividade. Reiniciar/publicar uma instancia encerra as sessoes: o usuario entra
novamente. Nao ha senha ou token de autenticacao salvo em localStorage.
Nao ha recuperacao automatica de senha por e-mail; o mantenedor faz o atendimento.

## Armazenamento S3

`app.storage-mode=s3` e o padrao de web. Configure endpoint HTTPS do Neon,
regiao, bucket privado e credencial com os escopos explicitos storage:read e storage:write.
Use credencial separada da usada para manutencao. As chaves nunca chegam ao front.

O Java usa o SDK AWS v2, path-style, TLS, limites de tempo e tamanho. PDF/JPEG
sao gravados por SHA-256, com verificacao do download. Um objeto existente
corrompido nao e substituido. Downloads autenticados passam pelo Java, que valida
o hash antes de devolver os bytes ao navegador com no-store e SAMEORIGIN para PDF.
Falhas no provedor retornam mensagens genericas, sem endpoint, chave ou assinatura.
Nenhum arquivo temporario precisa persistir no disco da hospedagem.

O perfil local continua usando `storage/documents`. Apagar um registro de documento
nao apaga automaticamente o objeto fisico; a retencao/limpeza deve ser planejada
pelo mantenedor. Os procedimentos de backup independente continuam necessarios.

## HTTPS e proxy

`APP_ORIGIN` deve ser a origem publica exata, por exemplo `https://loja.example.com`,
sem caminho. A versao publica exige cookie Secure, HTTPS e S3. Configure
APP_BIND=0.0.0.0 apenas na hospedagem, atras do proxy TLS. O proxy deve remover
headers Forwarded/X-Forwarded-* enviados pelo cliente e inserir seus valores
confiaveis; o aplicativo utiliza forward-headers-strategy=framework.
Nao exponha diretamente a porta HTTP do Java na internet.

`/healthz` confirma que a instancia subiu e nao consulta o banco a cada ping,
permitindo que o Neon suspenda quando ocioso. Nao comprova disponibilidade dos
documentos ou do banco. Use a leitura autenticada para homologar essas dependencias.
O health check aceita HTTP interno. As demais leituras HTTP sao redirecionadas
para APP_ORIGIN HTTPS; gravacoes HTTP sem TLS/proxy confiavel recebem 403.

Para teste local, use APP_ORIGIN=http://127.0.0.1:18086, APP_BIND=127.0.0.1 e
server.servlet.session.cookie.secure=false como propriedade explicita de teste.
O aplicativo recusa origem HTTP com bind publico. Local storage so e aceito para
teste loopback; a origem HTTPS publica exige S3.

## Liberacao

Homologue na branch teste-migracao-storage, com usuario PostgreSQL limitado a
CRUD de crm_records, leitura de app_users e uso das sequencias. DB_MIGRATE=false
e IMPORT_DIRECTORY vazio. Aplique migracoes/provisione usuarios separadamente,
com backup e credencial de manutencao. A instalacao atual nao e redirecionada
automaticamente e a configuracao de hospedagem ainda precisa ser definida.
