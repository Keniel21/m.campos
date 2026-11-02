// ==========================================================================
// AUTO DRIVE CRM - CUSTOMER PROFILES DATABASE FEATURE
// ==========================================================================

import { state } from '../../services/state.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';
import { parseId } from '../../utils/helpers.js';

export let clientesSortCol = 'name';
export let clientesSortDirection = 1; // 1 = ASC, -1 = DESC

export function sortClientesTable(col) {
    if (clientesSortCol === col) {
        clientesSortDirection *= -1;
    } else {
        clientesSortCol = col;
        clientesSortDirection = 1;
    }
    renderClientesTable();
}

export function calculateClientesKPIs() {
    const elTotal = document.getElementById('kpi-total-clientes');
    const elVol = document.getElementById('kpi-maior-comprador-vol');
    const elVolVal = document.getElementById('kpi-maior-comprador-vol-val');
    const elQtd = document.getElementById('kpi-maior-comprador-qtd');
    const elQtdVal = document.getElementById('kpi-maior-comprador-qtd-val');

    if (!elTotal) return;

    elTotal.innerText = state.clientes.length;

    const stats = {};
    state.vendas.forEach(v => {
        if (!v.client) return;
        const c = v.client.trim();
        if (!stats[c]) stats[c] = { count: 0, total: 0 };
        stats[c].count += 1;
        stats[c].total += v.sellPrice || 0;
    });

    let topVolName = '-';
    let topVolVal = 0;
    let topQtdName = '-';
    let topQtdVal = 0;

    for (const [c, s] of Object.entries(stats)) {
        if (s.total > topVolVal) { topVolVal = s.total; topVolName = c; }
        if (s.count > topQtdVal) { topQtdVal = s.count; topQtdName = c; }
    }

    if (elVol) elVol.innerText = topVolName;
    if (elVolVal) elVolVal.innerText = topVolVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (elQtd) elQtd.innerText = topQtdName;
    if (elQtdVal) elQtdVal.innerText = topQtdVal + (topQtdVal === 1 ? " carro" : " carros");
}

