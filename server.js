const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Prevent any HTTP caching on central database & API routes
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

let aiClient = null;
async function getGenAI() {
  if (!aiClient) {
    const { GoogleGenAI } = await import('@google/genai');
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Auto Agente LLM endpoint
app.post('/api/auto-agente', async (req, res) => {
  try {
    const { message, conversationHistory = [], crmContext = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Mensagem é obrigatória.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'Chave de API Gemini (GEMINI_API_KEY) não configurada no servidor.'
      });
    }

    const ai = await getGenAI();
    const { Type } = await import('@google/genai');

    const tools = [
      {
        functionDeclarations: [
          {
            name: "create_lead",
            description: "Cadastra um novo lead/cliente em potencial no CRM AutoDrive",
            parameters: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: "Nome do cliente/lead" },
                phone: { type: Type.STRING, description: "Telefone ou WhatsApp com DDD" },
                email: { type: Type.STRING, description: "E-mail de contato (opcional)" },
                interestCar: { type: Type.STRING, description: "Modelo ou descrição do veículo de interesse" },
                budget: { type: Type.NUMBER, description: "Orçamento ou valor em R$ que o cliente pretende gastar" },
                channel: { type: Type.STRING, description: "Canal de origem (whatsapp, instagram, site, indicacao, balcao)" },
                notes: { type: Type.STRING, description: "Observações iniciais sobre o lead" }
              },
              required: ["name"]
            }
          },
          {
            name: "create_appointment",
            description: "Agenda um novo compromisso na agenda do CRM (ex: test-drive, visita, entrega de carro, reunião com cliente)",
            parameters: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Título claro do compromisso (ex: Test-Drive Corolla)" },
                clientName: { type: Type.STRING, description: "Nome do cliente participante" },
                clientPhone: { type: Type.STRING, description: "Telefone para contato" },
                carModel: { type: Type.STRING, description: "Veículo relacionado ao compromisso" },
                date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
                time: { type: Type.STRING, description: "Horário no formato HH:MM" },
                type: { type: Type.STRING, description: "Tipo: test-drive, visita, entrega, reuniao, outro" },
                notes: { type: Type.STRING, description: "Observações ou detalhes do agendamento" }
              },
              required: ["title", "date", "time"]
            }
          },
          {
            name: "add_expense",
            description: "Lança uma despesa operacional, manutenção ou preparação de veículo no financeiro",
            parameters: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING, description: "Descrição do serviço ou despesa realizada" },
                amount: { type: Type.NUMBER, description: "Valor em Reais (R$)" },
                carModel: { type: Type.STRING, description: "Veículo/placa vinculado à despesa (ou 'Geral' se não for de carro)" },
                category: { type: Type.STRING, description: "Categoria: mecanica, funilaria, higienizacao, documentacao, combustivel, marketing, operacional" },
                date: { type: Type.STRING, description: "Data do gasto YYYY-MM-DD (padrão é hoje)" }
              },
              required: ["description", "amount"]
            }
          },
          {
            name: "update_car_status",
            description: "Atualiza o status de um carro no estoque (disponivel, preparacao, reservado ou vendido)",
            parameters: {
              type: Type.OBJECT,
              properties: {
                carModel: { type: Type.STRING, description: "Nome, modelo ou placa do carro" },
                status: { type: Type.STRING, description: "Novo status: disponivel, preparacao, reservado, vendido" },
                notes: { type: Type.STRING, description: "Motivo ou nota adicional" }
              },
              required: ["carModel", "status"]
            }
          },
          {
            name: "add_lead_interaction",
            description: "Adiciona uma anotação ou registro de contato na timeline de um lead cadastrado",
            parameters: {
              type: Type.OBJECT,
              properties: {
                leadName: { type: Type.STRING, description: "Nome do lead já cadastrado" },
                note: { type: Type.STRING, description: "Conteúdo da anotação / histórico" }
              },
              required: ["leadName", "note"]
            }
          },
          {
            name: "navigate_to",
            description: "Navega para uma tela do CRM ou abre a ficha técnica de um veículo",
            parameters: {
              type: Type.OBJECT,
              properties: {
                tab: { type: Type.STRING, description: "Aba: dashboard, estoque, leads, agenda, vendas, financeiro, configuracoes" },
                detailId: { type: Type.STRING, description: "ID opcional para abrir direto o veículo" }
              },
              required: ["tab"]
            }
          }
        ]
      }
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const systemInstruction = `
Você é o **Auto Agente**, o co-piloto e assistente executivo de inteligência artificial integrado diretamente ao **AutoDrive CRM** (sistema de alta performance para gestão de revenda de veículos e concessionárias).

**Data atual:** ${todayStr}.

**Seu Papel e Recursos:**
1. **Compreender comandos em linguagem natural** de gestores, vendedores e operadores da loja.
2. **Executar Ações Diretas no CRM** chamando as funções adequadas (Function Calling / Tools):
   - Cadastrar Leads (\`create_lead\`)
   - Agendar Compromissos / Test-drives (\`create_appointment\`)
   - Lançar Despesas / Manutenções (\`add_expense\`)
   - Atualizar status de carros (\`update_car_status\`)
   - Inserir anotações em leads (\`add_lead_interaction\`)
   - Navegar na interface (\`navigate_to\`)
3. **Analisar o estoque, CNPJs e métricas:** Você recebe um resumo em tempo real do CRM (\`crmContext\`) com lista de veículos, leads ativos, vendas recentes, compromissos e CNPJs/empresas cadastradas no perfil (\`cnpjsCadastrados\`). Use essas informações para responder com precisão cirúrgica sobre tempo de pátio, preços, clientes, CNPJs e lucros.
4. **Gerar conteúdos comerciais:** Crie mensagens de WhatsApp, e-mails ou anúncios para redes sociais (Instagram/OLX/Webmotors) com tom persuasivo e profissional quando solicitado.

**Diretrizes de Resposta:**
- Seja proativo, educado, ágil e resolutivo. Responda em português do Brasil.
- Quando executar uma ação (ex: cadastrar lead ou agendar test-drive), descreva de forma elegante o que foi realizado.
- Se o usuário fornecer data relativa como "amanhã", "hoje às 16h", "sexta-feira", calcule a data YYYY-MM-DD correspondente considerando a data atual (${todayStr}).
- Valores monetários devem ser formatados no padrão brasileiro R$ (ex: R$ 85.000,00).

**Dados em Tempo Real do CRM:**
${JSON.stringify(crmContext, null, 2)}
`;

    // Build chat contents array
    const contents = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        if (msg.role && msg.text) {
          contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
          });
        }
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    // Model fallback chain to handle high-demand spikes (503 / 429) smoothly
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
    let lastError = null;
    let response = null;

    for (const modelName of candidateModels) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            tools: tools,
            temperature: 0.7
          }
        });
        if (response) {
          break; // Succeeded!
        }
      } catch (err) {
        console.warn(`[Auto Agente] Falha temporária com modelo ${modelName}:`, err.message);
        lastError = err;
        // Continue to next candidate model
      }
    }

    if (!response) {
      throw lastError || new Error('Não foi possível obter resposta dos modelos de IA.');
    }

    const responseText = response.text || '';
    const functionCalls = response.functionCalls || [];

    res.json({
      text: responseText,
      functionCalls: functionCalls.map(fc => ({
        name: fc.name,
        args: fc.args,
        id: fc.id
      }))
    });
  } catch (error) {
    console.error('Erro no Auto Agente:', error);
    let userFriendlyMsg = 'Ocorreu uma instabilidade temporária no serviço de IA. Por favor, tente novamente em alguns instantes.';
    try {
      if (typeof error.message === 'string') {
        if (error.message.includes('503') || error.message.includes('high demand') || error.message.includes('UNAVAILABLE')) {
          userFriendlyMsg = 'O servidor da Google AI está com alta demanda momentânea. Uma nova tentativa rápida costuma resolver.';
        } else {
          userFriendlyMsg = error.message;
        }
      }
    } catch (_) {}

    res.status(500).json({
      error: userFriendlyMsg
    });
  }
});

