# M. Campos — migração para a stack do roadmap

Esta branch contém uma primeira versão funcional da nova stack de estudos. O aplicativo Express/JavaScript original continua na raiz; a nova implementação está em `backend/` e `frontend/`. **Não é ainda uma substituição com paridade de todas as funcionalidades do sistema original.**

## Stack

| Camada | Tecnologia | Relação com o roadmap |
|---|---|---|
| API | Java 21, Spring Boot 3.5, Maven | POO, DI, controllers, REST e exceções |
| Dados | PostgreSQL 17, Spring Data JPA/Hibernate, Flyway | SQL, persistência, relacionamentos e migrações |
| Autenticação | Spring Security, JWT HS256 e BCrypt | API stateless e rotas protegidas |
| Interface | React 19, TypeScript e Vite 7 | Componentes, hooks, formulários e consumo de APIs |
| Qualidade | JUnit 5, Mockito, MockMvc e GitHub Actions | Testes unitários e de integração |
| Infraestrutura | Docker e Docker Compose | Aplicação e banco em serviços separados |
| Documentação | Swagger/OpenAPI e logs JSON ECS | Documentação da API e logs estruturados |

Compatibilidade: [Spring Boot](https://docs.spring.io/spring-boot/3.5/system-requirements.html), [Vite](https://vite.dev/guide/) e [springdoc](https://springdoc.org/v2/).

## Executar a nova versão

Pré-requisitos: Docker com Compose. Não é necessário instalar Java/Maven/Node no host para usar os containers.

1. Copie `.env.roadmap.example` para `.env` na raiz.
2. Defina `DB_PASSWORD`, `JWT_SECRET` (mínimo de 32 bytes aleatórios), `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo 12 caracteres; máximo 72 bytes).
3. Se quiser importar os JSONs existentes, defina `IMPORT_DIRECTORY=/legacy-data` antes de iniciar.
4. Execute `docker compose up --build`.
5. Abra `http://localhost:3000` e entre com as credenciais definidas no `.env`.

API: `http://localhost:8080`. Swagger: `http://localhost:8080/swagger-ui/index.html`.

As portas são publicadas somente em localhost. Para deploy, configure domínio, TLS, backup e credenciais próprios. O usuário inicial é criado apenas se o e-mail não existir. Alterar `ADMIN_PASSWORD` depois não altera automaticamente a senha já gravada no banco.

### Desenvolvimento sem containers para a aplicação

Com PostgreSQL disponível, Java 21, Maven 3.9+ e Node 24:

```sh
# Configure DB_URL, DB_USER, DB_PASSWORD, JWT_SECRET e ADMIN_PASSWORD no ambiente.
cd backend
mvn spring-boot:run
```

Em outro terminal:

```sh
cd frontend
npm ci
npm run dev
```

O Vite encaminha `/api` para a porta 8080. O frontend não precisa conhecer a senha do banco nem o segredo JWT. O token é mantido em memória e expira em uma hora; recarregar a página exige novo login.

## O que esta versão oferece

- Login validado no servidor, sem restauração automática do administrador de demonstração.
- Navegação com Estoque, Clientes, Financeiro, Documentos e Empresas. Dashboard, Vendas, Leads, Agenda e Aprovações foram retirados do menu.
- Estoque reúne veículos disponíveis e vendidos, com filtro por situação (todos, disponível, vendido, em preparação e reservado), busca combinada e situação visível na tabela.
- A versão original também abre em Estoque, usa o mesmo filtro nas visualizações de lista/grade e na exportação CSV, e permite consultar a venda dentro da ficha do veículo.
- As APIs e os registros de vendas, leads e agenda permanecem para preservar os dados existentes; a remoção dos menus não exclui históricos.
- Vínculos JPA `@ManyToOne` com o veículo e bloqueio de exclusão de veículos com registros vinculados.
- Venda e mudança de situação do veículo na mesma transação, com bloqueio pessimista para evitar novas vendas concorrentes do mesmo veículo.
- Cálculo do lucro e margem da venda considerando custo e despesas cadastradas naquele momento. Alterar despesas posteriormente não recalcula retroativamente vendas antigas.
- Validação de campos obrigatórios, valores não negativos, datas, horários e tratamento global de erros.
- Migração versionada do esquema com Flyway e configuração de CI com PostgreSQL real.

## Importação e preservação dos dados

O importador lê, dentro de uma transação, `estoque`, `clientes`, `leads`, `despesas`, `agenda`, `documentos`, `company_cnpjs` e `vendas` da pasta indicada. Os arquivos originais são somente leitura. Não importa automaticamente dados de Supabase/Firebase nem dados que existam exclusivamente no localStorage do navegador.

Cada registro recebe UUID interno e mantém o identificador antigo separado. A combinação módulo/id antigo impede duplicação em reinícios. Um registro já importado não é sobrescrito se o JSON mudar. Depois de conferir a importação, limpe `IMPORT_DIRECTORY` e reinicie. Os volumes do PostgreSQL mantêm os dados; não use `docker compose down -v` para encerrar normalmente.

O payload completo é preservado em JSONB, incluindo campos que ainda não aparecem nos novos formulários. Os vínculos de veículos são remapeados para UUID na resposta da API. Referências antigas sem veículo correspondente permanecem no payload, sem fabricar veículos. O histórico existente tem mais de uma venda para alguns veículos: ele é preservado, e a criação de novas vendas duplicadas é bloqueada.

**Modelagem intermediária:** `crm_records` possui módulo, id legado, JSONB, versão e FK para veículo. Isso facilita a transição sem descartar campos, mas ainda não equivale à modelagem relacional final de entidades tipadas para cada domínio. A evolução para entidades `Vehicle`, `Sale`, `Customer` etc. está prevista no plano abaixo.

## Testar

```sh
cd backend
mvn verify
cd ../frontend
npm ci
npm run build
```

Sem `TEST_DB_URL`, os testes de backend usam H2 em modo PostgreSQL. No GitHub Actions, usam PostgreSQL 17 e as migrações reais. Para executar localmente contra PostgreSQL, configure `TEST_DB_URL`, `TEST_DB_USER` e `TEST_DB_PASSWORD` para um **banco exclusivo de testes**, pois a suíte limpa os registros de CRM.

## Etapas restantes para substituir o legado

1. Extrair entidades e DTOs tipados por domínio, com constraints SQL específicas, índices de pesquisa e paginação. JSONB fica para metadados e campos legados durante a transição.
2. Completar a ficha detalhada do veículo e os dados de venda na interface React, mantendo a navegação concentrada em Estoque conforme o escopo atualizado.
3. Migrar integrações Gemini, Google Calendar, FIPE, upload de arquivos, relatórios/recibos/Excel e PWA/offline. Essas integrações continuam somente no aplicativo original.
4. Migrar usuários externos com fluxo de redefinição de senha e implementar aprovação, permissões por função e administração de usuários. Esta versão oferece apenas o usuário administrativo inicial.
5. Conferir valores, documentos e contagens da base real antes de mudar a aplicação usada pela loja; executar testes visuais e end-to-end das rotinas completas.
6. Fazer deploy da nova stack após a validação de paridade. Esta branch não altera o deploy atual nem migra uma base externa em produção.

MongoDB é um exercício separado do passo de NoSQL: pode ser usado depois para uma coleção de eventos/histórico. Ele não é necessário para o núcleo financeiro relacional e não foi adicionado como dependência artificial.

## Roteiro de prática no projeto

- Semanas 1–4: leia classes, construtores, coleções e os contratos HTTP.
- Semanas 5–8: acompanhe controller → service → repository e extraia a entidade de veículos.
- Semanas 9–10: explore filtro JWT, BCrypt, expiração e autorização.
- Semanas 11–12: execute testes, documente DTOs no OpenAPI e examine os logs JSON.
- Semanas 13–15: consulte o PostgreSQL, crie constraints/índices por domínio e estude MongoDB em um exercício isolado.
- Semanas 16–19: estenda componentes React, formulários tipados e estado das telas.
- Semanas 20–24: revise a branch/PR, execute CI, suba os containers e conclua a paridade antes do deploy.
