// ==========================================================================
// AUTO DRIVE CRM - CRM LEADS FUNNEL FEATURE
// ==========================================================================

import { state } from '../../services/state.js';
import { formatCurrency, parseCurrencyBR, parseId } from '../../utils/helpers.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';

export let leadViewMode = 'kanban';
export let draggedLeadId = null;
export let currentTimelineLeadId = null;

// Select visual view mode: Kanban Funnel vs Standard Table List
export function setLeadViewMode(mode) {
    leadViewMode = mode;
    const kanbanView = document.getElementById("leads-kanban-view");
    const listView = document.getElementById("leads-list-view");
    const kanbanBtn = document.getElementById("toggle-leads-kanban");
    const listBtn = document.getElementById("toggle-leads-lista");

    if (kanbanView) kanbanView.style.display = mode === 'kanban' ? 'grid' : 'none';
    if (listView) listView.style.display = mode === 'lista' ? 'block' : 'none';
    if (kanbanBtn) kanbanBtn.classList.toggle('active', mode === 'kanban');
    if (listBtn) listBtn.classList.toggle('active', mode === 'lista');

    renderLeads();
}

export function setLeadView(mode) {
    setLeadViewMode(mode);
}

// Global update function for CRM
export function renderLeads() {
    const searchVal = document.getElementById("search-leads")?.value || '';
    if (leadViewMode === 'kanban') {
        renderKanban(searchVal);
    } else {
        renderLeadsList(searchVal);
    }
}