// OAuth callback handler for Google & third-party popup authentication
app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Autenticação Google Agenda</title>
      </head>
      <body style="background:#0f172a; color:#f8fafc; font-family:system-ui, -apple-system, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
        <div style="text-align:center; padding:24px; background:#1e293b; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.5); max-width:360px;">
          <div style="font-size:32px; margin-bottom:12px;">🗓️</div>
          <h3 style="margin:0 0 8px 0; font-size:18px; color:#38bdf8;">Conectado com Sucesso!</h3>
          <p style="margin:0; font-size:13px; color:#94a3b8;">Sua agenda do Google foi vinculada ao AutoDrive CRM.</p>
        </div>
        <script>
          const hash = window.location.hash.substring(1);
          const search = window.location.search.substring(1);
          const params = new URLSearchParams(hash || search);
          const accessToken = params.get('access_token');
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'GOOGLE_OAUTH_SUCCESS', 
              accessToken: accessToken, 
              params: Object.fromEntries(params) 
            }, '*');
            setTimeout(() => {
              window.close();
            }, 800);
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
});

// ==========================================================================
// CENTRALIZED CRM CLOUD DATABASE & CNPJ PERSISTENCE ENGINE
// ==========================================================================
const fs = require('fs');
const DB_DIR = path.join(__dirname, 'database');
if (!fs.existsSync(DB_DIR)) {
  try { fs.mkdirSync(DB_DIR, { recursive: true }); } catch (_) {}
}

