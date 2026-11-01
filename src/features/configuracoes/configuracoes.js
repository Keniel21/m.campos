// ==========================================================================
// AUTO DRIVE CRM - CONFIGURATIONS & THEME & NAVIGATION FEATURE
// ==========================================================================

import { state } from '../../services/state.js';
import { loadProfiles } from '../../services/supabase.js';
import { getOperationalToday } from '../../utils/helpers.js';

// Theme Toggle Logic
export function initAppTheme() {
    const savedTheme = localStorage.getItem("app-theme") || "light";
    const isDark = savedTheme === "dark";
    
    if (isDark) {
        document.body.classList.add("dark-mode");
    } else {
        document.body.classList.remove("dark-mode");
    }
    
    const themeBtns = document.querySelectorAll(".theme-toggle-btn");
    themeBtns.forEach(btn => {
        if (isDark) {
            btn.classList.remove("active");
            btn.innerHTML = `<i data-lucide="moon"></i>`;
        } else {
            btn.classList.add("active");
            btn.innerHTML = `<i data-lucide="sun"></i>`;
        }
    });
}

export function toggleAppTheme() {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("app-theme", isDark ? "dark" : "light");
    
    const themeBtns = document.querySelectorAll(".theme-toggle-btn");
    themeBtns.forEach(btn => {
        if (isDark) {
            btn.classList.remove("active");
            btn.innerHTML = `<i data-lucide="moon"></i>`;
        } else {
            btn.classList.add("active");
            btn.innerHTML = `<i data-lucide="sun"></i>`;
        }
    });
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Sidebar toggle logic
export function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    if (!sidebar) return;

    if (sidebar.classList.contains("hover-expanded")) {
        sidebar.classList.remove("hover-expanded");
        sidebar.classList.remove("collapsed");
        localStorage.setItem("sidebar-collapsed", "false");
        if (toggleBtn) {
            toggleBtn.innerHTML = `<i data-lucide="chevron-left"></i>`;
        }
    } else {
        sidebar.classList.toggle("collapsed");
        const isCollapsed = sidebar.classList.contains("collapsed");
        localStorage.setItem("sidebar-collapsed", isCollapsed);

        if (toggleBtn) {
            toggleBtn.innerHTML = isCollapsed
                ? `<i data-lucide="chevron-right"></i>`
                : `<i data-lucide="chevron-left"></i>`;
        }
    }
    lucide.createIcons();
}

// Main Tab Navigation Switcher
export function switchTab(tabId) {
    document.querySelectorAll(".tab-pane").forEach(pane => pane.classList.remove("active"));
    document.querySelectorAll(".sidebar-menu .menu-item").forEach(item => item.classList.remove("active"));
    
    const tabEl = document.getElementById(`${tabId}-tab`);
    if (tabEl) tabEl.classList.add("active");
    
    const highlightTabId = tabId === 'car-details' ? 'estoque' : tabId;
    const activeMenuItem = document.querySelector(`.sidebar-menu .menu-item[data-tab="${highlightTabId}"]`);
    if (activeMenuItem) activeMenuItem.classList.add("active");
    
    const titleObj = {
        'dashboard': { t: "Dashboard Operacional", s: "Visão unificada das vendas, estoque e lucratividade" },
        'estoque': { t: "Gestão de Estoque", s: "Controle de margens, tempo de pátio e preparação de veículos" },
        'leads': { t: "Funil Comercial (CRM)", s: "Pipeline ativo de negociações e acompanhamento de contatos" },
        'vendas': { t: "Histórico de Fechamentos", s: "Registro financeiro de todos os veículos vendidos" },
        'financeiro': { t: "Fluxo de Caixa Operacional", s: "Demonstrativo financeiro simples de receitas e despesas" },
        'agenda': { t: "Agenda Operacional", s: "Planejamento logístico de visitas, cartório e oficinas" },
        'usuarios': { t: "Aprovações de Usuários", s: "Gerencie o acesso de novos operadores ao CRM" },
        'clientes': { t: "Gestão de Clientes", s: "Base de parceiros, lojas e compradores frequentes" },
        'car-details': { t: "Ficha do Veículo", s: "Informações completas, despesas e documentação" },
        'configuracoes': { t: "Configurações do Sistema", s: "Dados da Empresa, múltiplos CNPJs emissores e parâmetros" }
    };
    
    const titleEl = document.getElementById("current-tab-title");
    const subtitleEl = document.getElementById("current-tab-subtitle");
    if (titleEl) titleEl.innerText = titleObj[tabId] ? titleObj[tabId].t : "Aba";
    if (subtitleEl) subtitleEl.innerText = titleObj[tabId] ? titleObj[tabId].s : "";
    
    if (tabId === 'dashboard') {
        if (window.updatePeriodUI) window.updatePeriodUI();
        setTimeout(() => window.initCharts(), 50);
    }
    else if (tabId === 'financeiro') {
        if (window.updatePeriodUI) window.updatePeriodUI();
        setTimeout(() => window.initFinanceChart(), 50);
    }
    else if (tabId === 'usuarios') loadProfiles();
    else if (tabId === 'configuracoes') renderCompanyCnpjsTable();
    else if (tabId === 'vendas') {
        if (window.updatePeriodUI) window.updatePeriodUI();
        if (window.renderVendasTable) window.renderVendasTable();
    }
    else if (tabId === 'estoque') {
        if (window.renderEstoque) window.renderEstoque();
    }
    else if (tabId === 'leads') {
        if (window.renderKanban) window.renderKanban();
        if (window.renderLeadsList) window.renderLeadsList();
    }
    else if (tabId === 'clientes') {
        if (window.renderClientesTable) window.renderClientesTable();
    }
    lucide.createIcons();
}