export function renderClientesTable() {
    const tbody = document.getElementById('clientes-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const searchVal = (document.getElementById('search-client')?.value || '').toLowerCase().trim();
    let filtered = state.clientes.filter(c => c.name.toLowerCase().includes(searchVal) || (c.document && c.document.toLowerCase().includes(searchVal)));

    if (clientesSortCol === 'name') {
        filtered.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (nameA < nameB) return -1 * clientesSortDirection;
            if (nameA > nameB) return 1 * clientesSortDirection;
            return 0;
        });
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <div class="empty-state-container" style="padding: 40px; text-align: center; width: 100%;">
                <i data-lucide="users" style="width:48px; height:48px; stroke-width:1.5; color:var(--text-muted); margin-bottom:12px;"></i>
                <h4 style="margin:0 0 6px 0; color:var(--text-light); font-size:15px;">Nenhum cliente encontrado</h4>
                <p style="margin:0; color:var(--text-muted); font-size:13px;">Tente ajustar sua busca ou cadastre um novo cliente.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    filtered.forEach(c => {
        const card = document.createElement('div');
        card.className = 'clientes-modern-row';
        const dataCad = c.createdAt ? new Date(c.createdAt).toLocaleDateString('pt-BR') : 'Local';
        card.innerHTML = `
            <div style="font-weight: 600; color: var(--text-light);">${c.name}</div>
            <div style="color: var(--text-muted); font-size: 13px;">${c.document || '-'}</div>
            <div style="color: var(--text-light); font-size: 13px;">${c.phone || '-'}</div>
            <div style="color: var(--text-light); font-size: 13px; word-break: break-all;">${c.email || '-'}</div>
            <div style="color: var(--text-muted); font-size: 13px;">${dataCad}</div>
            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                <button class="btn btn-secondary" style="padding:6px; border-radius:8px;" onclick="window.openEditClientModal(${c.id})" title="Editar"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                <button class="btn" style="padding:6px; border-radius:8px; background-color:rgba(239,68,68,0.12); color:var(--red-alert); border:1px solid rgba(239,68,68,0.18)" onclick="window.deleteClient(${c.id})" title="Excluir"><i data-lucide="trash" style="width:14px;height:14px;"></i></button>
            </div>`;
        tbody.appendChild(card);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

export function openAddClientModal() {
    document.getElementById('modal-client-title').innerText = 'Novo Cliente / Loja';
    document.getElementById('form-add-client').reset();
    document.getElementById('client-id').value = '';
    document.getElementById('modal-add-client').classList.add('active');
}

export function closeClientModal() {
    document.getElementById('modal-add-client').classList.remove('active');
}

export function openEditClientModal(id) {
    const c = state.clientes.find(x => x.id === id);
    if (!c) return;
    document.getElementById('modal-client-title').innerText = 'Editar Cliente / Loja';
    document.getElementById('client-id').value = c.id;
    document.getElementById('client-name').value = c.name;
    document.getElementById('client-doc').value = c.document || '';
    document.getElementById('client-phone').value = c.phone || '';
    document.getElementById('client-email').value = c.email || '';
    document.getElementById('modal-add-client').classList.add('active');
}

export async function saveClient(event) {
    event.preventDefault();
    const idVal = document.getElementById('client-id').value;
    const id = idVal ? parseId(idVal) : null;
    const name = document.getElementById('client-name').value.trim();
    const doc = document.getElementById('client-doc').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const email = document.getElementById('client-email').value.trim();

    if (state.isCloudActive) {
        try {
            if (id) {
                await state.supabaseClient.from('clientes').update({ name, document: doc, phone, email }).eq('id', id);
            } else {
                await state.supabaseClient.from('clientes').insert({ name, document: doc, phone, email });
            }
            await fetchCloudData();
        } catch (e) {
            console.error(e);
            return;
        }
    } else {
        if (id) {
            const c = state.clientes.find(x => x.id === id);
            if (c) { c.name = name; c.document = doc; c.phone = phone; c.email = email; }
        } else {
            state.clientes.push({ id: Date.now(), name, document: doc, phone, email, createdAt: new Date().toISOString() });
        }
        persistLocalData();
    }
    closeClientModal();
    renderClientesTable();
}

export async function deleteClient(id) {
    const doDelete = async () => {
        if (state.isCloudActive) {
            try {
                await state.supabaseClient.from('clientes').delete().eq('id', id);
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            return;
            }
        } else {
            state.clientes = state.clientes.filter(c => String(c.id) !== String(id));
            persistLocalData();
        }
        renderClientesTable();
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Cliente", "Deseja excluir este cliente?", doDelete, "Excluir");
    } else if (confirm('Deseja excluir este cliente?')) {
        await doDelete();
    }
}

// Custom autocomplete buyer search dropdown inside Checkout module
export function handleClientSearch() {
    const input = document.getElementById('cd-sell-client');
    const dropdown = document.getElementById('cd-client-dropdown');
    if (!input || !dropdown) return;
    
    const val = input.value.toLowerCase().trim();

    if (!val) {
        dropdown.style.display = 'none';
        return;
    }

    const matches = state.clientes.filter(c => c.name.toLowerCase().includes(val) || (c.document && c.document.includes(val)));

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(c => `
            <div class='custom-dropdown-item' onclick='window.selectClientFromDropdown(this)' data-name='${c.name}' data-doc='${c.document || ''}'>
                ${c.name} <span class='doc'>${c.document || 'Sem CPF/CNPJ'}</span>
            </div>
        `).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = `<div class='custom-dropdown-item' style='color:var(--text-muted); cursor:default;'>Novo Cliente: ${input.value}</div>`;
        dropdown.style.display = 'block';
    }
}

export function selectClientFromDropdown(el) {
    document.getElementById('cd-sell-client').value = el.getAttribute('data-name');
    document.getElementById('cd-sell-doc').value = el.getAttribute('data-doc');
    document.getElementById('cd-client-dropdown').style.display = 'none';
}

// Auto close dropdown listener
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('cd-client-dropdown');
    if (dropdown && e.target.id !== 'cd-sell-client') {
        dropdown.style.display = 'none';
    }
});