const DEFAULT_CNPJS = [
  {
    id: 1,
    name: "M. DIAS DE CAMPOS LTDA",
    cnpj: "65.760.566/0001-67",
    ie: "096/4119528",
    isDefault: true
  },
  {
    id: 2,
    name: "JK LEAL CONSULTORIA",
    cnpj: "60.116.934/0001-15",
    ie: "",
    isDefault: false
  }
];

const BACKUP_DIR = path.join(DB_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
  try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (_) {}
}

function getDbFile(name) {
  return path.join(DB_DIR, `${name}.json`);
}

function readDb(name, fallback = []) {
  try {
    const file = getDbFile(name);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const content = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed || fallback);
  } catch (err) {
    console.error(`Error reading ${name}.json:`, err.message);
    return fallback;
  }
}

function writeDb(name, data) {
  try {
    const file = getDbFile(name);
    const tempFile = `${file}.tmp.${Date.now()}`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, payload, 'utf-8');
    fs.renameSync(tempFile, file);

    // Save instant snapshot for critical transactional collections
    if (name === 'vendas' || name === 'estoque') {
      try {
        const backupFile = path.join(BACKUP_DIR, `${name}_latest.json`);
        fs.writeFileSync(backupFile, payload, 'utf-8');
      } catch (_) {}
    }
    return true;
  } catch (err) {
    console.error(`Error atomically writing ${name}.json:`, err.message);
    try {
      const file = getDbFile(name);
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e2) {
      console.error(`Fatal writeDb error on ${name}.json:`, e2.message);
      return false;
    }
  }
}

// 1. Company CNPJs Endpoints
app.get('/api/company-cnpjs', (req, res) => {
  const cnpjs = readDb('company_cnpjs', DEFAULT_CNPJS);
  res.json(cnpjs);
});

app.post('/api/company-cnpjs', (req, res) => {
  const { name, cnpj, ie, isDefault } = req.body;
  if (!name || !cnpj) {
    return res.status(400).json({ error: 'Nome e CNPJ são obrigatórios.' });
  }

  const list = readDb('company_cnpjs', DEFAULT_CNPJS);
  const cleanCnpj = cnpj.trim();
  const existingIdx = list.findIndex(c => c.cnpj === cleanCnpj);
  const makeDefault = Boolean(isDefault || list.length === 0);

  if (makeDefault) {
    list.forEach(c => c.isDefault = false);
  }

  let item;
  if (existingIdx >= 0) {
    list[existingIdx] = {
      ...list[existingIdx],
      name: name.trim(),
      ie: (ie !== undefined && ie !== null) ? String(ie).trim() : list[existingIdx].ie || '',
      isDefault: makeDefault ? true : list[existingIdx].isDefault
    };
    item = list[existingIdx];
  } else {
    item = {
      id: Date.now(),
      name: name.trim(),
      cnpj: cleanCnpj,
      ie: (ie !== undefined && ie !== null) ? String(ie).trim() : '',
      isDefault: makeDefault
    };
    list.push(item);
  }

  writeDb('company_cnpjs', list);
  res.json({ success: true, item, list });
});

app.put('/api/company-cnpjs/:id/set-default', (req, res) => {
  const targetId = req.params.id;
  const list = readDb('company_cnpjs', DEFAULT_CNPJS);
  list.forEach(c => {
    c.isDefault = (String(c.id) === String(targetId) || String(c.cnpj) === String(targetId));
  });
  writeDb('company_cnpjs', list);
  res.json({ success: true, list });
});