// Universal menu search
export let searchSelectedIdx = -1;
export let currentSearchResults = [];

export function toggleMenuSearch(event) {
    if (event) event.stopPropagation();
    const input = document.getElementById('navbar-search-input');
    const dropdown = document.getElementById('search-results-dropdown');
    if (!input || !dropdown) return;

    if (input.classList.contains('expanded')) {
        if (input.value.trim() !== '') {
            if (currentSearchResults.length > 0) {
                const idx = searchSelectedIdx >= 0 ? searchSelectedIdx : 0;
                selectSearchResult(idx);
            }
        } else {
            closeMenuSearch();
        }
    } else {
        input.classList.add('expanded');
        input.focus();
        handleMenuSearch('');
    }
}

export function closeMenuSearch() {
    const input = document.getElementById('navbar-search-input');
    const dropdown = document.getElementById('search-results-dropdown');
    if (input) {
        input.value = '';
        input.classList.remove('expanded');
    }
    if (dropdown) dropdown.classList.remove('active');
    searchSelectedIdx = -1;
    currentSearchResults = [];
}

export function handleMenuSearch(query) {
    const dropdown = document.getElementById('search-results-dropdown');
    if (!dropdown) return;

    searchSelectedIdx = -1;
    if (!query) {
        currentSearchResults = [
            { type: 'action', title: 'Adicionar Novo Veículo', sub: 'Cadastrar carro no estoque', icon: 'plus-circle', action: () => window.openAddCarModal() },
            { type: 'action', title: 'Adicionar Novo Lead', sub: 'Registrar novo contato no funil', icon: 'user-plus', action: () => window.openAddLeadModal() },
            { type: 'action', title: 'Registrar Nova Despesa', sub: 'Lançar saída de caixa', icon: 'arrow-down-right', action: () => window.openAddDespesaModal() },
            { type: 'action', title: 'Consultar Tabela Fipe', sub: 'Buscar preço médio no BrasilAPI', icon: 'search', action: () => window.openFipeSearchModal() },
            { type: 'action', title: 'Consultar Placa (Demo)', sub: 'Simular consulta placa Sinesp', icon: 'shield', action: () => window.openPlacaDemoModal() }
        ];
    } else {
        const q = query.toLowerCase();
        currentSearchResults = [];

        // Search in Stock
        state.estoque.forEach(car => {
            if (car.model.toLowerCase().includes(q) || (car.plate && car.plate.toLowerCase().includes(q)) || (car.chassis && car.chassis.toLowerCase().includes(q))) {
                currentSearchResults.push({
                    type: 'estoque',
                    title: car.model,
                    sub: `Placa: ${car.plate || 'S/P'} | R$ ${car.sellPrice.toLocaleString('pt-BR')}`,
                    icon: 'car',
                    action: () => { window.switchTab('estoque'); window.openCarDetails(car.id); }
                });
            }
        });

        // Search in Leads
        state.leads.forEach(lead => {
            if (lead.name.toLowerCase().includes(q) || (lead.phone && lead.phone.toLowerCase().includes(q))) {
                currentSearchResults.push({
                    type: 'leads',
                    title: lead.name,
                    sub: `Lead: ${lead.status} | Tel: ${lead.phone || 'S/T'}`,
                    icon: 'users',
                    action: () => { window.switchTab('leads'); window.openEditLeadModal(lead.id); }
                });
            }
        });
    }

    renderSearchResults();
}

