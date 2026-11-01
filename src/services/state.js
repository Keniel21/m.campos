// ==========================================================================
// AUTO DRIVE CRM - CENTRALIZED STATE ENGINE
// ==========================================================================

export const state = {
    // Supabase Connection State
    supabaseClient: null,
    isCloudActive: false,
    sessionUser: null,

    // Global Date/Period Filters & Operational Reference Time Anchor
    operationalDate: '2026-10-19', // Dynamic operational reference date from server/data
    serverDate: null,
    pendingOutbox: (() => {
        try {
            return JSON.parse(localStorage.getItem('crm_pending_outbox') || '[]');
        } catch (_) { return []; }
    })(),
    activePeriodFilter: 'month', // 'month', '30d', '7d', 'today', 'year', 'all', 'custom'
    previousNonCustomPeriodFilter: 'month',
    customDateStart: null,
    customDateEnd: null,

    // Local Database (Fallbacks / Local Demo data)
    estoque: (() => {
        try {
            const saved = localStorage.getItem("autodrive_estoque");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}
        return [
            { id: 1, model: "Jeep Compass Longitude 2.0 Flex", year: "2021/2021", km: 42000, buyPrice: 110000, sellPrice: 125900, purchaseDate: "2026-05-20", status: "disponivel", type: "convencional", plate: "BRA2E26", color: "Cinza Metálico", chassis: "9BWZZZ99Z99999123", image_url: null },
            { id: 2, model: "Toyota Corolla XEi 2.0 Flex", year: "2020/2020", km: 58000, buyPrice: 95000, sellPrice: 108500, purchaseDate: "2026-06-22", status: "reservado", type: "convencional", plate: "PLQ7D90", color: "Preto Cristal", chassis: "9BWZZZ99Z99999456", image_url: null },
            { id: 3, model: "Honda Civic EXL 2.0", year: "2019/2019", km: 64000, buyPrice: 88000, sellPrice: 99900, purchaseDate: "2026-05-30", status: "disponivel", type: "convencional", plate: "OGK3F88", color: "Branco Pérola", chassis: "9BWZZZ99Z99999789", image_url: null },
            { id: 4, model: "VW Polo Comfortline 1.0 TSI", year: "2022/2023", km: 28000, buyPrice: 72000, sellPrice: 81900, purchaseDate: "2026-06-26", status: "preparacao", type: "convencional", plate: "RTS4G10", color: "Prata", chassis: "9BWZZZ99Z99999321", image_url: null },
            { id: 5, model: "Chevrolet Onix Plus LTZ Turbo", year: "2021/2021", km: 38000, buyPrice: 65000, sellPrice: 71000, purchaseDate: "2026-05-13", status: "disponivel", type: "repasse", plate: "HNS9F22", color: "Azul", chassis: "9BWZZZ99Z99999654", image_url: null },
            { id: 6, model: "Hyundai HB20 Evolution 1.0", year: "2020/2021", km: 49000, buyPrice: 53000, sellPrice: 58500, purchaseDate: "2026-06-12", status: "disponivel", type: "repasse", plate: "FTU4B44", color: "Vermelho", chassis: "9BWZZZ99Z99999987", image_url: null },
            { id: 7, model: "Ford Ka SE 1.0", year: "2019/2019", km: 75000, buyPrice: 38000, sellPrice: 42000, purchaseDate: "2026-06-30", status: "vendido", type: "repasse", plate: "KAS5H77", color: "Branco", chassis: "9BWZZZ99Z99999555", image_url: null }
        ];
    })(),
    leads: [
        { id: 1, name: "Carlos Alberto Santos", phone: "(11) 98765-4321", interestCarId: 1, origin: "Instagram", status: "negociação", lastContactDays: 2, nextAction: "Enviar simulação de financiamento hoje à tarde", interactions: [{ date: "20/05/2026", text: "Cliente entrou em contato via direct perguntando sobre Jeep Compass." }, { date: "21/05/2026", text: "Fizemos contato via WhatsApp. Enviou proposta de veículo na troca." }] },
        { id: 2, name: "Mariana Costa", phone: "(21) 99123-4567", interestCarId: 2, origin: "WhatsApp", status: "novo lead", lastContactDays: 0, nextAction: "Fazer primeiro contato de apresentação", interactions: [{ date: "22/05/2026", text: "Lead gerado automaticamente via botão flutuante do site." }] },
        { id: 3, name: "Ricardo Mendes", phone: "(11) 97321-8901", interestCarId: 3, origin: "OLX/Webmotors", status: "sem resposta", lastContactDays: 14, nextAction: "Fazer última tentativa de contato antes de arquivar", interactions: [{ date: "08/05/2026", text: "Cliente demonstrou interesse no Civic através da OLX." }, { date: "10/05/2026", text: "Enviei fotos adicionais do Civic. Não respondeu." }, { date: "15/05/2026", text: "Fiz cobrança de retorno. Sem resposta." }] },
        { id: 4, name: "Ana Beatriz Ramos", phone: "(31) 98456-1122", interestCarId: 4, origin: "Indicação", status: "contato realizado", lastContactDays: 4, nextAction: "Agendar vistoria cautelar na oficina", interactions: [{ date: "18/05/2026", text: "Indicada pelo primo. Gostou do Polo." }, { date: "20/05/2026", text: "Pediu para levar o carro para avaliação." }] },
        { id: 5, name: "Felipe Andrade Lins", phone: "(11) 99345-6789", interestCarId: 5, origin: "OLX/Webmotors", status: "sem resposta", lastContactDays: 32, nextAction: "Mudar status para perdido se não responder", interactions: [{ date: "20/04/2026", text: "Perguntou sobre condições de repasse no Onix." }, { date: "22/04/2026", text: "Enviado valor à vista de repasse. Sumiu." }] }
    ],
    clientes: [],
    vendas: (() => {
        try {
            const saved = localStorage.getItem("autodrive_vendas");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}
        return [
            { id: 1, carId: 7, client: "Antônio da Silva Lojista", clientDocument: "12.345.678/0001-90", sellerCnpj: "65.760.566/0001-67", seller_cnpj: "65.760.566/0001-67", sellPrice: 41000, date: "2026-07-28", profit: 3000, margin: 7.3, type: "repasse" },
            { id: 2, carId: null, client: "Juliana Medeiros", clientDocument: "123.456.789-00", sellerCnpj: "65.760.566/0001-67", seller_cnpj: "65.760.566/0001-67", sellPrice: 89000, date: "2026-07-20", profit: 12000, margin: 13.5, type: "convencional" },
            { id: 3, carId: null, client: "Gustavo Franco", clientDocument: "987.654.321-11", sellerCnpj: "60.116.934/0001-15", seller_cnpj: "60.116.934/0001-15", sellPrice: 52000, date: "2026-08-01", profit: 6000, margin: 11.5, type: "convencional" }
        ];
    })(),
    despesas: [
        { id: 1, desc: "Polimento Jeep Compass", carId: 1, date: "2026-05-12", val: 450, category: "Preparação" },
        { id: 2, desc: "Higienização interna Honda Civic", carId: 3, date: "2026-05-15", val: 250, category: "Preparação" },
        { id: 3, desc: "Martelinho de Ouro Polo", carId: 4, date: "2026-05-20", val: 350, category: "Preparação" },
        { id: 4, desc: "Impulsionamento Instagram - Compass", carId: 1, date: "2026-05-05", val: 200, category: "Marketing" },
        { id: 5, desc: "Assinatura Planos Portais (Webmotors/OLX)", carId: null, date: "2026-05-01", val: 600, category: "Marketing" }
    ],
    agenda: [
        { id: 1, title: "Apresentação Jeep Compass", date: "2026-05-22", time: "14:30", carId: 1, category: "visitas", desc: "Levar veículo ao Condomínio Quinta da Boa Vista" },
        { id: 2, title: "Entrega do Toyota Corolla", date: "2026-05-23", time: "10:00", carId: 2, category: "entregas", desc: "Encontro no Cartório do 3º Ofício para assinaturas" },
        { id: 3, title: "Levar Polo para Martelinho/Estética", date: "2026-05-22", time: "16:00", carId: 4, category: "revisao", desc: "Oficina do Marquinhos Polimentos" },
        { id: 4, title: "Vistoria Cautelar Civic", date: "2026-05-24", time: "09:00", carId: 3, category: "documentos", desc: "Posto Super Visão Cautelares" }
    ],

    // Company CNPJs & Multilojas State (Synchronized with cloud)
    companyCnpjs: (() => {
        const DEFAULT_ACTIVE_CNPJS = [
            { id: 1, name: "M. DIAS DE CAMPOS LTDA", cnpj: "65.760.566/0001-67", ie: "096/4119528", isDefault: true },
            { id: 2, name: "JK LEAL CONSULTORIA", cnpj: "60.116.934/0001-15", ie: "", isDefault: false }
        ];
        try {
            const stored = localStorage.getItem('crm_company_cnpjs');
            if (stored) {
                const parsed = JSON.parse(stored);
                // If local storage has obsolete dummy mock "AutoDrive Motors Matriz" or "12.345.678/0001-90", discard and use real
                const isDummy = parsed.some(c => c.cnpj === "12.345.678/0001-90" || c.name?.includes("AutoDrive Motors Matriz"));
                if (!isDummy && parsed.length > 0) {
                    return parsed;
                }
            }
        } catch (_) {}
        return DEFAULT_ACTIVE_CNPJS;
    })(),
    currentCalendarDate: new Date(),
    selectedAgendaDate: new Date(),
    documentosVeiculo: (() => {
        try {
            const saved = localStorage.getItem("autodrive_documentos");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (_) {}
        return [];
    })(),
    pendingDocFiles: [],
    leadViewMode: 'kanban',

    // Chart.js Instances
    chartSalesProfitInstance: null,
    chartLeadsOriginInstance: null,
    chartGiroEstoqueInstance: null,
    chartFinanceInstance: null
};

// Bind states dynamically to window to preserve global variable access without breaking DOM event listeners
export function initGlobalBindings() {
    Object.keys(state).forEach(key => {
        // Define getter/setter on window so that any function reassigning or reading these variables directly works transparently
        Object.defineProperty(window, key, {
            get() { return state[key]; },
            set(val) { state[key] = val; },
            configurable: true
        });
    });
}
