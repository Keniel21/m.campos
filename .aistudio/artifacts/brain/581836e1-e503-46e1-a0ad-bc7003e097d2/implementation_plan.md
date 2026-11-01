# Plano de Ação: Filtro Independente do Relógio Local e Persistência Confiável de Dados

Este plano de ação define as soluções de arquitetura e código para resolver definitivamente os dois problemas reportados:
1. **Independência de Relógio Local nos Filtros:** O sistema deixará de depender do relógio/fuso do navegador ou sistema operacional do usuário, passando a adotar uma âncora temporal unificada baseada no servidor e nos dados operacionais reais.
2. **Armazenamento e Persistência Segura de Estoque e Vendas:** Implementação de persistência atômica no servidor, fila de reenvio resiliente no cliente (*Offline Outbox Queue*), integração com nuvem e recuperação/restauração das 9 vendas e veículos do relatório CSV.

---

## Decisões Críticas e Opções para Aprovação do Usuário

> [!IMPORTANT]
> Nenhuma linha de código será modificada sem a sua aprovação deste plano. 
> Solicitamos a sua validação nas decisões abaixo:

- **Decisão 1: Restauração Imediata dos Dados do Relatório CSV (Recomendado: SIM)**
  - O relatório que você nos enviou contém os dados completos das 9 vendas (IDs 189 a 197) e dos 7 veículos que haviam sumido (`RYV1J39`, `IYU0617`, `IXC4B14`, `IXL6400`, `IZZ7D20`, `QJF3F49`, `FDB5F79`), além da reclassificação da venda do Bronco `REP7D93` e Triton `FHL0C03`.
  - **Ação proposta:** O plano incluirá a injeção e gravação definitiva desses registros diretamente na base persistente do servidor, restabelecendo o histórico exato de 18 vendas em Outubro/2026.
- **Decisão 2: Arquitetura de Nuvem para Persistência Contínua**
  - **Opção A (Recomendada - Firestore já provisionado):** O projeto já possui credenciais ativas do Firebase Firestore (`ai-studio-automotivesaas-581836e1-e503-46e1-a0ad-bc7003e097d2`) em `firebase-applet-config.json`. Conectaremos a sincronização secundária a esse banco em nuvem, mantendo o backend Node.js (`server.js`) como cache local primário rápido e transacional.
  - **Opção B (Modo Servidor Local com Snapshots Automáticos):** Utilizar exclusivamente o backend Node.js com escritas atômicas e snapshots automáticos diários em disco (`database/backups/`), dispensando serviços de terceiros.

---

## 1. Visão Geral e Arquitetura da Solução

### Problema 1: Dependência do Relógio Local no Filtro
- **Como funciona hoje:** A função `getFilteredDates()` chama `new Date()`. Se o computador do usuário estiver no ano de 2024 ou com fuso horário descalibrado, os filtros "Este mês", "Hoje" e "30 dias" buscam datas de 2024. Como os dados operacionais estão registrados em Outubro de 2026, todas as vendas são consideradas "datas futuras" e desaparecem da visualização.
- **Solução Proposta:** 
  - O backend fornecerá na rota `/api/crm/data` o campo `serverDate` e o sistema calculará o `referenceDate` operacional (a data da última movimentação válida do sistema ou a data do servidor).
  - Todos os cálculos de "Hoje", "Últimos 7 dias", "Últimos 30 dias", "Este mês" e "Este ano" passarão a usar essa âncora de data oficial, garantindo que o mesmo período seja exibido para **qualquer usuário, em qualquer navegador, computador ou celular**, independentemente da hora configurada no Windows/Mac/Android/iOS.

### Problema 2: Falha de Persistência e Sobrescrita de Dados
- **Como funciona hoje:** Se uma requisição de cadastro (`POST /api/crm/vendas` ou `POST /api/crm/estoque`) falhar por lentidão ou oscilação de rede, o navegador salva apenas em memória local. Ao recarregar a tela (`F5`), a função `fetchCloudData()` busca os dados do servidor e descarta tudo o que estava apenas na memória volátil do navegador.
- **Solução Proposta:**
  - **Escrita Atômica no Disco:** O servidor Node.js gravará arquivos via escrita segura temporária (`.tmp` seguido de `renameSync`), evitando arquivos corrompidos ou operações cortadas pela metade.
  - **Fila de Sincronização Local (*Outbox Queue*):** Caso uma requisição falhe por falta de sinal ou atraso, a operação é enfileirada no `localStorage` com status pendente e reexecutada automaticamente com retry exponencial. A sincronização de leitura (`fetchCloudData`) é proibida de apagar itens com status pendente de envio.
  - **Backup Snapshot:** A cada venda gravada com sucesso, um backup com timestamp é armazenado em `database/backups/` para auditoria e recuperação instantânea.

---

## 2. Experiência do Usuário e Fluxos de Uso

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FLUXO UNIFICADO DE FILTRAGEM                         │
└────────────────────────────────────────────────────────────────────────┘
  Navegador abre o sistema (em qualquer aparelho/ano)
                         │
                         ▼
  Sistema recebe "serverDate" e calcula "operationalAnchorDate"
  (Ex: 19/10/2026 ancorado com precisão)
                         │
                         ▼
  Filtro "Este mês" seleciona: 01/10/2026 até 31/10/2026
                         │
                         ▼
  Tabela de Vendas exibe imediatamente as 18 vendas de Outubro/2026
  (Com KPIs de faturamento, margem e lucro 100% calculados)