export function renderSearchResults() {
    const dropdown = document.getElementById('search-results-dropdown');
    if (!dropdown) return;

    if (currentSearchResults.length === 0) {
        dropdown.innerHTML = `<div class="search-result-empty">Nenhum resultado encontrado</div>`;
        dropdown.classList.add('active');
        return;
    }

    dropdown.innerHTML = currentSearchResults.map((res, idx) => {
        const isSelected = idx === searchSelectedIdx ? 'selected' : '';
        return `
            <div class="search-result-item ${isSelected}" onclick="window.selectSearchResult(${idx})">
                <i data-lucide="${res.icon || 'arrow-right'}"></i>
                <div class="search-result-text">
                    <div class="search-result-title">${res.title}</div>
                    <div class="search-result-sub">${res.sub}</div>
                </div>
            </div>
        `;
    }).join('');

    dropdown.classList.add('active');
    lucide.createIcons();
}

export function handleMenuSearchKey(event) {
    if (!currentSearchResults.length) return;

    if (event.key === 'ArrowDown') {
        event.preventDefault();
        searchSelectedIdx = (searchSelectedIdx + 1) % currentSearchResults.length;
        renderSearchResults();
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        searchSelectedIdx = (searchSelectedIdx - 1 + currentSearchResults.length) % currentSearchResults.length;
        renderSearchResults();
    } else if (event.key === 'Enter') {
        event.preventDefault();
        const idx = searchSelectedIdx >= 0 ? searchSelectedIdx : 0;
        selectSearchResult(idx);
    } else if (event.key === 'Escape') {
        closeMenuSearch();
    }
}

export function selectSearchResult(idx) {
    const res = currentSearchResults[idx];
    if (res && res.action) {
        res.action();
        closeMenuSearch();
    }
}

