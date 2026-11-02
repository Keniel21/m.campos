# M. Campos — interface original e migração técnica

A interface oficial é o front original do AutoDrive, em `index.html`, `style.css`, `app.js` e `src/`. A migração de stack deve preservar seu visual, componentes, ficha de veículos e fluxos. A interface alternativa criada anteriormente foi removida.

## Alterações solicitadas na interface

- Removidos os menus Dashboard, Vendas, Leads, Agenda e Aprovações.
- A aplicação abre em Estoque, reunindo veículos disponíveis e vendidos.
- Filtro por situação: Todos, Disponível, Vendido, Em preparação e Reservado.
- Busca combinada com a situação e contagem dos veículos encontrados.
- Lista, grade e exportação CSV respeitam o filtro selecionado.
- Dados da venda acessíveis na ficha original do veículo. Após registrar a venda, a tela retorna ao Estoque com o filtro Vendido.
- Removidos o botão flutuante e o atalho do cabeçalho do Auto Agente, seus atalhos de teclado, o painel de perfil/configurações e a edição de perfil.
- Os registros e históricos são preservados; a remoção de menus não exclui dados.

## Executar com Java e Neon

O perfil desktop serve o front original e a API no mesmo endereço local. Não requer
login na interface: o acesso fica restrito ao computador (127.0.0.1), com sessão
HTTP, token CSRF e validação de Host/Origin. A API JWT continua disponível no perfil
padrão para estudo e testes, e fica bloqueada no perfil desktop.

1. Instale Java 21, Maven e Node.js (Node é usado pela auditoria e pelo empacotamento).
2. Configure .env.neon a partir de .env.neon.example, conforme [o guia Neon](docs/neon.md).
3. Na raiz, compile: mvn -f backend/pom.xml verify.
4. Execute: powershell -File scripts/start-neon.ps1.
5. Abra http://127.0.0.1:8080 (ou a porta APP_PORT configurada).

O iniciador mantém a raiz do projeto como diretório de execução, onde estão os
arquivos originais do front. Não abra o HTML diretamente nem use npm start para
essa configuração: o Express antigo permanece apenas como referência de migração.
O Compose ainda representa a arquitetura anterior e não é o instalador desktop.

## Persistência e importação

Java 21/Spring Boot, JPA/Hibernate, PostgreSQL, Flyway e validações transacionais
substituem as gravações no Express/JSON e no Supabase. Os módulos originais chamam
uma camada local de compatibilidade. UUIDs continuam internos; a migração V2 gera
identificadores numéricos para os controles existentes.

O importador é explícito, transacional e idempotente. Ele preserva os campos legados
em JSONB, com FK de veículo, inclusive as vendas históricas repetidas. Novas vendas
duplicadas são bloqueadas. A evolução para tabelas tipadas por domínio continua
pendente; os valores financeiros nas regras Java usam BigDecimal.

O navegador começa com listas vazias e recebe o estado do banco, inclusive quando
ele está vazio. Não há gravação offline, carga automática de dados de demonstração
ou envio automático de outboxes antigas. Internet é necessária para usar o Neon.
Despesas e alterações de custo recalculam os lucros das vendas vinculadas.

Os documentos legados foram copiados e conferidos no armazenamento local privado,
com referências no Neon e endereços antigos preservados. Novos PDFs/JPEGs também
ficam em arquivos, sem base64 no banco. Consulte [migração, abertura e backup de
documentos](docs/documents.md). A pasta de arquivos precisa acompanhar a instalação
e o backup do banco; o Neon não guarda os bytes locais.

## Validação

Para criar, verificar e ensaiar a recuperação do banco e dos documentos, siga
[o guia de backup](docs/backup.md). O pacote inclui o dump PostgreSQL e a pasta de
arquivos; credenciais e configurações privadas ficam de fora.

Execute mvn -f backend/pom.xml verify, node --test scripts/audit-legacy.test.cjs e,
em frontend/, npm ci seguido de npm run build. O build copia os arquivos originais
sem redesenhar a interface. GitHub Actions verifica o backend com PostgreSQL 17.
Use um banco exclusivo de testes: as suítes limpam os registros de CRM.

Os testes cobrem autenticação JWT, isolamento desktop, CSRF, Host/Origin,
identificadores numéricos, importação com rollback, preservação do histórico,
venda/estoque na mesma transação e recálculo de lucro por custo e despesa.