```

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FLUXO RESILIENTE DE PERSISTÊNCIA                     │
└────────────────────────────────────────────────────────────────────────┘
  Usuário confirma Venda ou Cadastro de Veículo
                         │
                         ▼
  1. Adiciona à Fila Local Protegida (Outbox)
                         │
                         ▼
  2. Envia POST ao servidor Node.js (/api/crm/vendas)
         ├── Sucesso: grava atomicamente no servidor e remove da Outbox
         └── Falha de rede: mantém na Outbox com indicador visual discreto
                         │
                         ▼
  3. Atualização em segundo plano no Firestore em nuvem
```

- **Feedback Visual na Tabela:** Indicador de status claro (ex: "Sincronizado com o servidor central") no rodapé da tabela.
- **Sem Telas em Branco:** Se o filtro selecionado pelo usuário não contiver registros, o sistema exibe um aviso amigável com botão direto para "Ver histórico completo (X vendas)".

---

## 3. Matriz de Impacto em Outras Funcionalidades

| Funcionalidade | Tipo de Impacto | Medidas de Salvaguarda |
| :--- | :---: | :--- |
| **Menu de Estoque** | Positivo | Os 7 veículos novos recuperados do relatório voltarão ao pátio com seus respectivos status, quilometragens e valores de compra. |
| **Menu de Vendas** | Positivo | Passará a exibir as 18 vendas do mês de Outubro/2026 de forma consistente em qualquer navegador. |
| **Dashboard Operacional** | Positivo | Os gráficos de faturamento mensal e os cards de KPI (lucro, veículos vendidos, ticket médio) passarão a refletir as 18 vendas reais sem sumiço. |
| **Módulo Financeiro (DRE)** | Positivo | As receitas e margens das vendas de Outubro serão consolidadas no DRE sem interferir nos lançamentos de despesas operacionais. |
| **Módulo de Clientes** | Sem Impacto Negativo | Os compradores das vendas (ex: Carlos Imaruy, Dimotors, Connect Trade) já constam ou serão vinculados normalmente. |
| **Exportação Excel / Relatórios** | Positivo | A exportação continuará gerando o arquivo com o mesmo formato do relatório fornecido, agora alinhado 1:1 com o que é visto na tela. |

---

## 4. Arquitetura Técnica e Etapas de Execução

```
┌────────────────────────────────────────────────────────────────────────┐
│                       ARQUITETURA DE DADOS                             │
└────────────────────────────────────────────────────────────────────────┘
                    Dispositivo do Usuário (Browser)
                     ├── ReferenceDateManager (Âncora de Tempo do Servidor)
                     └── OutboxSyncEngine (Fila de Persistência Segura)
                                       │
                                       ▼ HTTP REST /api/crm/*
                              Servidor Node.js (server.js)
                                       ├── Escrita Atômica (atomic-write)
                                       ├── database/vendas.json
                                       ├── database/estoque.json
                                       └── database/backups/ (Snapshots)
                                       │
                                       ▼ (Sync Nuvem em Segundo Plano)
                              Firebase Firestore
```

### Etapas Detalhadas de Implementação:

1. **Etapa 1: Ingestão e Restauração dos Dados do Relatório CSV**
   - Injetar no `database/vendas.json` as 9 vendas faltantes (189 a 197) com todos os campos presentes no relatório (cliente, documento, CNPJ emissor, valores de compra/venda, margens e datas).
   - Injetar no `database/estoque.json` os 7 veículos novos correspondentes com placa, chassi, renavam, ano e quilometragem extraídos do relatório.
   - Atualizar os veículos `REP7D93` e `FHL0C03` para status `"vendido"`.

2. **Etapa 2: Implementação do ReferenceDateManager (Independência de Relógio Local)**
   - No backend (`server.js`), incluir `serverDate: new Date().toISOString()` e `anchorDate: "2026-10-19"` no retorno de `/api/crm/data`.
   - No frontend (`src/features/configuracoes/configuracoes.js`), refatorar `getFilteredDates()` para derivar a data de referência a partir de `state.operationalDate` (ou a data mais recente das transações de vendas/estoque), nunca dependendo exclusivamente de `new Date()` da máquina cliente.

3. **Etapa 3: Motor de Persistência Segura no Backend (`server.js`)**
   - Substituir gravações diretas de JSON por escrita atômica (grava em arquivo temporário `.tmp` e executa `fs.renameSync`).
   - Implementar rota `/api/crm/sync-batch` para aceitar envio em lote de transações acumuladas pela Outbox.
   - Criar diretório `database/backups/` e gerar snapshot automático sempre que houver alteração de vendas ou estoque.

4. **Etapa 4: Fila de Sincronização e Proteção contra Sobrescrita (`estoque.js`, `vendas.js`, `supabase.js`)**
   - Criar mecanismo de Outbox no navegador (`localStorage.getItem('crm_pending_outbox')`).
   - Em `fetchCloudData()`, mesclar dados recebidos do servidor com itens pendentes da Outbox antes de atualizar `state.vendas` e `state.estoque`, garantindo que nenhuma ação local seja descartada por uma consulta de leitura.

5. **Etapa 5: Validação Completa de Cenários**
   - Testar o filtro "Este mês", "Hoje", "30 dias" e "Tudo" com relógios simulados em anos diferentes (2024, 2025 e 2026).
   - Testar cadastro de veículo e venda com simulação de oscilação de rede e conferir a persistência após `F5` / `Ctrl+F5`.
   - Validar que o relatório exportado confere 100% com a visualização da tela.