// Filter periods helpers — using authoritative operational today date
export function getFilteredDates() {
    const today = getOperationalToday();
    today.setHours(23, 59, 59, 999);
    let start = new Date(0);
    const end = today;

    if (state.activePeriodFilter === 'today') {
        start = new Date(today.getTime()); start.setHours(0, 0, 0, 0);
    } else if (state.activePeriodFilter === '7d') {
        start = new Date(today.getTime()); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    } else if (state.activePeriodFilter === '30d') {
        start = new Date(today.getTime()); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
    } else if (state.activePeriodFilter === 'month') {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        endMonth.setHours(23, 59, 59, 999);
        return { start, end: endMonth };
    } else if (state.activePeriodFilter === 'year') {
        start = new Date(today.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        const endYear = new Date(today.getFullYear(), 11, 31);
        endYear.setHours(23, 59, 59, 999);
        return { start, end: endYear };
    } else if (state.activePeriodFilter === 'custom') {
        start = state.customDateStart ? new Date(state.customDateStart + 'T00:00:00') : new Date(0);
        return { start, end: state.customDateEnd ? new Date(state.customDateEnd + 'T23:59:59') : today };
    } else {
        start = new Date(0);
    }
    return { start, end };
}

export function getPeriodLabel() {
    const labels = {
        'today': 'Hoje',
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias',
        'month': 'Este mês',
        'year': 'Este ano',
        'all': 'Todo o período',
        'custom': state.customDateStart && state.customDateEnd
            ? `${state.customDateStart.split('-').reverse().join('/')} → ${state.customDateEnd.split('-').reverse().join('/')}`
            : 'Personalizado'
    };
    return labels[state.activePeriodFilter] || '';
}

export function applyPeriodFilter(preset) {
    if (preset === 'custom' && state.activePeriodFilter === 'custom') {
        state.activePeriodFilter = state.previousNonCustomPeriodFilter || '30d';
    } else {
        if (preset !== 'custom') {
            state.previousNonCustomPeriodFilter = preset;
        }
        state.activePeriodFilter = preset;
    }
    updatePeriodUI();
    window.updateApplicationState();
    if (document.getElementById('dashboard-tab').classList.contains('active')) {
        setTimeout(() => window.initCharts(), 50);
    } else if (document.getElementById('financeiro-tab').classList.contains('active')) {
        setTimeout(() => window.initFinanceChart(), 50);
    }
}

export function applyCustomPeriod() {
    const s = document.getElementById('period-date-start');
    const e = document.getElementById('period-date-end');
    if (s && e && s.value && e.value) {
        state.customDateStart = s.value;
        state.customDateEnd = e.value;
        state.activePeriodFilter = 'custom';
        updatePeriodUI();
        window.updateApplicationState();
        if (document.getElementById('dashboard-tab').classList.contains('active')) {
            setTimeout(() => window.initCharts(), 50);
        } else if (document.getElementById('financeiro-tab').classList.contains('active')) {
            setTimeout(() => window.initFinanceChart(), 50);
        }
    }
}

export function syncAndApplyCustomPeriod(source) {
    const suffix = source === 'vendas' ? '-vendas' : '-financeiro';
    const s = document.getElementById('period-date-start' + suffix);
    const e = document.getElementById('period-date-end' + suffix);
    if (s && e && s.value && e.value) {
        state.customDateStart = s.value;
        state.customDateEnd = e.value;
        state.activePeriodFilter = 'custom';
        updatePeriodUI();
        window.updateApplicationState();
        if (document.getElementById('financeiro-tab').classList.contains('active')) {
            setTimeout(() => window.initFinanceChart(), 50);
        } else if (document.getElementById('dashboard-tab').classList.contains('active')) {
            setTimeout(() => window.initCharts(), 50);
        }
    }
}

export function updatePeriodUI() {
    const isCustom = state.activePeriodFilter === 'custom';

    // Update active class on buttons
    const allGroups = ['period-btns-dashboard', 'period-btns-vendas', 'period-btns-financeiro'];
    const presetToText = {
        'today': 'Hoje', '7d': '7 dias', '30d': '30 dias',
        'month': 'Este mês', 'year': 'Este ano', 'all': 'Tudo', 'custom': 'Personalizado'
    };
    allGroups.forEach(groupId => {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.period-btn').forEach(btn => {
            btn.classList.toggle('active', btn.innerText.trim() === (presetToText[state.activePeriodFilter] || ''));
        });
    });

    // Expose inputs
    const customRangeIds = [
        'period-custom-range',
        'period-custom-range-vendas',
        'period-custom-range-financeiro'
    ];
    customRangeIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = isCustom ? 'flex' : 'none';
    });

    // Synchronize values
    if (isCustom && state.customDateStart && state.customDateEnd) {
        const startIds = ['period-date-start', 'period-date-start-vendas', 'period-date-start-financeiro'];
        const endIds = ['period-date-end', 'period-date-end-vendas', 'period-date-end-financeiro'];
        startIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = state.customDateStart; });
        endIds.forEach(id => { const el = document.getElementById(id); if (el) el.value = state.customDateEnd; });
    }

    // Update label text in header
    const labelText = getPeriodLabel();
    const infoIds = ['period-filter-info-dashboard', 'period-filter-info-vendas', 'period-filter-info-financeiro'];
    infoIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = labelText;
    });
}

// ==========================================================================
// DADOS DA EMPRESA & GESTÃO DE MÚLTIPLOS CNPJS
// ==========================================================================

