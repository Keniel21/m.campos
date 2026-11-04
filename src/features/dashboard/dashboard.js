// ==========================================================================
// AUTO DRIVE CRM - OPERATIONAL COMMAND CENTER (AUTOAGENT DASHBOARD)
// ==========================================================================

import { state } from '../../services/state.js';
import { getFilteredDates, getPeriodLabel, switchTab } from '../configuracoes/configuracoes.js';
import { formatCurrency, calcDaysInStock } from '../../utils/helpers.js';

// Default daily objectives checklist
const DEFAULT_OBJECTIVES = [
    { text: "Responder todos os leads com retorno pendente", defaultChecked: false },
    { text: "Atualizar fotos e preços dos veículos parados", defaultChecked: false },
    { text: "Realizar test-drives e entregas agendadas", defaultChecked: false },
    { text: "Cobrar clientes com pendências ou documentação", defaultChecked: false },
    { text: "Publicar e impulsionar novos veículos no estoque", defaultChecked: false }
];

// Main export to calculate and render the entire AutoAgent Operational Dashboard
export function renderDashboard() {
    renderSmartAlerts();
    renderAutoAgentPanel();
    renderOperationalKPIs();
    renderActionCards();
    renderAgendaDay();
    renderObjectivesChecklist();
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// 1. BARRA DE ALERTAS INTELIGENTES (SMART ALERT CHIPS)
export function renderSmartAlerts() {
    const container = document.getElementById("smart-alert-chips");
    if (!container) return;

    // Operational checks from current state
    const leadsSemResposta = state.leads.filter(l => l.status === 'sem resposta' || l.status === 'novo lead').length;
    const parados45 = state.estoque.filter(c => c.status !== 'vendido' && calcDaysInStock(c.purchaseDate) > 45).length;
    const parados60 = state.estoque.filter(c => c.status !== 'vendido' && calcDaysInStock(c.purchaseDate) > 60).length;
    const semFotos = state.estoque.filter(c => c.status !== 'vendido' && !c.image_url).length;
    const novosLeadsHoje = state.leads.filter(l => l.status === 'novo lead' || l.lastContactDays === 0).length;
    const despesasPendentes = state.despesas.length;
    const reservados = state.estoque.filter(c => c.status === 'reservado').length;

    const chips = [];

    if (leadsSemResposta > 0) {
        chips.push({
            color: 'red',
            icon: 'message-square-warning',
            text: `${leadsSemResposta} cliente(s) aguardando resposta`,
            action: () => switchTab('leads')
        });
    }

    if (parados60 > 0) {
        chips.push({
            color: 'red',
            icon: 'alert-triangle',
            text: `${parados60} veículo(s) parados há +60 dias`,
            action: () => switchTab('estoque')
        });
    } else if (parados45 > 0) {
        chips.push({
            color: 'purple',
            icon: 'trending-down',
            text: `${parados45} veículo(s) acima do tempo médio`,
            action: () => switchTab('estoque')
        });
    }

    if (novosLeadsHoje > 0) {
        chips.push({
            color: 'blue',
            icon: 'user-plus',
            text: `${novosLeadsHoje} novo(s) lead(s) hoje`,
            action: () => switchTab('leads')
        });
    }

    if (semFotos > 0) {
        chips.push({
            color: 'orange',
            icon: 'camera-off',
            text: `${semFotos} anúncio(s) sem fotos`,
            action: () => switchTab('estoque')
        });
    }

    if (reservados > 0) {
        chips.push({
            color: 'green',
            icon: 'bookmark-check',
            text: `${reservados} veículo(s) reservado(s)`,
            action: () => switchTab('estoque')
        });
    }

    if (despesasPendentes > 0) {
        chips.push({
            color: 'yellow',
            icon: 'receipt',
            text: `${despesasPendentes} despesa(s) cadastradas`,
            action: () => switchTab('financeiro')
        });
    }

    // Only render chips if there are active occurrences
    if (chips.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    container.style.display = 'flex';
    container.innerHTML = chips.map((chip, idx) => `
        <div class="smart-alert-chip chip-${chip.color}" onclick="window.handleChipClick(${idx})">
            <i data-lucide="${chip.icon}" style="width:14px;height:14px;"></i>
            <span>${chip.text}</span>
        </div>
    `).join('');

    window._activeChips = chips;
}

window.handleChipClick = function(idx) {
    if (window._activeChips && window._activeChips[idx] && window._activeChips[idx].action) {
        window._activeChips[idx].action();
    }
};

// 2. PAINEL AUTOAGENT (FEATURED COMMAND CARD)
export function renderAutoAgentPanel() {
    const container = document.getElementById("autoagent-panel-container");
    if (!container) return;

    // Determine current user name & time greeting
    const userName = state.sessionUser?.name || state.sessionUser?.email?.split('@')[0] || "Operador";
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

    // Extract dynamic top priorities
    const priorities = [];

    // Priority 1: Lead waiting for reply
    const topLead = state.leads.find(l => l.status === 'sem resposta' || l.status === 'novo lead');
    if (topLead) {
        const car = state.estoque.find(c => c.id === topLead.interestCarId);
        const carText = car ? car.model : "veículo no estoque";
        priorities.push({
            type: 'lead',
            text: `<strong>${topLead.name}</strong> aguarda contato sobre o <strong>${carText}</strong>.`,
            tag: 'Alta chance de conversão',
            suggestedTitle: `Responder ${topLead.name}`,
            suggestedDesc: `Cliente manifestou interesse no ${carText} via ${topLead.origin}. Envie uma mensagem agora.`,
            actionName: 'Executar ação',
            actionFn: `openLeadDetailModal(${topLead.id})`
        });
    }

    // Priority 2: Stagnant car > 20 days
    const topCar = state.estoque
        .filter(c => c.status !== 'vendido')
        .sort((a, b) => calcDaysInStock(b.purchaseDate) - calcDaysInStock(a.purchaseDate))[0];

    if (topCar && calcDaysInStock(topCar.purchaseDate) >= 20) {
        const days = calcDaysInStock(topCar.purchaseDate);
        priorities.push({
            type: 'car',
            text: `<strong>${topCar.model}</strong> está parado no pátio há <strong>${days} dias</strong>.`,
            tag: 'Giro de estoque',
            suggestedTitle: `Revisar preço de ${topCar.model}`,
            suggestedDesc: `Veículo com ${days} dias de pátio (${formatCurrency(topCar.sellPrice)}). Considere um desconto ou destaque.`,
            actionName: 'Revisar Anúncio',
            actionFn: `openCarDetails(${topCar.id})`
        });
    }

    // Priority 3: Car without photos or pending document
    const noPhotoCar = state.estoque.find(c => c.status !== 'vendido' && !c.image_url);
    if (noPhotoCar) {
        priorities.push({
            type: 'photo',
            text: `<strong>${noPhotoCar.model}</strong> no estoque ainda não possui fotos.`,
            tag: 'Atenção visual',
            suggestedTitle: `Adicionar fotos no ${noPhotoCar.model}`,
            suggestedDesc: `Anúncios com fotos recebem até 5x mais contatos no CRM.`,
            actionName: 'Adicionar Fotos',
            actionFn: `openCarDetails(${noPhotoCar.id})`
        });
    } else if (state.despesas.length > 0) {
        priorities.push({
            type: 'expense',
            text: `Existem <strong>${state.despesas.length} despesas</strong> operacionais cadastradas este mês.`,
            tag: 'Conferência de Custos',
            suggestedTitle: `Conferir fluxo de caixa`,
            suggestedDesc: `Mantenha a margem líquida da revenda sob controle.`,
            actionName: 'Ver Financeiro',
            actionFn: `switchTab('financeiro')`
        });
    }

    // Fallback priority if inventory/leads are empty or pristine
    if (priorities.length === 0) {
        priorities.push({
            type: 'general',
            text: `Sua operação está 100% atualizada e sem pendências críticas.`,
            tag: 'Operação Excelente',
            suggestedTitle: `Cadastrar novo lead ou veículo`,
            suggestedDesc: `Mantenha o funil aquecido cadastrando novas intenções de compra.`,
            actionName: 'Novo Lead',
            actionFn: `openAddLeadModal()`
        });
    }

    const mainPriority = priorities[0];
    const opStatusText = priorities.length > 1 
        ? `Sua operação possui <strong>${priorities.length} prioridades</strong> precisando de atenção.`
        : `Sua loja está operando normalmente com fluxo ativo.`;

    container.innerHTML = `
        <div class="autoagent-panel-grid">
            <div class="autoagent-card-main">
                <div class="autoagent-avatar-box">
                    <i data-lucide="bot" style="width:28px;height:28px;"></i>
                    <span class="status-dot-pulse"></span>
                </div>
                <div class="autoagent-content">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px;">
                        <span class="autoagent-badge"><i data-lucide="sparkles" style="width:12px;height:12px;"></i> AutoAgent Assistente</span>
                        <span class="autoagent-status-tag">${opStatusText}</span>
                    </div>
                    <h2 class="autoagent-greeting">${greeting}, ${userName}.</h2>
                    <p class="autoagent-subtitle">Resumo em tempo real do seu Centro de Comando:</p>
                    <ul class="autoagent-priority-bullets">
                        ${priorities.map(p => `<li><i data-lucide="chevron-right" style="width:14px;height:14px;color:var(--blue-primary);flex-shrink:0;"></i> ${p.text}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div class="autoagent-card-suggestion">
                <div>
                    <span class="suggestion-label"><i data-lucide="target" style="width:12px;height:12px;"></i> Prioridade Sugerida</span>
                    <h3 class="suggestion-title">${mainPriority.suggestedTitle}</h3>
                    <span class="priority-tag high">${mainPriority.tag}</span>
                    <p class="suggestion-desc">${mainPriority.suggestedDesc}</p>
                </div>
                <button class="btn btn-primary w-full" style="margin-top:12px;" onclick="${mainPriority.actionFn}">
                    ${mainPriority.actionName} <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
                </button>
            </div>
        </div>
    `;
}

// 3. CARDS RESUMO (INDICADORES OPERACIONAIS - APENAS NÚMEROS)
export function renderOperationalKPIs() {
    const container = document.getElementById("operational-kpi-cards");
    if (!container) return;

    const { start, end } = getFilteredDates();

    // 1. Receita do Mês
    const vendasFiltradas = state.vendas.filter(v => {
        const d = new Date(v.date + 'T12:00:00');
        return d >= start && d <= end;
    });
    const receitaMes = vendasFiltradas.reduce((sum, v) => sum + v.sellPrice, 0);
    const qtdVendas = vendasFiltradas.length;

    // 2. Leads recebidos hoje / novos
    const leadsNovosHoje = state.leads.filter(l => l.status === 'novo lead' || l.lastContactDays === 0).length;
    const totalLeadsAtivos = state.leads.filter(l => l.status !== 'fechado' && l.status !== 'perdido').length;

    // 3. Clientes aguardando resposta
    const clientesAguardando = state.leads.filter(l => l.status === 'sem resposta' || l.status === 'novo lead').length;

    // 4. Valor total do estoque
    const disponiveis = state.estoque.filter(c => c.status !== 'vendido');
    const valorEstoque = disponiveis.reduce((sum, c) => sum + (c.sellPrice || 0), 0);
    const qtdDisponiveis = disponiveis.length;

    container.innerHTML = `
        <div class="kpi-card green">
            <div class="kpi-header">
                <span class="kpi-title">Receita (${getPeriodLabel()})</span>
                <div class="kpi-icon kpi-icon-clickable" onclick="toggleKpiBalloon(this, event)" title="Clique para ver a fórmula de cálculo">
                    <i data-lucide="badge-dollar-sign"></i>
                </div>
            </div>
            <div class="kpi-value">${formatCurrency(receitaMes)}</div>
            <div class="kpi-subtext"><i data-lucide="check-circle-2" style="width:12px;height:12px;color:var(--green-profit);"></i> ${qtdVendas} veículo(s) vendido(s)</div>
            <div class="kpi-balloon" style="display: none;">
                <div class="kpi-balloon-header">
                    <i data-lucide="calculator" style="width:13px;height:13px;"></i> Resumo do Cálculo
                </div>
                <div class="kpi-balloon-body">
                    Soma do <strong>Valor de Venda</strong> de todas as vendas efetuadas no período selecionado.
                </div>
            </div>
        </div>

        <div class="kpi-card blue">
            <div class="kpi-header">
                <span class="kpi-title">Leads Novos (Hoje)</span>
                <div class="kpi-icon kpi-icon-clickable" onclick="toggleKpiBalloon(this, event)" title="Clique para ver a fórmula de cálculo">
                    <i data-lucide="user-plus"></i>
                </div>
            </div>
            <div class="kpi-value">${leadsNovosHoje}</div>
            <div class="kpi-subtext"><i data-lucide="users" style="width:12px;height:12px;color:var(--blue-primary);"></i> ${totalLeadsAtivos} ativas no CRM</div>
            <div class="kpi-balloon" style="display: none;">
                <div class="kpi-balloon-header">
                    <i data-lucide="calculator" style="width:13px;height:13px;"></i> Resumo do Cálculo
                </div>
                <div class="kpi-balloon-body">
                    Quantidade de <strong>novas oportunidades e contatos</strong> cadastrados hoje no CRM.
                </div>
            </div>
        </div>

        <div class="kpi-card ${clientesAguardando > 0 ? 'red' : 'green'}">
            <div class="kpi-header">
                <span class="kpi-title">Aguardando Resposta</span>
                <div class="kpi-icon kpi-icon-clickable" onclick="toggleKpiBalloon(this, event)" title="Clique para ver a fórmula de cálculo">
                    <i data-lucide="message-square"></i>
                </div>
            </div>
            <div class="kpi-value" style="${clientesAguardando > 0 ? 'color: var(--red-alert);' : ''}">${clientesAguardando}</div>
            <div class="kpi-subtext"><i data-lucide="clock" style="width:12px;height:12px;"></i> Requer ação imediata</div>
            <div class="kpi-balloon" style="display: none;">
                <div class="kpi-balloon-header">
                    <i data-lucide="calculator" style="width:13px;height:13px;"></i> Resumo do Cálculo
                </div>
                <div class="kpi-balloon-body">
                    Número de leads com status <strong>"novo lead"</strong> ou <strong>"sem resposta"</strong> pendentes de retorno.
                </div>
            </div>
        </div>

        <div class="kpi-card yellow">
            <div class="kpi-header">
                <span class="kpi-title">Valor do Estoque</span>
                <div class="kpi-icon kpi-icon-clickable" onclick="toggleKpiBalloon(this, event)" title="Clique para ver a fórmula de cálculo">
                    <i data-lucide="package"></i>
                </div>
            </div>
            <div class="kpi-value">${formatCurrency(valorEstoque)}</div>
            <div class="kpi-subtext"><i data-lucide="car" style="width:12px;height:12px;"></i> ${qtdDisponiveis} carro(s) no pátio</div>
            <div class="kpi-balloon" style="display: none;">
                <div class="kpi-balloon-header">
                    <i data-lucide="calculator" style="width:13px;height:13px;"></i> Resumo do Cálculo
                </div>
                <div class="kpi-balloon-body">
                    Soma do <strong>Preço de Venda cadastrado</strong> de todos os veículos atualmente disponíveis no pátio.
                </div>
            </div>
        </div>
    `;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Dismissal state helper functions for action cards
export function getDismissedActions() {
    try {
        return JSON.parse(localStorage.getItem("autodrive_dismissed_actions") || "{}");
    } catch (e) {
        return {};
    }
}

export function isActionDismissed(taskId) {
    const dismissedMap = getDismissedActions();
    const item = dismissedMap[taskId];
    if (!item) return false;
    if (item.mode === 'never') return true;
    if (item.mode === 'later') {
        if (item.until && Date.now() < item.until) {
            return true;
        }
    }
    return false;
}

export function dismissActionTask(taskId, mode) {
    const dismissedMap = getDismissedActions();
    if (mode === 'later') {
        // Remind me later -> Snooze for 24 hours
        dismissedMap[taskId] = {
            mode: 'later',
            until: Date.now() + (24 * 60 * 60 * 1000)
        };
    } else if (mode === 'never') {
        // Don't remind me again -> Permanent
        dismissedMap[taskId] = {
            mode: 'never',
            until: null
        };
    }
    localStorage.setItem("autodrive_dismissed_actions", JSON.stringify(dismissedMap));
    renderActionCards();
}

export function toggleDismissOptions(taskId) {
    const panel = document.getElementById(`dismiss-panel-${taskId}`);
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
}

export function restoreDismissedActions() {
    localStorage.removeItem("autodrive_dismissed_actions");
    renderActionCards();
}

// 4. O QUE PRECISO FAZER AGORA? (CARDS DINÂMICOS DE AÇÕES PRIORIZADAS)
export function renderActionCards() {
    const container = document.getElementById("action-cards-container");
    const countBadge = document.getElementById("priority-task-count");
    if (!container) return;

    const actionTasks = [];

    // Category 1: Leads awaiting response
    state.leads.forEach(l => {
        if (l.status === 'sem resposta' || l.status === 'novo lead') {
            const taskId = `lead-${l.id}`;
            if (!isActionDismissed(taskId)) {
                const car = state.estoque.find(c => c.id === l.interestCarId);
                const carName = car ? car.model : 'Veículo no pátio';
                actionTasks.push({
                    taskId,
                    priorityWeight: 1, // High
                    priorityClass: 'priority-high',
                    priorityLabel: 'Alta Prioridade',
                    badgeClass: 'priority-red',
                    categoryIcon: 'message-square',
                    categoryName: 'Lead sem resposta',
                    title: l.name,
                    description: `Cliente interessado no <strong>${carName}</strong> via <em>${l.origin}</em>. Último contato há ${l.lastContactDays || 1} dia(s).`,
                    timeText: `Aguardando há ${l.lastContactDays || 1}d`,
                    btnText: 'Responder WhatsApp',
                    actionFn: `openLeadDetailModal(${l.id})`
                });
            }
        }
    });

    // Category 2: Cars in stock > 30 days
    state.estoque.forEach(c => {
        if (c.status !== 'vendido') {
            const days = calcDaysInStock(c.purchaseDate);
            if (days >= 30) {
                const taskId = `stock-days-${c.id}`;
                if (!isActionDismissed(taskId)) {
                    actionTasks.push({
                        taskId,
                        priorityWeight: 2, // High/Medium
                        priorityClass: days >= 60 ? 'priority-high' : 'priority-medium',
                        priorityLabel: days >= 60 ? 'Giro Crítico (+60d)' : 'Atenção de Giro',
                        badgeClass: days >= 60 ? 'priority-red' : 'priority-yellow',
                        categoryIcon: 'alert-triangle',
                        categoryName: 'Veículo em pátio',
                        title: c.model,
                        description: `Veículo parado há <strong>${days} dias</strong>. Valor de venda: ${formatCurrency(c.sellPrice)}. Considere reajuste ou repasse.`,
                        timeText: `${days} dias no pátio`,
                        btnText: 'Revisar Anúncio',
                        actionFn: `openCarDetails(${c.id})`
                    });
                }
            }
        }
    });

    // Category 3: Cars without photos
    state.estoque.forEach(c => {
        if (c.status !== 'vendido' && !c.image_url) {
            const taskId = `stock-photos-${c.id}`;
            if (!isActionDismissed(taskId)) {
                actionTasks.push({
                    taskId,
                    priorityWeight: 3, // Medium
                    priorityClass: 'priority-medium',
                    priorityLabel: 'Falta Mídia',
                    badgeClass: 'priority-yellow',
                    categoryIcon: 'camera-off',
                    categoryName: 'Anúncio Incompleto',
                    title: c.model,
                    description: `Veículo cadastrado no estoque sem fotos. Fotos aumentam drasticamente o interesse no CRM.`,
                    timeText: `Sem fotos`,
                    btnText: 'Atualizar Fotos',
                    actionFn: `openCarDetails(${c.id})`
                });
            }
        }
    });

    // Category 4: Reserved cars
    state.estoque.forEach(c => {
        if (c.status === 'reservado') {
            const taskId = `stock-reserved-${c.id}`;
            if (!isActionDismissed(taskId)) {
                actionTasks.push({
                    taskId,
                    priorityWeight: 4, // Normal/Positive
                    priorityClass: 'priority-normal',
                    priorityLabel: 'Reserva Ativa',
                    badgeClass: 'priority-green',
                    categoryIcon: 'bookmark-check',
                    categoryName: 'Veículo Reservado',
                    title: c.model,
                    description: `Reserva realizada. Finalize os documentos, emita a venda ou recibo em PDF.`,
                    timeText: `Aguardando Venda`,
                    btnText: 'Concluir Venda',
                    actionFn: `openCarDetailsForSale(${c.id})`
                });
            }
        }
    });

    // Category 5: Despesas operacionais ativas
    if (state.despesas.length > 0) {
        const topDespesa = state.despesas[state.despesas.length - 1];
        const taskId = `expense-${topDespesa.id}`;
        if (!isActionDismissed(taskId)) {
            actionTasks.push({
                taskId,
                priorityWeight: 5,
                priorityClass: 'priority-normal',
                priorityLabel: 'Conferência',
                badgeClass: 'priority-blue',
                categoryIcon: 'receipt',
                categoryName: 'Despesa Registrada',
                title: topDespesa.desc,
                description: `Valor: <strong>${formatCurrency(topDespesa.val)}</strong> • Categoria: ${topDespesa.category}. Mantenha o caixa sob controle.`,
                timeText: `${topDespesa.date}`,
                btnText: 'Ver Financeiro',
                actionFn: `switchTab('financeiro')`
            });
        }
    }

    // Sort tasks by priorityWeight (1 highest -> 5 lowest)
    actionTasks.sort((a, b) => a.priorityWeight - b.priorityWeight);

    const dismissedMap = getDismissedActions();
    const hasDismissed = Object.keys(dismissedMap).length > 0;

    if (countBadge) {
        countBadge.innerHTML = `
            <span>${actionTasks.length} pendência(s)</span>
            ${hasDismissed ? `<button onclick="window.restoreDismissedActions()" title="Restaurar notificações ocultas" style="margin-left:8px; border:none; background:none; color:var(--blue-primary); cursor:pointer; font-size:11px; font-weight:600; text-decoration:underline; vertical-align:middle;">Restaurar ocultas</button>` : ''}
        `;
    }

    if (actionTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-action-state" style="grid-column: 1 / -1; padding:32px 16px; text-align:center;">
                <i data-lucide="check-circle" style="width:48px;height:48px;color:var(--green-profit);margin-bottom:12px;"></i>
                <h4 style="margin:0 0 6px 0; font-size:16px;">Tudo em dia na revenda!</h4>
                <p style="margin:0; color:var(--text-muted); font-size:13px;">Nenhuma pendência operacional ativa neste momento.</p>
                ${hasDismissed ? `<button class="btn btn-secondary btn-sm" onclick="window.restoreDismissedActions()" style="margin-top:14px;"><i data-lucide="rotate-ccw" style="width:13px;height:13px;margin-right:4px;"></i> Restaurar notificações ocultas</button>` : ''}
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    container.innerHTML = actionTasks.map(t => `
        <div class="action-card ${t.priorityClass}" id="action-card-${t.taskId}">
            <div class="action-card-header">
                <span class="action-category"><i data-lucide="${t.categoryIcon}" style="width:13px;height:13px;"></i> ${t.categoryName}</span>
                <div class="action-card-header-right">
                    <span class="priority-badge ${t.badgeClass}">${t.priorityLabel}</span>
                    <button class="action-dismiss-btn" onclick="window.toggleDismissOptions('${t.taskId}')" title="Opções de notificação">
                        <i data-lucide="bell-off" style="width:13px;height:13px;"></i>
                    </button>
                </div>
            </div>

            <div class="action-card-dismiss-panel" id="dismiss-panel-${t.taskId}" style="display:none;">
                <div class="action-card-dismiss-title">
                    <span>Configurar notificação</span>
                    <button class="action-dismiss-btn" onclick="window.toggleDismissOptions('${t.taskId}')"><i data-lucide="x" style="width:12px;height:12px;"></i></button>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:10px;">Como deseja gerenciar este lembrete?</div>
                <div class="action-card-dismiss-options">
                    <button class="btn btn-secondary btn-snooze-later" onclick="window.dismissActionTask('${t.taskId}', 'later')" title="Oculta temporariamente por 24 horas">
                        <i data-lucide="clock" style="width:12px;height:12px;"></i> Me lembre depois
                    </button>
                    <button class="btn btn-secondary btn-snooze-never" onclick="window.dismissActionTask('${t.taskId}', 'never')" title="Oculta permanentemente este item">
                        <i data-lucide="bell-off" style="width:12px;height:12px;"></i> Não me lembre mais
                    </button>
                </div>
            </div>

            <div class="action-card-body">
                <h4>${t.title}</h4>
                <p>${t.description}</p>
            </div>
            <div class="action-card-footer">
                <span class="action-time"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${t.timeText}</span>
                <button class="btn btn-primary btn-sm" onclick="${t.actionFn}">${t.btnText}</button>
            </div>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// 5. AGENDA DO DIA
export function renderAgendaDay() {
    const container = document.getElementById("agenda-day-container");
    if (!container) return;

    const agendaItems = state.agenda || [];

    if (agendaItems.length === 0) {
        container.innerHTML = `
            <div style="padding:24px; text-align:center; color:var(--text-muted); font-size:13px;">
                <i data-lucide="calendar-off" style="width:32px;height:32px;margin-bottom:8px;opacity:0.6;"></i>
                <p style="margin:0;">Nenhum compromisso agendado para hoje.</p>
            </div>
        `;
        return;
    }

    const catBadgeMap = {
        'visitas': { label: 'Test Drive / Visita', color: 'blue' },
        'entregas': { label: 'Entrega de Chaves', color: 'green' },
        'revisao': { label: 'Oficina / Preparação', color: 'yellow' },
        'documentos': { label: 'Cartório / Vistoria', color: 'purple' }
    };

    container.innerHTML = agendaItems.slice(0, 4).map(item => {
        const catInfo = catBadgeMap[item.category] || { label: 'Compromisso', color: 'blue' };
        const car = state.estoque.find(c => c.id === item.carId);
        const carText = car ? ` • ${car.model}` : '';

        return `
            <div class="agenda-item-row">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span class="agenda-time-badge">${item.time || 'Horário'}</span>
                    <div>
                        <div style="font-weight:600; color:var(--text-light); font-size:13px;">${item.title}${carText}</div>
                        <div style="font-size:12px; color:var(--text-muted);">${item.desc || 'Sem observações'}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span class="agenda-category-badge badge-${catInfo.color}">${catInfo.label}</span>
                    <button class="btn btn-secondary btn-sm" onclick="switchTab('agenda')" title="Ver na Agenda">
                        <i data-lucide="chevron-right" style="width:14px;height:14px;"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 6. OBJETIVOS DO DIA (CHECKLIST COM BARRA DE PROGRESSO & PERSISTÊNCIA)
export function renderObjectivesChecklist() {
    const container = document.getElementById("objectives-checklist-container");
    const progressText = document.getElementById("objectives-progress-text");
    const progressBar = document.getElementById("objectives-progress-bar");
    if (!container) return;

    // Retrieve saved checklist states from localStorage
    let savedState = [];
    try {
        const stored = localStorage.getItem("autoagent_daily_objectives");
        if (stored) savedState = JSON.parse(stored);
    } catch (e) {
        savedState = [];
    }

    const items = DEFAULT_OBJECTIVES.map((obj, idx) => {
        const isChecked = savedState.hasOwnProperty(idx) ? savedState[idx] : obj.defaultChecked;
        return { text: obj.text, checked: isChecked };
    });

    const checkedCount = items.filter(i => i.checked).length;
    const totalCount = items.length;
    const percent = Math.round((checkedCount / totalCount) * 100);

    if (progressText) {
        progressText.innerText = `${checkedCount} de ${totalCount} (${percent}%)`;
    }
    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }

    container.innerHTML = items.map((item, idx) => `
        <div class="objective-item ${item.checked ? 'checked' : ''}" onclick="window.toggleObjectiveItem(${idx})">
            <div class="objective-checkbox ${item.checked ? 'active' : ''}">
                ${item.checked ? '<i data-lucide="check" style="width:12px;height:12px;"></i>' : ''}
            </div>
            <span class="objective-text">${item.text}</span>
        </div>
    `).join('');

    window._objectiveItemsState = items.map(i => i.checked);
}

window.toggleObjectiveItem = function(index) {
    if (!window._objectiveItemsState) window._objectiveItemsState = [];
    window._objectiveItemsState[index] = !window._objectiveItemsState[index];
    try {
        localStorage.setItem("autoagent_daily_objectives", JSON.stringify(window._objectiveItemsState));
    } catch (e) {}
    renderObjectivesChecklist();
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
};

// Backward-compatibility exports so existing calls from other modules don't break
export function calculateKPIs() {
    renderDashboard();
}

export function calculateCRMStats() {
    const totalLeads = state.leads.length;
    const activeLeads = state.leads.filter(l => l.status !== 'fechado' && l.status !== 'perdido').length;
    const semResposta = state.leads.filter(l => l.status === 'sem resposta').length;
    const fechados = state.leads.filter(l => l.status === 'fechado').length;
    const conversao = totalLeads > 0 ? ((fechados / totalLeads) * 100).toFixed(1) + '%' : '0%';

    const elTotal = document.getElementById("crm-total-leads");
    const elAtivos = document.getElementById("crm-ativos-leads");
    const elSemResp = document.getElementById("crm-sem-resposta-leads");
    const elConv = document.getElementById("crm-conversao-leads");

    if (elTotal) elTotal.innerText = totalLeads;
    if (elAtivos) elAtivos.innerText = activeLeads;
    if (elSemResp) elSemResp.innerText = semResposta;
    if (elConv) elConv.innerText = conversao;
}

export function initCharts() {
    renderDashboard();
}
