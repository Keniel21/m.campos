// ==========================================================================
// AUTO DRIVE CRM - FINANCIAL REPORTING FEATURE
// ==========================================================================

import { state } from '../../services/state.js';
import { formatCurrency, parseCurrencyBR, parseId } from '../../utils/helpers.js';
import { getFilteredDates, getPeriodLabel } from '../configuracoes/configuracoes.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';

// Global chart instance for cash flow distribution
export let chartFinanceInstance = null;

// Renders the ledger table view and calculates profit sums
export function renderFinanceiro() {
    const finTableBody = document.getElementById("financeiro-table-body");
    if (!finTableBody) return;
    finTableBody.innerHTML = "";

    const { start, end } = getFilteredDates();

    // Filter sales & expenses within chosen interval
    const vendasFiltradas = state.vendas.filter(v => {
        const d = new Date(v.date + 'T12:00:00');
        return d >= start && d <= end;
    });
    const despesasFiltradas = state.despesas.filter(d => {
        const dt = new Date(d.date + 'T12:00:00');
        return dt >= start && dt <= end;
    });

    const entradas = vendasFiltradas.reduce((sum, v) => sum + v.sellPrice, 0);
    const entradasEl = document.getElementById("fin-entradas");
    if (entradasEl) entradasEl.innerText = formatCurrency(entradas);

    // Outputs = buyPrice of all sold cars inside interval
    const saidasCompraEstoque = vendasFiltradas.reduce((sum, v) => {
        const car = state.estoque.find(c => c.id === v.carId);
        return sum + (car ? car.buyPrice : 0);
    }, 0);
    const saidasEl = document.getElementById("fin-saidas");
    if (saidasEl) saidasEl.innerText = formatCurrency(saidasCompraEstoque);

    const totalDespesas = despesasFiltradas.reduce((sum, d) => sum + d.val, 0);
    const despesasEl = document.getElementById("fin-despesas");
    if (despesasEl) despesasEl.innerText = formatCurrency(totalDespesas);

    const liquidoReal = entradas - saidasCompraEstoque - totalDespesas;
    const liquidoEl = document.getElementById("fin-liquido");
    if (liquidoEl) liquidoEl.innerText = formatCurrency(liquidoReal);

    // Render despesas ledger
    if (despesasFiltradas.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted); font-style:italic;"><i data-lucide="search-x" style="width:16px;height:16px;margin-right:6px;vertical-align:middle;"></i>Nenhuma despesa em "${getPeriodLabel()}"</td>`;
        finTableBody.appendChild(tr);
    } else {
        [...despesasFiltradas].reverse().forEach(d => {
            const car = state.estoque.find(c => String(c.id) === String(d.carId));
            const carName = car ? car.model : "Geral (Sem Carro)";
            const dateObj = new Date(d.date + 'T12:00:00');
            const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${formattedDate}</td>
                <td>${d.desc}</td>
                <td style="color:var(--text-muted)">${carName}</td>
                <td><span class="badge convencional" style="font-size:10px">${d.category}</span></td>
                <td style="font-family:monospace; color:var(--red-alert); font-weight:600">-${formatCurrency(d.val)}</td>
                <td style="text-align:center;">
                    <div style="display:flex;gap:6px;justify-content:center;">
                        <button class="btn btn-secondary" style="padding:4px 8px;font-size:11px" onclick="window.openEditDespesaModal('${d.id}')"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>
                        <button class="btn" style="padding:4px 8px;font-size:11px;background-color:rgba(239,68,68,0.15);color:var(--red-alert);border:1px solid rgba(239,68,68,0.2)" onclick="window.deleteDespesaConfirm('${d.id}')"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
                    </div>
                </td>`;
            finTableBody.appendChild(tr);
        });
    }

    populateDespesaCarSelect();
    initFinanceChart(despesasFiltradas);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// Add/Populate car select filters for despesas modals
export function populateDespesaCarSelect(targetId = 'exp-car') {
    const select = document.getElementById(targetId);
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = `<option value="">Despesa Geral (Sem veículo específico)</option>` +
        state.estoque.map(car => `<option value="${car.id}">#${car.id} - ${car.model}</option>`).join('');
    if (currentVal) select.value = currentVal;
}

export function openAddDespesaModal() {
    populateDespesaCarSelect('exp-car');
    const dateEl = document.getElementById("exp-date");
    if (dateEl && !dateEl.value) {
        dateEl.value = new Date().toISOString().split('T')[0];
    }
    const modal = document.getElementById("modal-add-despesa");
    if (modal) modal.classList.add("active");
}

export function closeAddDespesaModal() {
    const modal = document.getElementById("modal-add-despesa");
    if (modal) modal.classList.remove("active");
    document.getElementById("form-add-despesa")?.reset();
}

export async function saveNewDespesa(event) {
    if (event && event.preventDefault) event.preventDefault();
    const desc = document.getElementById("exp-desc")?.value.trim() || '';
    const rawVal = document.getElementById("exp-val")?.value;
    const val = typeof rawVal === 'string' && (rawVal.includes('R$') || rawVal.includes(','))
        ? parseCurrencyBR(rawVal)
        : (parseFloat(rawVal) || 0);
    const dateInput = document.getElementById("exp-date")?.value;
    const date = dateInput || new Date().toISOString().split('T')[0];
    const carIdVal = document.getElementById("exp-car")?.value;
    const carId = (carIdVal && carIdVal !== "" && carIdVal !== "null" && carIdVal !== "undefined") ? parseId(carIdVal) : null;
    const category = document.getElementById("exp-cat")?.value || 'Operacional';

    if (!desc) {
        alert("Por favor, informe a descrição da despesa.");
        return;
    }
    if (val <= 0) {
        alert("Por favor, informe um valor válido para a despesa.");
        return;
    }

    const newId = state.despesas.length > 0 ? Math.max(...state.despesas.map(d => Number(d.id) || 0)) + 1 : 1;
    const newDespesaLocal = { id: newId, desc, carId, date, val, category };

    // Always push locally first so state updates immediately
    state.despesas.push(newDespesaLocal);
    persistLocalData();

    if (state.isCloudActive && state.supabaseClient) {
        try {
            const despesaData = {
                description: desc,
                car_id: carId,
                date,
                val,
                category
            };
            const { data, error } = await state.supabaseClient.from('despesas').insert([despesaData]).select();
            if (!error && data && data.length > 0) {
                newDespesaLocal.id = data[0].id;
                persistLocalData();
            }
        } catch (e) {
            console.error("Erro ao salvar despesa na nuvem:", e);
        }
    }

    const activeCarId = window.currentCdCarId;
    if (activeCarId) {
        if (window.renderCarExpenses) window.renderCarExpenses(activeCarId);
        if (window.calculateDetailsFinancials) window.calculateDetailsFinancials();
    }

    window.updateApplicationState();
    closeAddDespesaModal();
}

export function openEditDespesaModal(despesaId) {
    const d = state.despesas.find(d => String(d.id) === String(despesaId));
    if (!d) return;
    populateDespesaCarSelect('edit-exp-car');
    document.getElementById("edit-exp-id").value = d.id;
    document.getElementById("edit-exp-desc").value = d.desc;
    document.getElementById("edit-exp-val").value = d.val;
    document.getElementById("edit-exp-date").value = d.date;
    document.getElementById("edit-exp-car").value = d.carId || '';
    document.getElementById("edit-exp-cat").value = d.category;
    document.getElementById("modal-edit-despesa").classList.add("active");
}

export function closeEditDespesaModal() {
    document.getElementById("modal-edit-despesa").classList.remove("active");
}

export async function saveEditDespesa(event) {
    event.preventDefault();
    const despesaId = parseId(document.getElementById("edit-exp-id").value);
    const desc = document.getElementById("edit-exp-desc").value.trim();
    const val = parseFloat(document.getElementById("edit-exp-val").value) || 0;
    const date = document.getElementById("edit-exp-date").value || new Date().toISOString().split('T')[0];
    const carIdVal = document.getElementById("edit-exp-car").value;
    const carId = carIdVal ? parseId(carIdVal) : null;
    const category = document.getElementById("edit-exp-cat").value;

    const d = state.despesas.find(d => String(d.id) === String(despesaId));
    if (d) {
        Object.assign(d, { desc, val, date, carId, category });
        persistLocalData();
    }

    if (state.isCloudActive && state.supabaseClient) {
        try {
            await state.supabaseClient.from('despesas').update({ description: desc, val, date, car_id: carId, category }).eq('id', despesaId);
        } catch (e) {
            console.error("Erro ao atualizar despesa na nuvem:", e);
        }
    }

    window.updateApplicationState();
    closeEditDespesaModal();
}

export async function deleteDespesaConfirm(despesaId) {
    const doDelete = async () => {
        state.despesas = state.despesas.filter(d => String(d.id) !== String(despesaId));
        persistLocalData();

        if (state.isCloudActive && state.supabaseClient) {
            try {
                await state.supabaseClient.from('despesas').delete().eq('id', despesaId);
            } catch (e) {
                console.error("Erro ao deletar despesa na nuvem:", e);
            }
        }

        window.updateApplicationState();
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Custo", "Excluir esta despesa? Esta ação não pode ser desfeita.", doDelete, "Excluir");
    } else if (confirm("Excluir esta despesa? Esta ação não pode ser desfeita.")) {
        await doDelete();
    }
}

// Sub deletion for active car details specification subtab
export async function deleteDespesaFromDetails(despesaId) {
    const doDelete = async () => {
        state.despesas = state.despesas.filter(d => String(d.id) !== String(despesaId));
        persistLocalData();

        if (state.isCloudActive && state.supabaseClient) {
            try {
                await state.supabaseClient.from('despesas').delete().eq('id', despesaId);
            } catch (e) {
                console.error("Erro ao deletar despesa na nuvem:", e);
            }
        }
        
        const activeCarId = window.currentCdCarId;
        if (activeCarId) {
            if (window.renderCarExpenses) window.renderCarExpenses(activeCarId);
            if (window.calculateDetailsFinancials) window.calculateDetailsFinancials();
        }
        window.updateApplicationState();
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Custo do Veículo", "Tem certeza que deseja excluir esta despesa do veículo?", doDelete, "Excluir");
    } else if (confirm("Tem certeza que deseja excluir esta despesa do veículo?")) {
        await doDelete();
    }
}

// Pie distributions rendering using Chart.js
export function initFinanceChart(despesasFiltradas) {
    const ctx = document.getElementById('chart-finance-distribution');
    if (!ctx) return;

    if (!despesasFiltradas) {
        const { start, end } = getFilteredDates();
        despesasFiltradas = state.despesas.filter(d => {
            const dt = new Date(d.date + 'T12:00:00');
            return dt >= start && dt <= end;
        });
    }

    const categoriesSum = {};
    despesasFiltradas.forEach(d => { categoriesSum[d.category] = (categoriesSum[d.category] || 0) + d.val; });

    if (chartFinanceInstance) {
        chartFinanceInstance.destroy();
    }

    chartFinanceInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoriesSum).length > 0 ? Object.keys(categoriesSum) : ["Nenhum Gasto"],
            datasets: [{
                data: Object.values(categoriesSum).length > 0 ? Object.values(categoriesSum) : [1],
                backgroundColor: ['#EF4444', '#F59E0B', '#2563EB', '#8B5CF6'],
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        padding: 8,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}