export function populateSellerCnpjsDropdown(selectEl, currentVal = '') {
    if (!selectEl) return;
    
    // Ensure state.companyCnpjs exists
    if (!state.companyCnpjs || !Array.isArray(state.companyCnpjs) || state.companyCnpjs.length === 0) {
        state.companyCnpjs = JSON.parse(localStorage.getItem('crm_company_cnpjs') || 'null') || [
            { id: 1, name: "M. DIAS DE CAMPOS LTDA", cnpj: "65.760.566/0001-67", ie: "096/4119528", isDefault: true },
            { id: 2, name: "JK LEAL CONSULTORIA", cnpj: "60.116.934/0001-15", ie: "", isDefault: false }
        ];
        localStorage.setItem('crm_company_cnpjs', JSON.stringify(state.companyCnpjs));
    }

    const items = state.companyCnpjs;
    const cleanCurrent = (currentVal || '').trim();
    const cleanDigits = cleanCurrent.replace(/\D/g, '');

    let matchedItem = null;
    if (cleanDigits) {
        matchedItem = items.find(item => {
            const itemDigits = (item.cnpj || '').replace(/\D/g, '');
            return itemDigits && (itemDigits === cleanDigits || cleanCurrent === item.cnpj);
        });
    }

    let optionsHtml = '';
    items.forEach(item => {
        const isMatch = matchedItem ? (item.cnpj === matchedItem.cnpj) : false;
        const defaultTag = item.isDefault ? ' (Matriz Principal)' : '';
        optionsHtml += `<option value="${item.cnpj}"${isMatch ? ' selected' : ''}>${item.name} — ${item.cnpj}${defaultTag}</option>`;
    });

    // If current value is custom and not in registered list
    if (cleanCurrent && !matchedItem && cleanCurrent !== 'custom') {
        optionsHtml += `<option value="${cleanCurrent}" selected>${cleanCurrent} (CNPJ Informado)</option>`;
    }

    optionsHtml += `<option value="custom">✏️ Digitar outro CNPJ manual...</option>`;
    selectEl.innerHTML = optionsHtml;

    if (matchedItem) {
        selectEl.value = matchedItem.cnpj;
    } else if (cleanCurrent && cleanCurrent !== 'custom') {
        selectEl.value = cleanCurrent;
    } else if (!cleanCurrent) {
        const defaultItem = items.find(i => i.isDefault) || items[0];
        if (defaultItem) selectEl.value = defaultItem.cnpj;
    }
}

export function updateSellerCnpjDatalists() {
    // 1. Update legacy datalists if present
    const datalists = document.querySelectorAll('#seller-cnpjs-list');
    const items = state.companyCnpjs || [];
    if (datalists.length) {
        const optionsHtml = items.map(item => `<option value="${item.cnpj}">${item.name} (${item.cnpj})</option>`).join('');
        datalists.forEach(dl => { dl.innerHTML = optionsHtml; });
    }

    // 2. Update all seller select dropdowns in the app
    const sellSelect = document.getElementById('cd-sell-seller-cnpj');
    if (sellSelect && sellSelect.tagName === 'SELECT') {
        const currentVal = sellSelect.value;
        populateSellerCnpjsDropdown(sellSelect, currentVal);
    }

    const editVendaSelect = document.getElementById('edit-venda-seller-cnpj');
    const modalEditVenda = document.getElementById('modal-edit-venda');
    const isModalActive = modalEditVenda && modalEditVenda.classList.contains('active');
    if (editVendaSelect && editVendaSelect.tagName === 'SELECT' && !isModalActive) {
        const currentVal = editVendaSelect.value;
        populateSellerCnpjsDropdown(editVendaSelect, currentVal);
    }

    renderProfileCnpjsQuickList();
}

export function handleSellerCnpjSelectChange(selectEl) {
    if (!selectEl) return;
    const isEditModal = selectEl.id === 'edit-venda-seller-cnpj';
    const wrapperId = isEditModal ? 'edit-venda-custom-cnpj-wrapper' : 'cd-sell-custom-cnpj-wrapper';
    const inputId = isEditModal ? 'edit-venda-seller-cnpj-custom' : 'cd-sell-seller-cnpj-custom';

    const wrapper = document.getElementById(wrapperId);
    const customInput = document.getElementById(inputId);
    if (selectEl.value === 'custom') {
        if (wrapper) wrapper.style.display = 'block';
        if (customInput) {
            customInput.focus();
        }
    } else {
        if (wrapper) wrapper.style.display = 'none';
        if (customInput) customInput.value = '';
    }
}

