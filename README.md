# M. Campos — interface original e migração técnica

A interface oficial é o front original do AutoDrive, em `index.html`, `style.css`, `app.js` e `src/`. A migração de stack deve preservar seu visual, componentes, ficha de veículos e fluxos. A interface alternativa criada anteriormente foi removida.

## Alterações solicitadas na interface

- Removidos os menus Dashboard, Vendas, Leads, Agenda e Aprovações.
- A aplicação abre em Estoque, reunindo veículos disponíveis e vendidos.
- Filtro por situação: Todos, Disponível, Vendido, Em preparação e Reservado.
- Busca combinada com a situação e contagem dos veículos encontrados.
- Lista, grade e exportação CSV respeitam o filtro selecionado.
- Dados da venda acessíveis na ficha original do veículo. Após registrar a venda, a tela retorna ao Estoque com o filtro Vendido.
- Os registros e históricos são preservados; a remoção de menus não exclui dados.

## Executar a aplicação com o front original

Na raiz do repositório, com Node.js instalado:

```sh
npm install
npm start
```

Abra `http://localhost:3000`. Esse comando executa o servidor Express e os módulos originais. A configuração e as integrações existentes continuam pertencendo a esse aplicativo.

O diretório `frontend/` contém somente o empacotamento dos arquivos originais. O comando abaixo prepara `frontend/dist` copiando o HTML, CSS e módulos, sem redesenhar a interface:

```sh
cd frontend
npm ci
npm run build
```

## Backend Java do roadmap

O diretório `backend/` contém a primeira etapa da API Java 21/Spring Boot, com PostgreSQL 17, JPA/Hibernate, Flyway, Spring Security/JWT, OpenAPI e testes JUnit/Mockito/MockMvc. Essa API ainda é independente do servidor usado pelo front original: a integração será feita progressivamente, preservando a interface e seus contratos.

A conversão para React/TypeScript deverá reutilizar o layout e os comportamentos existentes; não há mais uma interface React alternativa nesta branch.

Para executar a API, configure `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET` (mínimo de 32 bytes), `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo de 12 caracteres e máximo de 72 bytes):

```sh
cd backend
mvn spring-boot:run
```

API em `http://localhost:8080`; Swagger em `http://localhost:8080/swagger-ui/index.html`.

### Docker Compose

Copie `.env.roadmap.example` para `.env`, preencha as variáveis e execute:

```sh
docker compose up --build
```

O serviço `frontend` executa o aplicativo original em `http://localhost:3000`. O backend Java é disponibilizado separadamente em `http://localhost:8080`, com PostgreSQL. O frontend original continua usando seu servidor Express até a migração dos contratos da API ser concluída.

O Compose está configurado, mas ainda precisa ser validado em um ambiente com Docker.

## Importação dos JSONs para a API Java

A importação é explícita: configure `IMPORT_DIRECTORY` com a pasta de JSONs; no Compose, use `/legacy-data`. O importador lê estoque, clientes, leads, despesas, agenda, documentos, empresas e vendas, dentro de uma transação, sem alterar os arquivos originais.

Cada registro recebe UUID interno e mantém o id legado. A combinação módulo/id legado evita duplicação em reinícios; registros já importados não são sobrescritos. O histórico existente de vendas duplicadas é preservado, e novas vendas duplicadas são bloqueadas. Depois de conferir a importação, limpe `IMPORT_DIRECTORY`.

A modelagem usa temporariamente JSONB para preservar todos os campos, com FK/JPA para os veículos. A evolução para entidades tipadas por domínio e constraints específicas faz parte da migração. Dados exclusivos de Supabase, Firebase ou localStorage não são importados automaticamente.

## Validação e próximas etapas

```sh
cd backend
mvn verify
cd ../frontend
npm ci
npm run build
```

Sem `TEST_DB_URL`, os testes Java usam H2 em modo PostgreSQL. No GitHub Actions, usam PostgreSQL 17. Use um banco exclusivo de testes, pois a suíte limpa os registros de CRM.

As próximas etapas são integrar os contratos do front original à API Java, migrar autenticação e usuários, extrair entidades tipadas e validar integrações, relatórios, uploads e PWA sem alterações visuais não solicitadas. MongoDB permanece um exercício opcional do roadmap, sem dividir o núcleo financeiro entre bancos desnecessariamente.