app.delete('/api/company-cnpjs/:id', (req, res) => {
  const targetId = req.params.id;
  let list = readDb('company_cnpjs', DEFAULT_CNPJS);
  const deletedItem = list.find(c => String(c.id) === String(targetId) || String(c.cnpj) === String(targetId));
  list = list.filter(c => String(c.id) !== String(targetId) && String(c.cnpj) !== String(targetId));

  if (deletedItem && deletedItem.isDefault && list.length > 0) {
    list[0].isDefault = true;
  }

  writeDb('company_cnpjs', list);
  res.json({ success: true, list });
});

// 2. Full Unified CRM Cloud Sync
app.get('/api/crm/data', (req, res) => {
  const estoque = readDb('estoque', []);
  const vendas = readDb('vendas', []);

  // Compute authoritative operational anchor date from sales and stock
  let anchorDate = '2026-10-19';
  vendas.forEach(v => {
    if (v.date && v.date > anchorDate) anchorDate = v.date;
  });
  estoque.forEach(c => {
    if (c.soldDate && c.soldDate > anchorDate) anchorDate = c.soldDate;
  });

  res.json({
    serverDate: new Date().toISOString(),
    anchorDate,
    companyCnpjs: readDb('company_cnpjs', DEFAULT_CNPJS),
    estoque,
    vendas,
    clientes: readDb('clientes', []),
    despesas: readDb('despesas', []),
    agenda: readDb('agenda', []),
    leads: readDb('leads', []),
    documentos: readDb('documentos', [])
  });
});

// 2.1 Vehicle Documents (Documentos Veículo) Cloud Endpoints
app.get('/api/crm/documentos', (req, res) => {
  const list = readDb('documentos', []);
  res.json(list);
});

app.post('/api/crm/documentos', (req, res) => {
  const doc = req.body;
  if (!doc || (!doc.carId && !doc.car_id)) {
    return res.status(400).json({ error: 'Veículo não informado para o documento.' });
  }

  const list = readDb('documentos', []);
  const carIdVal = doc.carId || doc.car_id;
  const fileNameVal = doc.fileName || doc.file_name || 'documento';
  const fileUrlVal = doc.fileUrl || doc.file_url || '#';
  const fileTypeVal = doc.fileType || doc.file_type || (fileNameVal.split('.').pop().toLowerCase());
  const descVal = doc.description || 'Documento Técnico';
  const createdVal = doc.createdAt || doc.created_at || new Date().toISOString();

  const newId = doc.id || (list.length > 0 ? Math.max(...list.map(d => Number(d.id) || 0)) + 1 : 1);
  const newDoc = {
    id: newId,
    carId: carIdVal,
    car_id: carIdVal,
    fileName: fileNameVal,
    file_name: fileNameVal,
    fileUrl: fileUrlVal,
    file_url: fileUrlVal,
    fileType: fileTypeVal,
    file_type: fileTypeVal,
    description: descVal,
    createdAt: createdVal,
    created_at: createdVal
  };

  list.unshift(newDoc);
  writeDb('documentos', list);
  res.json({ success: true, item: newDoc });
});

app.delete('/api/crm/documentos/:id', (req, res) => {
  const targetId = req.params.id;
  let list = readDb('documentos', []);
  list = list.filter(d => String(d.id) !== String(targetId));
  writeDb('documentos', list);
  res.json({ success: true });
});

// 3. Vehicles (Estoque) Cloud Endpoints
app.post('/api/crm/estoque', (req, res) => {
  const car = req.body;
  if (!car || !car.model) {
    return res.status(400).json({ error: 'Dados do veículo inválidos.' });
  }
  const list = readDb('estoque', []);
  const newId = car.id || (list.length > 0 ? Math.max(...list.map(c => Number(c.id) || 0)) + 1 : 1);
  const newCar = {
    ...car,
    id: newId,
    createdAt: car.createdAt || new Date().toISOString()
  };
  list.unshift(newCar);
  writeDb('estoque', list);
  res.json({ success: true, car: newCar });
});

app.put('/api/crm/estoque/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const list = readDb('estoque', []);
  const idx = list.findIndex(c => String(c.id) === String(id));
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    writeDb('estoque', list);
    return res.json({ success: true, car: list[idx] });
  }
  res.status(404).json({ error: 'Veículo não encontrado.' });
});

app.delete('/api/crm/estoque/:id', (req, res) => {
  const id = req.params.id;
  let list = readDb('estoque', []);
  list = list.filter(c => String(c.id) !== String(id));
  writeDb('estoque', list);
  res.json({ success: true });
});