export async function quickAddSellerCnpjPrompt() {
    const name = prompt("Nome da Loja / Razão Social da Filial:", "Nova Filial AutoDrive");
    if (!name || !name.trim()) return;

    const cnpj = prompt("Número do CNPJ (ex: 00.000.000/0001-00):");
    if (!cnpj || !cnpj.trim()) return;

    const newItem = {
        name: name.trim(),
        cnpj: cnpj.trim(),
        ie: "",
        isDefault: (!state.companyCnpjs || state.companyCnpjs.length === 0)
    };

    try {
        const res = await fetch('/api/company-cnpjs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.list)) {
                state.companyCnpjs = data.list;
            }
        }
    } catch (_) {
        if (!state.companyCnpjs) state.companyCnpjs = [];
        state.companyCnpjs.push({ id: Date.now(), ...newItem });
    }

    try {
        localStorage.setItem('crm_company_cnpjs', JSON.stringify(state.companyCnpjs));
    } catch (_) {}

    renderCompanyCnpjsTable();
    updateSellerCnpjDatalists();

    const sellSelect = document.getElementById('cd-sell-seller-cnpj');
    if (sellSelect) {
        populateSellerCnpjsDropdown(sellSelect, newItem.cnpj);
        sellSelect.value = newItem.cnpj;
    }

    const editVendaSelect = document.getElementById('edit-venda-seller-cnpj');
    if (editVendaSelect) {
        populateSellerCnpjsDropdown(editVendaSelect, newItem.cnpj);
        editVendaSelect.value = newItem.cnpj;
    }

    if (window.showToast) {
        window.showToast(`CNPJ ${newItem.cnpj} cadastrado e sincronizado com a nuvem!`, 'success');
    }
}

