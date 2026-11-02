// Database data is authoritative, including empty lists.
export const state = {
    supabaseClient: null, isCloudActive: false, sessionUser: null,
    operationalDate: new Date().toLocaleDateString('en-CA'), serverDate: null,
    pendingOutbox: [], activePeriodFilter: 'month', previousNonCustomPeriodFilter: 'month',
    customDateStart: null, customDateEnd: null,
    estoque: [], leads: [], clientes: [], vendas: [], despesas: [], agenda: [], companyCnpjs: [],
    currentCalendarDate: new Date(), selectedAgendaDate: new Date(), documentosVeiculo: [],
    pendingDocFiles: [], leadViewMode: 'kanban',
    chartSalesProfitInstance: null, chartLeadsOriginInstance: null,
    chartGiroEstoqueInstance: null, chartFinanceInstance: null
};
export function initGlobalBindings() {
    Object.keys(state).forEach(key => Object.defineProperty(window, key, {
        get() { return state[key]; }, set(value) { state[key] = value; }, configurable: true
    }));
}