// Renders visual Kanban column cards
export function renderKanban(searchQuery = '') {
    const columns = ['novo lead', 'contato realizado', 'negociação', 'sem resposta', 'fechado', 'perdido'];
    const colCounts = { 'novo lead': 0, 'contato realizado': 0, 'negociação': 0, 'sem resposta': 0, 'fechado': 0, 'perdido': 0 };
    const statusToIdMap = {
        'novo lead': 'novo',
        'contato realizado': 'contato',
        'negociação': 'negociacao',
        'sem resposta': 'sem-resposta',
        'fechado': 'fechado',
        'perdido': 'perdido'
    };

    // Clear all column buckets
    columns.forEach(col => {
        const idSuffix = statusToIdMap[col] || col;
        const container = document.getElementById(`cards-${idSuffix}`);
        if (container) container.innerHTML = "";
    });

    let filteredLeads = state.leads.filter(lead => {
        const query = searchQuery.toLowerCase();
        return lead.name.toLowerCase().includes(query) || (lead.phone && lead.phone.includes(query));
    });

    filteredLeads.forEach(lead => {
        colCounts[lead.status]++;
        
        const car = state.estoque.find(c => c.id === lead.interestCarId);
        const carModel = car ? car.model : "Sem Carro Especificado";
        const carPriceHtml = car ? `<span style="font-weight:700; color:var(--blue-primary); font-size:11px; margin-left:6px;">${formatCurrency(car.sellPrice)}</span>` : '';
        const phoneClean = lead.phone ? lead.phone.replace(/\D/g, '') : '';

        const card = document.createElement("div");
        card.className = "lead-card";
        card.draggable = true;
        card.ondragstart = (e) => dragLead(e, lead.id);

        let leftBorderColor = 'var(--text-muted)';
        if (lead.status === 'novo lead') leftBorderColor = 'var(--blue-primary)';
        else if (lead.status === 'contato realizado') leftBorderColor = 'var(--purple-purple)';
        else if (lead.status === 'negociação') leftBorderColor = 'var(--yellow-warning)';
        else if (lead.status === 'sem resposta') leftBorderColor = 'var(--red-alert)';
        else if (lead.status === 'fechado') leftBorderColor = 'var(--green-profit)';
        else if (lead.status === 'perdido') leftBorderColor = 'var(--text-muted)';

        card.style.borderLeft = `4px solid ${leftBorderColor}`;
        card.style.paddingLeft = '10px';

        const isNegligenciado = lead.lastContactDays > 10 && lead.status !== 'fechado' && lead.status !== 'perdido';
        const contactClass = isNegligenciado ? "lead-last-contact forgotten" : "lead-last-contact";
        const contactIcon = isNegligenciado ? "alert-triangle" : "clock";
        const contactLabel = isNegligenciado ? `Esquecido há ${lead.lastContactDays}d` : `Contato há ${lead.lastContactDays}d`;

        card.innerHTML = `
            <div class="lead-top" style="display:flex; justify-content:space-between; align-items:center;">
                <span class="lead-name" style="font-weight:700; font-size:13px; color:var(--text-light);">${lead.name}</span>
                <span class="lead-origin">${lead.origin}</span>
            </div>
            
            <div style="display:flex; align-items:center; gap:6px; font-size:11px; margin-top:2px;">
                <a href="https://wa.me/55${phoneClean}" target="_blank" style="color: var(--text-muted); text-decoration:none; display:flex; align-items:center; gap:4px;" title="Conversar no WhatsApp">
                    <i data-lucide="phone" style="width:12px; height:12px; color:var(--blue-primary);"></i>
                    <span>${lead.phone}</span>
                </a>
            </div>

            <div style="display:flex; align-items:center; margin-top:4px;">
                <span class="badge convencional" style="display:inline-flex; align-items:center; gap:4px; font-size:10px; padding: 1px 6px;">
                    <i data-lucide="car" style="width:10px; height:10px;"></i>
                    ${carModel}
                </span>
                ${carPriceHtml}
            </div>

            <div class="lead-next-action" style="font-size:11px; color:var(--text-muted); background:rgba(255,255,255,0.02); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:6px 8px; margin-top:6px; display:flex; align-items:start; gap:6px;">
                <i data-lucide="calendar" style="width:12px; height:12px; color:var(--yellow-warning); margin-top:2px; flex-shrink:0;"></i>
                <span style="line-height:1.3;">${lead.nextAction || 'Sem ação definida'}</span>
            </div>

            <div class="lead-divider" style="margin-top:8px;"></div>
            
            <div class="lead-footer" style="margin-top:2px;">
                <span class="${contactClass}"><i data-lucide="${contactIcon}"></i>${contactLabel}</span>
                <div style="display:flex; gap:4px;">
                    <button class="lead-actions-btn" onclick="window.openEditLeadModal(${lead.id})" title="Editar"><i data-lucide="pencil"></i></button>
                    <button class="lead-actions-btn" onclick="window.openTimelineModal(${lead.id})" title="Histórico / Timeline"><i data-lucide="message-square-plus"></i></button>
                    <button class="lead-actions-btn" style="color:var(--red-alert)" onclick="window.deleteLeadConfirm(${lead.id})" title="Excluir"><i data-lucide="trash-2"></i></button>
                </div>
            </div>`;
        const idSuffix = statusToIdMap[lead.status] || lead.status;
        const colId = `cards-${idSuffix}`;
        const container = document.getElementById(colId);
        if (container) container.appendChild(card);
    });

    columns.forEach(col => {
        const idSuffix = statusToIdMap[col] || col;
        const container = document.getElementById(`cards-${idSuffix}`);
        if (container && container.children.length === 0) {
            container.innerHTML = `<div class="empty-state-container" style="padding: 20px 10px;">
                <i data-lucide="inbox" style="width:24px;height:24px;"></i>
                <p style="font-size:11px; margin-top:8px;">Vazio</p>
            </div>`;
        }
        const label = document.getElementById(`count-${idSuffix}`);
        if (label) label.innerText = colCounts[col];
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Drag action setter
export function dragLead(event, id) {
    draggedLeadId = id;
    if (event.dataTransfer) event.dataTransfer.setData("text", id);
}

export function allowDrop(event) {
    event.preventDefault();
}

export function allowLeadDrop(event) {
    event.preventDefault();
}

// Drop and status re-assign handler
export async function dropLead(event, newStatus) {
    if (event) event.preventDefault();
    const id = draggedLeadId;
    if (!id) return;

    const lead = state.leads.find(l => l.id === id);
    if (lead && lead.status !== newStatus) {
        if (state.isCloudActive) {
            try {
                await state.supabaseClient.from('leads').update({ status: newStatus, last_contact_days: 0 }).eq('id', id);
                await state.supabaseClient.from('interactions').insert({ lead_id: id, date: 'Hoje', text: `Lead movido para: ${newStatus.toUpperCase()}` });
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            }
        } else {
            lead.status = newStatus;
            lead.lastContactDays = 0;
            lead.interactions.push({ date: "Hoje", text: `Lead movido para: ${newStatus.toUpperCase()}` });
            persistLocalData();
        }

        // Trigger sell checkout window if lead is closed
        if (newStatus === 'fechado') {
            window.openSellCarModal(lead.interestCarId, lead.name);
        } else {
            window.updateApplicationState();
        }
    }
    draggedLeadId = null;
}

// Renders tabular lists of leads
export function renderLeadsList(searchQuery = '') {
    const listBody = document.getElementById("leads-list-body");
    if (!listBody) return;
    listBody.innerHTML = "";

    let filteredLeads = state.leads.filter(l => {
        const q = searchQuery.toLowerCase();
        return l.name.toLowerCase().includes(q) || (l.phone && l.phone.includes(q));
    });

    filteredLeads.forEach(lead => {
        const car = state.estoque.find(c => c.id === lead.interestCarId);
        const carModel = car ? car.model : "Sem Carro";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${lead.name}</strong></td>
            <td>${lead.phone}</td>
            <td><i data-lucide="car" style="width:14px;vertical-align:middle;margin-right:4px;"></i>${carModel}</td>
            <td><span class="badge convencional" style="font-size:10px">${lead.origin}</span></td>
            <td><span class="badge ${lead.status}">${lead.status}</span></td>
            <td>${lead.lastContactDays} dias atrás</td>
            <td style="color: var(--text-muted); font-style:italic">${lead.nextAction || 'Sem ação'}</td>
            <td style="text-align: center;">
                <div style="display:flex;gap:6px;justify-content:center;">
                    <button class="btn btn-secondary" style="padding:4px 8px;font-size:11px" onclick="window.openEditLeadModal(${lead.id})"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>
                    <button class="btn btn-secondary" style="padding:4px 8px;font-size:11px" onclick="window.openTimelineModal(${lead.id})"><i data-lucide="clock" style="width:12px;height:12px;"></i></button>
                    <button class="btn" style="padding:4px 8px;font-size:11px;background-color:rgba(239,68,68,0.15);color:var(--red-alert);border:1px solid rgba(239,68,68,0.2)" onclick="window.deleteLeadConfirm(${lead.id})"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
                </div>
            </td>`;
        listBody.appendChild(tr);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Add CRM lead actions
export function openAddLeadModal() {
    window.populateCarSelects('lead-interest');
    document.getElementById("form-lead").reset();
    document.getElementById("modal-lead").classList.add("active");
}

export function closeAddLeadModal() {
    document.getElementById("modal-lead").classList.remove("active");
}

export async function saveNewLead(event) {
    event.preventDefault();
    const name = document.getElementById("lead-name").value.trim();
    const phone = document.getElementById("lead-phone").value.trim();
    const interestCarId = parseId(document.getElementById("lead-interest").value) || null;
    const origin = document.getElementById("lead-origin").value;
    const status = document.getElementById("lead-status").value;
    const nextAction = document.getElementById("lead-next-action").value.trim();

    const leadData = {
        name, phone,
        interest_car_id: interestCarId,
        origin, status,
        next_action: nextAction || null,
        last_contact_days: 0
    };

    if (state.isCloudActive) {
        try {
            const { data, error } = await state.supabaseClient.from('leads').insert([leadData]).select();
            if (error) throw error;
            if (data && data[0]) {
                const leadId = data[0].id;
                await state.supabaseClient.from('interactions').insert([{ lead_id: leadId, date: 'Hoje', text: 'Lead cadastrado no sistema.' }]);
            }
            await fetchCloudData();
        } catch (e) {
            console.error(e);
            alert("Erro ao cadastrar lead na nuvem.");
        }
    } else {
        const newId = state.leads.length > 0 ? Math.max(...state.leads.map(l => l.id)) + 1 : 1;
        state.leads.push({
            id: newId, name, phone, interestCarId, origin, status, lastContactDays: 0,
            nextAction: nextAction || 'Primeiro contato',
            interactions: [{ date: 'Hoje', text: 'Lead cadastrado no sistema.' }]
        });
        persistLocalData();
    }

    closeAddLeadModal();
    window.updateApplicationState();
}

// Edit lead actions
export function openEditLeadModal(leadId) {
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;
    window.populateCarSelects('edit-lead-interest');
    document.getElementById("edit-lead-id").value = lead.id;
    document.getElementById("edit-lead-name").value = lead.name;
    document.getElementById("edit-lead-phone").value = lead.phone;
    document.getElementById("edit-lead-interest").value = lead.interestCarId || "";
    document.getElementById("edit-lead-origin").value = lead.origin;
    document.getElementById("edit-lead-status").value = lead.status;
    document.getElementById("edit-lead-next-action").value = lead.nextAction || "";
    document.getElementById("modal-edit-lead").classList.add("active");
}

export function closeEditLeadModal() {
    document.getElementById("modal-edit-lead").classList.remove("active");
}

export async function saveEditLead(event) {
    event.preventDefault();
    const leadId = parseId(document.getElementById("edit-lead-id").value);
    const name = document.getElementById("edit-lead-name").value.trim();
    const phone = document.getElementById("edit-lead-phone").value.trim();
    const interestCarId = parseId(document.getElementById("edit-lead-interest").value) || null;
    const origin = document.getElementById("edit-lead-origin").value;
    const status = document.getElementById("edit-lead-status").value;
    const nextAction = document.getElementById("edit-lead-next-action").value.trim();

    const leadData = {
        name, phone,
        interest_car_id: interestCarId,
        origin, status,
        next_action: nextAction || null
    };

    if (state.isCloudActive) {
        try {
            const { error } = await state.supabaseClient.from('leads').update(leadData).eq('id', leadId);
            if (error) throw error;
            await fetchCloudData();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar dados.");
        }
    } else {
        const leadIdx = state.leads.findIndex(l => l.id === leadId);
        if (leadIdx >= 0) {
            state.leads[leadIdx] = {
                ...state.leads[leadIdx],
                name, phone, interestCarId, origin, status, nextAction
            };
        }
        persistLocalData();
    }

    closeEditLeadModal();
    window.updateApplicationState();
}

// Delete CRM lead
export async function deleteLeadConfirm(id) {
    const doDelete = async () => {
        if (state.isCloudActive) {
            try {
                const { error } = await state.supabaseClient.from('leads').delete().eq('id', id);
                if (error) throw error;
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            }
        } else {
            state.leads = state.leads.filter(l => String(l.id) !== String(id));
            persistLocalData();
        }

        window.updateApplicationState();
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Lead", "Excluir este lead permanentemente?", doDelete, "Excluir");
    } else if (confirm("Excluir este lead permanentemente?")) {
        await doDelete();
    }
}

// --------------------------------------------------------------------------
// HISTÓRICO DE TIMELINE (CRM INTERACTIONS)
// --------------------------------------------------------------------------
export function openTimelineModal(leadId) {
    currentTimelineLeadId = leadId;
    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;

    const clientNameEl = document.getElementById("timeline-client-name");
    if (clientNameEl) {
        clientNameEl.innerText = `Histórico & Ações: ${lead.name}`;
    }

    const leadIdInput = document.getElementById("interaction-lead-id");
    if (leadIdInput) {
        leadIdInput.value = lead.id;
    }

    const nextInput = document.getElementById("interaction-next");
    if (nextInput) {
        nextInput.value = lead.nextAction || "";
    }

    const statusSelect = document.getElementById("interaction-status");
    if (statusSelect) {
        statusSelect.value = "no-change";
    }

    const modal = document.getElementById("modal-lead-timeline");
    if (modal) {
        modal.classList.add("active");
    }

    renderInteractions(lead);
}

export function closeTimelineModal() {
    const modal = document.getElementById("modal-lead-timeline");
    if (modal) {
        modal.classList.remove("active");
    }
    currentTimelineLeadId = null;
}

export function renderInteractions(lead) {
    const list = document.getElementById("timeline-events-container");
    if (!list) return;
    list.innerHTML = "";

    if (!lead.interactions || lead.interactions.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--text-muted);">
                <i data-lucide="message-square" style="width:32px; height:32px; margin-bottom:8px; opacity:0.5;"></i>
                <div style="font-size:12px;">Nenhum contato ou interação registrada.</div>
            </div>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    lead.interactions.forEach((int, idx) => {
        const item = document.createElement("div");
        item.className = "timeline-item";
        item.innerHTML = `
            <div class="timeline-badge"><i data-lucide="message-square" style="width:12px; height:12px;"></i></div>
            <div class="timeline-card">
                <div class="timeline-meta" style="display:flex; justify-content:space-between; align-items:center;">
                    <strong>${int.date}</strong>
                    <button class="btn btn-icon btn-secondary btn-sm" onclick="window.deleteInteractionConfirm(${idx})" style="padding:4px; height:auto; color:var(--red-alert); border-color:rgba(239,68,68,0.15);"><i data-lucide="trash-2" style="width:10px; height:10px;"></i></button>
                </div>
                <div class="timeline-content">${int.text}</div>
            </div>
        `;
        list.appendChild(item);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

export async function addLeadInteraction(event) {
    event.preventDefault();
    const leadId = parseId(document.getElementById("interaction-lead-id")?.value || currentTimelineLeadId);
    if (!leadId) return;

    const lead = state.leads.find(l => l.id === leadId);
    if (!lead) return;

    const textInput = document.getElementById("interaction-text");
    const nextInput = document.getElementById("interaction-next");
    const statusSelect = document.getElementById("interaction-status");

    const text = textInput ? textInput.value.trim() : "";
    const nextAction = nextInput ? nextInput.value.trim() : "";
    const statusSel = statusSelect ? statusSelect.value : "no-change";

    if (!text) return;

    const dateStr = new Date().toLocaleDateString('pt-BR');

    if (state.isCloudActive) {
        try {
            // Update fields
            const updateFields = { last_contact_days: 0 };
            if (nextAction) updateFields.next_action = nextAction;
            if (statusSel !== 'no-change') updateFields.status = statusSel;

            await state.supabaseClient.from('leads').update(updateFields).eq('id', leadId);

            // Insert core interaction text
            await state.supabaseClient.from('interactions').insert([{
                lead_id: leadId,
                date: dateStr,
                text: text
            }]);

            // Insert status change interaction if modified
            if (statusSel !== 'no-change') {
                await state.supabaseClient.from('interactions').insert([{
                    lead_id: leadId,
                    date: dateStr,
                    text: `Lead movido para: ${statusSel.toUpperCase()}`
                }]);
            }

            await fetchCloudData();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar interação.");
            return;
        }
    } else {
        lead.lastContactDays = 0;
        if (nextAction) lead.nextAction = nextAction;
        if (statusSel !== 'no-change') {
            lead.status = statusSel;
            lead.interactions.push({
                date: dateStr,
                text: `Lead movido para: ${statusSel.toUpperCase()}`
            });
        }
        lead.interactions.push({ date: dateStr, text: text });
        persistLocalData();
    }

    if (textInput) textInput.value = "";

    window.updateApplicationState();

    if (statusSel === 'fechado') {
        closeTimelineModal();
        window.openSellCarModal(lead.interestCarId, lead.name);
    } else {
        const updatedLead = state.leads.find(l => l.id === leadId);
        if (updatedLead) renderInteractions(updatedLead);
    }
}

export async function deleteInteractionConfirm(idx) {
    const doDelete = async () => {
        const lead = state.leads.find(l => String(l.id) === String(currentTimelineLeadId));
        if (!lead) return;

        if (state.isCloudActive) {
            try {
                // Retrieve actual interactions and remove corresponding item
                const { data, error } = await state.supabaseClient.from('interactions').select('id').eq('lead_id', currentTimelineLeadId).order('id', { ascending: true });
                if (!error && data && data[idx]) {
                    const intId = data[idx].id;
                    const { error: delErr } = await state.supabaseClient.from('interactions').delete().eq('id', intId);
                    if (delErr) throw delErr;
                }
                await fetchCloudData();
                const updatedLead = state.leads.find(l => String(l.id) === String(currentTimelineLeadId));
                renderInteractions(updatedLead);
            } catch (e) {
                console.error(e);
            }
        } else {
            if (lead.interactions) {
                lead.interactions.splice(idx, 1);
                persistLocalData();
                renderInteractions(lead);
            }
        }
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Anotação", "Excluir esta anotação permanentemente?", doDelete, "Excluir");
    } else if (confirm("Excluir esta anotação permanentemente?")) {
        await doDelete();
    }
}

export function filterKanban() {
    renderLeads();
}

// Populate dropdowns with current stock vehicles
export function populateCarSelects(targetId = null) {
    const selectsToPopulate = targetId 
        ? [document.getElementById(targetId)] 
        : [
            document.getElementById('lead-interest'),
            document.getElementById('edit-lead-interest'),
            document.getElementById('exp-car'),
            document.getElementById('edit-exp-car'),
            document.getElementById('age-car'),
            document.getElementById('edit-age-car')
        ];

    const cars = state.estoque || [];

    selectsToPopulate.forEach(select => {
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Selecione um Veículo --</option>';

        cars.forEach(car => {
            const option = document.createElement('option');
            option.value = car.id;
            const plateStr = car.plate ? ` (${car.plate})` : '';
            option.textContent = `${car.model} - ${car.year}${plateStr}`;
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    });
}

export { openTimelineModal as openLeadDetailModal };
export { closeTimelineModal as closeLeadDetailModal };
export { addLeadInteraction as saveNewInteraction };