export function renderProfileCnpjsQuickList() {
    const container = document.getElementById('profile-cnpjs-quick-list');
    if (!container) return;

    const items = state.companyCnpjs || [];
    if (items.length === 0) {
        container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); font-style:italic; padding:6px;">Nenhum CNPJ cadastrado. Clique no botão acima para adicionar.</div>`;
        return;
    }

    container.innerHTML = items.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-hover, rgba(255,255,255,0.03)); padding:8px 10px; border-radius:8px; border:1px solid var(--border-subtle, rgba(255,255,255,0.08));">
            <div>
                <div style="font-size:13px; font-weight:600; color:var(--text-light);">${item.name}</div>
                <div style="font-size:12px; font-family:monospace; color:var(--text-muted);">${item.cnpj}</div>
            </div>
            <div>
                ${item.isDefault ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:var(--green-profit); font-size:11px; padding:2px 8px; font-weight:600;"><i data-lucide="check" style="width:11px;height:11px;margin-right:2px;display:inline-block;vertical-align:middle;"></i>Matriz Padrão</span>` : `<span class="badge" style="font-size:11px; color:var(--text-muted);">Filial</span>`}
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

export function renderCompanyCnpjsTable() {
    const tbody = document.getElementById('company-cnpjs-table-body');
    if (!tbody) return;

    const items = state.companyCnpjs || [];

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 24px; color: var(--text-muted);">
                    Nenhum CNPJ cadastrado. Utilize o formulário acima para adicionar a matriz e filiais do seu grupo.
                </td>
            </tr>
        `;
        updateSellerCnpjDatalists();
        return;
    }

    tbody.innerHTML = items.map(item => `
        <tr style="border-bottom:1px solid var(--border-subtle, rgba(255,255,255,0.05));">
            <td style="padding:14px 12px;">
                <div style="font-weight:600; color:var(--text-light); font-size:14px; display:flex; align-items:center; gap:8px;">
                    <i data-lucide="building-2" style="width:16px;height:16px;color:var(--blue-primary);"></i>
                    ${item.name}
                </div>
            </td>
            <td style="padding:14px 12px; font-family:monospace; font-weight:600; color:var(--text-light);">
                ${item.cnpj}
            </td>
            <td style="padding:14px 12px; font-size:13px; color:var(--text-muted);">
                ${item.ie || 'Não informada'}
            </td>
            <td style="padding:14px 12px;">
                ${item.isDefault 
                    ? `<span class="badge" style="background:rgba(34,197,94,0.15); color:var(--green-profit); border:1px solid rgba(34,197,94,0.3); font-weight:600;"><i data-lucide="check" style="width:12px;height:12px;margin-right:4px;"></i>Matriz Principal</span>` 
                    : `<span class="badge" style="background:rgba(148,163,184,0.1); color:var(--text-muted);">Filial / Unidade</span>`}
            </td>
            <td style="padding:14px 12px; text-align:center;">
                <div style="display:flex; gap:8px; justify-content:center;">
                    ${!item.isDefault ? `
                        <button class="btn btn-secondary btn-sm" onclick="window.handleSetDefaultCompanyCnpj(${item.id})" title="Definir como Matriz Principal">
                            <i data-lucide="star" style="width:14px;height:14px;margin-right:4px;"></i> Tornar Padrão
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="window.handleDeleteCompanyCnpj(${item.id})" title="Remover CNPJ">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    updateSellerCnpjDatalists();
}

export async function handleAddCompanyCnpj() {
    const nameInput = document.getElementById('config-cnpj-name');
    const numberInput = document.getElementById('config-cnpj-number');
    const ieInput = document.getElementById('config-cnpj-ie');

    if (!nameInput || !numberInput) return;

    const name = nameInput.value.trim();
    const cnpj = numberInput.value.trim();
    const ie = ieInput ? ieInput.value.trim() : '';

    if (!name || !cnpj) {
        alert("Por favor, preencha o Apelido da Loja e o CNPJ.");
        return;
    }

    const newItem = {
        name,
        cnpj,
        ie,
        isDefault: !state.companyCnpjs || state.companyCnpjs.length === 0
    };

    try {
        const res = await fetch('/api/company-cnpjs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newItem)
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.list)) {
                state.companyCnpjs = data.list;
            }
        }
    } catch (_) {
        if (!state.companyCnpjs) state.companyCnpjs = [];
        state.companyCnpjs.push({ id: Date.now(), ...newItem });
    }

    try {
        localStorage.setItem('crm_company_cnpjs', JSON.stringify(state.companyCnpjs));
    } catch (_) {}

    nameInput.value = '';
    numberInput.value = '';
    if (ieInput) ieInput.value = '';

    renderCompanyCnpjsTable();
    updateSellerCnpjDatalists();
    if (window.showToast) {
        window.showToast(`CNPJ cadastrado e sincronizado com a nuvem!`, 'success');
    }
}

export async function handleDeleteCompanyCnpj(id) {
    if (!confirm("Tem certeza que deseja remover este CNPJ?")) return;

    try {
        const res = await fetch(`/api/company-cnpjs/${id}`, { method: 'DELETE' });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.list)) {
                state.companyCnpjs = data.list;
            }
        }
    } catch (_) {
        state.companyCnpjs = state.companyCnpjs.filter(item => String(item.id) !== String(id));
    }

    try {
        localStorage.setItem('crm_company_cnpjs', JSON.stringify(state.companyCnpjs));
    } catch (_) {}

    renderCompanyCnpjsTable();
    updateSellerCnpjDatalists();
}

export async function handleSetDefaultCompanyCnpj(id) {
    try {
        const res = await fetch(`/api/company-cnpjs/${id}/set-default`, { method: 'PUT' });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.list)) {
                state.companyCnpjs = data.list;
            }
        }
    } catch (_) {
        state.companyCnpjs.forEach(item => {
            item.isDefault = (String(item.id) === String(id));
        });
    }

    try {
        localStorage.setItem('crm_company_cnpjs', JSON.stringify(state.companyCnpjs));
    } catch (_) {}

    renderCompanyCnpjsTable();
    updateSellerCnpjDatalists();
}

// ==========================================================================
// MENU DROPDOWN DO PERFIL & EDIÇÃO DE PERFIL DO OPERADOR
// ==========================================================================

export function toggleUserProfileMenu(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('user-profile-dropdown');
    const chevron = document.getElementById('profile-chevron');
    if (!dropdown) return;

    const isActive = dropdown.classList.contains('active');

    // Fechar outros dropdowns abertos
    document.querySelectorAll('.user-profile-dropdown, .search-results-dropdown').forEach(d => d.classList.remove('active'));

    if (!isActive) {
        dropdown.classList.add('active');
        if (chevron) chevron.style.transform = 'rotate(180deg)';

        syncUserProfileHeaderDetails();

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    } else {
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

export function closeUserProfileMenu() {
    const dropdown = document.getElementById('user-profile-dropdown');
    const chevron = document.getElementById('profile-chevron');
    if (dropdown) dropdown.classList.remove('active');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
}

export function syncUserProfileHeaderDetails() {
    const savedName = localStorage.getItem('crm_user_display_name') || (state.sessionUser?.email ? state.sessionUser.email.split('@')[0].toUpperCase() : 'Marcelo Motors');
    const savedEmail = localStorage.getItem('crm_user_email') || state.sessionUser?.email || 'operador@autodrive.com';
    const savedRole = localStorage.getItem('crm_user_role') || 'Operador Único';

    const footerUsername = document.getElementById('footer-username');
    const footerUserrole = document.getElementById('footer-userrole');
    const footerAvatar = document.getElementById('footer-avatar');
    const dropdownUsername = document.getElementById('dropdown-username');
    const dropdownUserEmail = document.getElementById('dropdown-user-email');
    const dropdownAvatar = document.getElementById('dropdown-avatar');

    const nameParts = savedName.trim().split(' ').filter(Boolean);
    const initials = nameParts.length > 1 
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : (savedName.substring(0, 2).toUpperCase() || 'AD');

    if (footerUsername) footerUsername.innerText = savedName;
    if (footerUserrole) footerUserrole.innerText = savedRole;
    if (footerAvatar) footerAvatar.innerText = initials;
    if (dropdownUsername) dropdownUsername.innerText = savedName;
    if (dropdownUserEmail) dropdownUserEmail.innerText = savedEmail;
    if (dropdownAvatar) dropdownAvatar.innerText = initials;
}

export function openEditProfileModal() {
    const savedName = localStorage.getItem('crm_user_display_name') || document.getElementById('footer-username')?.innerText || 'Marcelo Motors';
    const savedEmail = localStorage.getItem('crm_user_email') || state.sessionUser?.email || 'operador@autodrive.com';
    const savedRole = localStorage.getItem('crm_user_role') || 'Operador Único';

    const nameInput = document.getElementById('edit-profile-name');
    const emailInput = document.getElementById('edit-profile-email');
    const roleInput = document.getElementById('edit-profile-role');

    if (nameInput) nameInput.value = savedName;
    if (emailInput) emailInput.value = savedEmail;
    if (roleInput) roleInput.value = savedRole;

    renderProfileCnpjsQuickList();

    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.add('active');
}

export function closeEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (modal) modal.classList.remove('active');
}

export function saveUserProfile(event) {
    if (event) event.preventDefault();
    const nameInput = document.getElementById('edit-profile-name');
    const emailInput = document.getElementById('edit-profile-email');
    const roleInput = document.getElementById('edit-profile-role');

    if (!nameInput) return;

    const name = nameInput.value.trim() || 'Marcelo Motors';
    const email = emailInput ? emailInput.value.trim() : 'operador@autodrive.com';
    const role = roleInput ? roleInput.value.trim() : 'Operador Único';

    localStorage.setItem('crm_user_display_name', name);
    localStorage.setItem('crm_user_email', email);
    localStorage.setItem('crm_user_role', role);

    syncUserProfileHeaderDetails();
    closeEditProfileModal();
}

// Fechar menu ao clicar fora
if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('#navbar-user-profile')) {
            closeUserProfileMenu();
        }
    });
}

if (typeof window !== 'undefined') {
    window.renderCompanyCnpjsTable = renderCompanyCnpjsTable;
    window.handleAddCompanyCnpj = handleAddCompanyCnpj;
    window.handleDeleteCompanyCnpj = handleDeleteCompanyCnpj;
    window.handleSetDefaultCompanyCnpj = handleSetDefaultCompanyCnpj;
    window.updateSellerCnpjDatalists = updateSellerCnpjDatalists;
    window.populateSellerCnpjsDropdown = populateSellerCnpjsDropdown;
    window.handleSellerCnpjSelectChange = handleSellerCnpjSelectChange;
    window.quickAddSellerCnpjPrompt = quickAddSellerCnpjPrompt;
    window.renderProfileCnpjsQuickList = renderProfileCnpjsQuickList;
    window.toggleUserProfileMenu = toggleUserProfileMenu;
    window.closeUserProfileMenu = closeUserProfileMenu;
    window.syncUserProfileHeaderDetails = syncUserProfileHeaderDetails;
    window.openEditProfileModal = openEditProfileModal;
    window.closeEditProfileModal = closeEditProfileModal;
    window.saveUserProfile = saveUserProfile;
}