// 4. Sales (Vendas) Cloud Endpoints
app.post('/api/crm/vendas', (req, res) => {
  const sale = req.body;
  if (!sale || !sale.client) {
    return res.status(400).json({ error: 'Dados da venda inválidos.' });
  }

  const vendas = readDb('vendas', []);
  const estoque = readDb('estoque', []);

  const sellerCnpjVal = sale.sellerCnpj || sale.seller_cnpj || '';
  const carIdNum = sale.carId ? Number(sale.carId) : (sale.car_id ? Number(sale.car_id) : null);
  const newId = sale.id ? Number(sale.id) : (vendas.length > 0 ? Math.max(...vendas.map(v => Number(v.id) || 0)) + 1 : 1);
  const priceVal = Number(sale.sellPrice) || Number(sale.sell_price) || 0;
  const dateVal = sale.date || new Date().toISOString().split('T')[0];

  const newSale = {
    ...sale,
    carId: carIdNum,
    car_id: carIdNum,
    client: (sale.client || '').trim(),
    clientDocument: (sale.clientDocument || sale.client_document || '').trim(),
    client_document: (sale.clientDocument || sale.client_document || '').trim(),
    sellerCnpj: sellerCnpjVal,
    seller_cnpj: sellerCnpjVal,
    sellPrice: priceVal,
    sell_price: priceVal,
    profit: Number(sale.profit) || 0,
    margin: Number(sale.margin) || 0,
    date: dateVal,
    type: sale.type || 'convencional',
    id: newId,
    createdAt: sale.createdAt || new Date().toISOString()
  };

  // Remove any duplicate id
  const existingIdx = vendas.findIndex(v => String(v.id) === String(newId));
  if (existingIdx >= 0) {
    vendas[existingIdx] = newSale;
  } else {
    vendas.unshift(newSale);
  }
  writeDb('vendas', vendas);

  // Update vehicle status in inventory to 'vendido'
  let carIdx = -1;
  const targetCarId = sale.carId !== undefined && sale.carId !== null ? sale.carId : sale.car_id;
  if (targetCarId !== undefined && targetCarId !== null) {
    carIdx = estoque.findIndex(c => String(c.id) === String(targetCarId));
  }
  if (carIdx < 0 && sale.plate) {
    const cleanPlate = String(sale.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    carIdx = estoque.findIndex(c => c.plate && String(c.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
  }
  if (carIdx >= 0) {
    estoque[carIdx].status = 'vendido';
    if (priceVal > 0) estoque[carIdx].sellPrice = priceVal;
    estoque[carIdx].soldDate = dateVal;
    newSale.carId = estoque[carIdx].id;
    newSale.car_id = estoque[carIdx].id;
    writeDb('estoque', estoque);
  }

  res.json({ success: true, sale: newSale });
});

app.put('/api/crm/vendas/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  const vendas = readDb('vendas', []);
  const idx = vendas.findIndex(v => String(v.id) === String(id));
  if (idx >= 0) {
    const sellerCnpjVal = updates.sellerCnpj !== undefined ? updates.sellerCnpj : (updates.seller_cnpj !== undefined ? updates.seller_cnpj : (vendas[idx].sellerCnpj || vendas[idx].seller_cnpj || ''));
    const priceVal = updates.sellPrice !== undefined ? Number(updates.sellPrice) : (updates.sell_price !== undefined ? Number(updates.sell_price) : vendas[idx].sellPrice);
    
    vendas[idx] = {
      ...vendas[idx],
      ...updates,
      sellerCnpj: sellerCnpjVal,
      seller_cnpj: sellerCnpjVal,
      sellPrice: priceVal,
      sell_price: priceVal
    };
    writeDb('vendas', vendas);

    // Sync inventory car if applicable
    const carId = vendas[idx].carId || vendas[idx].car_id;
    if (carId && priceVal > 0) {
      const estoque = readDb('estoque', []);
      const carIdx = estoque.findIndex(c => String(c.id) === String(carId));
      if (carIdx >= 0) {
        estoque[carIdx].sellPrice = priceVal;
        writeDb('estoque', estoque);
      }
    }

    return res.json({ success: true, sale: vendas[idx] });
  }
  res.status(404).json({ error: 'Venda não encontrada.' });
});

app.delete('/api/crm/vendas/:id', (req, res) => {
  const id = req.params.id;
  let vendas = readDb('vendas', []);
  const sale = vendas.find(v => String(v.id) === String(id));
  vendas = vendas.filter(v => String(v.id) !== String(id));
  writeDb('vendas', vendas);

  // If vehicle exists, revert to 'disponivel'
  const carId = sale ? (sale.carId || sale.car_id) : null;
  const estoque = readDb('estoque', []);
  let carIdx = -1;
  if (carId) {
    carIdx = estoque.findIndex(c => String(c.id) === String(carId));
  }
  if (carIdx < 0 && sale && sale.plate) {
    const cleanPlate = String(sale.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    carIdx = estoque.findIndex(c => c.plate && String(c.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
  }
  if (carIdx >= 0) {
    estoque[carIdx].status = 'disponivel';
    delete estoque[carIdx].soldDate;
    writeDb('estoque', estoque);
  }

  res.json({ success: true });
});

// 5. Clientes, Despesas, Agenda, Leads Endpoints
app.post('/api/crm/clientes', (req, res) => {
  const list = readDb('clientes', []);
  const newClient = { id: Date.now(), ...req.body };
  list.push(newClient);
  writeDb('clientes', list);
  res.json({ success: true, client: newClient });
});

app.post('/api/crm/despesas', (req, res) => {
  const list = readDb('despesas', []);
  const newExpense = { id: Date.now(), ...req.body };
  list.unshift(newExpense);
  writeDb('despesas', list);
  res.json({ success: true, expense: newExpense });
});

app.delete('/api/crm/despesas/:id', (req, res) => {
  let list = readDb('despesas', []);
  list = list.filter(d => String(d.id) !== String(req.params.id));
  writeDb('despesas', list);
  res.json({ success: true });
});

app.post('/api/crm/agenda', (req, res) => {
  const list = readDb('agenda', []);
  const newItem = { id: Date.now(), ...req.body };
  list.push(newItem);
  writeDb('agenda', list);
  res.json({ success: true, agenda: newItem });
});

app.delete('/api/crm/agenda/:id', (req, res) => {
  let list = readDb('agenda', []);
  list = list.filter(a => String(a.id) !== String(req.params.id));
  writeDb('agenda', list);
  res.json({ success: true });
});

// 6. Resilient Outbox Batch Sync Endpoint
app.post('/api/crm/sync-batch', (req, res) => {
  const { pendingSales = [], pendingCars = [] } = req.body;
  const estoque = readDb('estoque', []);
  const vendas = readDb('vendas', []);

  // Process pending cars
  pendingCars.forEach(car => {
    if (!car || !car.model) return;
    const existingIdx = estoque.findIndex(c => String(c.id) === String(car.id) || (c.plate && car.plate && c.plate === car.plate));
    if (existingIdx >= 0) {
      estoque[existingIdx] = { ...estoque[existingIdx], ...car };
    } else {
      estoque.unshift(car);
    }
  });

  // Process pending sales
  pendingSales.forEach(sale => {
    if (!sale || !sale.client) return;
    const existingIdx = vendas.findIndex(v => String(v.id) === String(sale.id));
    if (existingIdx >= 0) {
      vendas[existingIdx] = { ...vendas[existingIdx], ...sale };
    } else {
      vendas.unshift(sale);
    }

    // Link and mark car as sold
    const targetCarId = sale.carId !== undefined ? sale.carId : sale.car_id;
    let carIdx = -1;
    if (targetCarId !== undefined && targetCarId !== null) {
      carIdx = estoque.findIndex(c => String(c.id) === String(targetCarId));
    }
    if (carIdx < 0 && sale.plate) {
      const cleanPlate = String(sale.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      carIdx = estoque.findIndex(c => c.plate && String(c.plate).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === cleanPlate);
    }
    if (carIdx >= 0) {
      estoque[carIdx].status = 'vendido';
      estoque[carIdx].soldDate = sale.date || new Date().toISOString().split('T')[0];
      if (sale.sellPrice) estoque[carIdx].sellPrice = Number(sale.sellPrice);
    }
  });

  writeDb('estoque', estoque);
  writeDb('vendas', vendas);

  res.json({ success: true, processedSales: pendingSales.length, processedCars: pendingCars.length });
});

// Serve Service Worker with proper PWA headers
app.get('/service-worker.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});

// Serve static files from the root directory
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});


