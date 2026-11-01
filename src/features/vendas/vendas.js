// ==========================================================================
// AUTO DRIVE CRM - SALES COMPILATION & REPORTS FEATURE
// ==========================================================================

import { state } from '../../services/state.js';
import { formatCurrency, parseCurrencyBR, parseId } from '../../utils/helpers.js';
import { getFilteredDates, getPeriodLabel } from '../configuracoes/configuracoes.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';

// Toggle calculation balloon for KPI cards
window.toggleKpiBalloon = function(iconEl, event) {
    if (event) event.stopPropagation();
    const card = iconEl.closest('.kpi-card');
    if (!card) return;

    const balloon = card.querySelector('.kpi-balloon');
    if (!balloon) return;

    const isCurrentlyVisible = balloon.style.display !== 'none' && balloon.style.display !== '';

    // Close all open balloons
    document.querySelectorAll('.kpi-balloon').forEach(b => b.style.display = 'none');

    // Toggle current
    if (!isCurrentlyVisible) {
        balloon.style.display = 'block';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }
};

// Global click listener to close KPI balloons when clicking outside
if (typeof document !== 'undefined') {
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.kpi-balloon') && !e.target.closest('.kpi-icon-clickable')) {
            document.querySelectorAll('.kpi-balloon').forEach(b => b.style.display = 'none');
        }
    });
}

// Filter sales table by search input
export function filterVendasTable() {
    const searchVal = document.getElementById("search-vendas")?.value || '';
    renderVendasTable(searchVal);
}

// Renders the Sales compilation list table
export function renderVendasTable(searchQuery = '') {
    const body = document.getElementById("vendas-table-body");
    if (!body) return;
    body.innerHTML = "";

    const query = (searchQuery !== '' ? searchQuery : (document.getElementById("search-vendas")?.value || '')).trim().toLowerCase();

    const { start, end } = getFilteredDates();
    let vendasFiltradas = [...state.vendas]
        .filter(v => {
            if (!v.date) return state.activePeriodFilter === 'all';
            const d = new Date(v.date + 'T12:00:00');
            if (isNaN(d.getTime())) return state.activePeriodFilter === 'all';
            return d >= start && d <= end;
        });

    // Sort descending by date (newest first) and ID
    vendasFiltradas.sort((a, b) => {
        const dateA = new Date((a.date || '') + 'T12:00:00').getTime() || 0;
        const dateB = new Date((b.date || '') + 'T12:00:00').getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    // If search query is provided, filter by multiple fields
    if (query) {
        vendasFiltradas = vendasFiltradas.filter(v => {
            const car = state.estoque.find(c => String(c.id) === String(v.carId)) || {};
            const sellerCnpjVal = v.sellerCnpj || v.seller_cnpj || "";
            const clientVal = v.client || "";
            const clientDocVal = v.clientDocument || v.client_document || "";
            const sellerVal = v.seller || v.vendedor || "";
            const typeVal = v.type || "";
            const modelVal = car.model || "";
            const plateVal = car.plate || "";
            const colorVal = car.color || "";
            const chassisVal = car.chassis || "";
            const yearVal = car.year ? String(car.year) : "";
            const dateVal = v.date || "";
            const formattedDate = v.date ? v.date.split('-').reverse().join('/') : "";

            return clientVal.toLowerCase().includes(query) ||
                clientDocVal.toLowerCase().includes(query) ||
                modelVal.toLowerCase().includes(query) ||
                plateVal.toLowerCase().includes(query) ||
                colorVal.toLowerCase().includes(query) ||
                chassisVal.toLowerCase().includes(query) ||
                yearVal.toLowerCase().includes(query) ||
                sellerCnpjVal.toLowerCase().includes(query) ||
                sellerVal.toLowerCase().includes(query) ||
                typeVal.toLowerCase().includes(query) ||
                dateVal.includes(query) ||
                formattedDate.includes(query);
        });
    }

    // Calculate KPI summaries
    const totalFaturamento = vendasFiltradas.reduce((sum, v) => sum + (v.sellPrice || 0), 0);
    const totalLucro = vendasFiltradas.reduce((sum, v) => sum + (v.profit || 0), 0);
    const margemMedia = totalFaturamento > 0 ? (totalLucro / totalFaturamento) * 100 : 0;
    const totalEntregues = vendasFiltradas.length;

    const elFat = document.getElementById("sales-kpi-faturamento");
    const elLucro = document.getElementById("sales-kpi-lucro");
    const elMargem = document.getElementById("sales-kpi-margem");
    const elEntregues = document.getElementById("sales-kpi-entregues");

    if (elFat) elFat.innerText = formatCurrency(totalFaturamento);
    if (elLucro) elLucro.innerText = formatCurrency(totalLucro);
    if (elMargem) elMargem.innerText = `${margemMedia.toFixed(1)}%`;
    if (elEntregues) elEntregues.innerText = totalEntregues;

    // Filter indicator banner above table
    const statusBanner = document.getElementById("vendas-filter-status-banner");
    if (statusBanner) {
        const totalAll = (state.vendas || []).length;
        if (query) {
            statusBanner.innerHTML = `<span>Filtrando por busca <strong>"${query}"</strong>: <strong>${vendasFiltradas.length}</strong> de <strong>${totalAll}</strong> vendas encontradas.</span><div style="display:inline-flex; gap:6px;"><button type="button" class="btn btn-secondary" onclick="document.getElementById('search-vendas').value=''; window.filterVendasTable();" style="font-size:11px; padding:3px 8px;">Limpar busca</button><button type="button" class="btn btn-secondary" onclick="window.syncVendasFromCloud()" style="font-size:11px; padding:3px 8px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Sincronizar Nuvem</button></div>`;
            statusBanner.style.display = 'flex';
        } else if (vendasFiltradas.length < totalAll) {
            statusBanner.innerHTML = `<span>Exibindo <strong>${vendasFiltradas.length}</strong> de <strong>${totalAll}</strong> vendas cadastradas no total (filtro: <strong>${getPeriodLabel()}</strong>).</span><div style="display:inline-flex; gap:6px;"><button type="button" class="btn btn-secondary" onclick="window.applyPeriodFilter('all')" style="font-size:11px; padding:3px 8px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="eye" style="width:12px;height:12px;"></i> Exibir Todas as ${totalAll} Vendas</button><button type="button" class="btn btn-secondary" onclick="window.syncVendasFromCloud()" style="font-size:11px; padding:3px 8px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Sincronizar Nuvem</button></div>`;
            statusBanner.style.display = 'flex';
        } else {
            statusBanner.innerHTML = `<span>Exibindo histórico completo: todas as <strong>${totalAll}</strong> vendas cadastradas.</span><button type="button" class="btn btn-secondary" onclick="window.syncVendasFromCloud()" style="font-size:11px; padding:3px 8px; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Sincronizar Nuvem</button>`;
            statusBanner.style.display = 'flex';
        }
    }

    if (vendasFiltradas.length === 0) {
        body.innerHTML = `
            <div class="empty-state-container" style="padding: 40px; text-align: center; width: 100%;">
                <i data-lucide="search-x" style="width:48px; height:48px; stroke-width:1.5; color:var(--text-muted); margin-bottom:12px;"></i>
                <h4 style="margin:0 0 6px 0; color:var(--text-light); font-size:15px;">Nenhuma venda encontrada</h4>
                <p style="margin:0; color:var(--text-muted); font-size:13px;">${query ? `Nenhum resultado correspondente a "${query}".` : `Não há registros de venda para o período "${getPeriodLabel()}".`}</p>
                <div style="margin-top:14px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
                    ${(state.vendas && state.vendas.length > 0) ? `
                        <button type="button" class="btn btn-primary" onclick="window.applyPeriodFilter('all')" style="font-size:12px; padding:8px 16px; display:inline-flex; align-items:center; gap:6px;">
                            <i data-lucide="calendar"></i> Exibir todas as ${state.vendas.length} vendas cadastradas no histórico
                        </button>
                    ` : ''}
                    <button type="button" class="btn btn-secondary" onclick="window.syncVendasFromCloud()" style="font-size:12px; padding:8px 16px; display:inline-flex; align-items:center; gap:6px;">
                        <i data-lucide="refresh-cw"></i> Sincronizar da Nuvem
                    </button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    vendasFiltradas.forEach(v => {
        const car = state.estoque.find(c => String(c.id) === String(v.carId)) || { model: "Veículo de Giro", buyPrice: 0 };
        const dateObj = new Date(v.date + 'T12:00:00');
        const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const defaultCnpj = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault))?.cnpj || "";
        const sellerCnpjVal = v.sellerCnpj || v.seller_cnpj || defaultCnpj;
        const card = document.createElement("div");
        card.className = "vendas-modern-row";
        card.id = `venda-row-${v.id}`;
        card.setAttribute("data-venda-id", String(v.id));
        card.innerHTML = `
            <div style="color: var(--text-muted); font-size: 13px;">${formattedDate}</div>
            <div style="font-weight:600; color:var(--text-light);">
                ${v.client}
                ${sellerCnpjVal ? `<div style="font-size:11px; color:var(--text-muted); font-weight:normal; margin-top:2px;"><i data-lucide="building-2" style="width:11px;height:11px;display:inline-block;vertical-align:middle;margin-right:2px;"></i>CNPJ: ${sellerCnpjVal}</div>` : ''}
            </div>
            <div>
                <span style="font-weight:600; color:var(--text-light); cursor:pointer; display:inline-flex; align-items:center; gap:4px;" onclick="window.openCarDetails(${car.id || v.carId}, 'vendas')" title="Abrir Ficha Técnica do Veículo">
                    ${car.model}
                    <i data-lucide="external-link" style="width:12px;height:12px;opacity:0.6;"></i>
                </span>
            </div>
            <div style="font-family:monospace; font-weight:600; color:var(--blue-primary);">${formatCurrency(v.sellPrice)}</div>
            <div style="font-family:monospace; color: var(--green-profit); font-weight:600">${formatCurrency(v.profit)}</div>
            <div style="font-family:monospace; color: var(--text-light);">${v.margin.toFixed(1)}%</div>
            <div><span class="badge ${v.type}">${v.type === 'repasse' ? 'repasse' : (v.type === 'outros' ? 'outros' : 'varejo')}</span></div>
            <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                <button class="btn btn-secondary" style="padding:6px; border-radius:8px;" onclick="window.openCarDetails(${car.id || v.carId}, 'vendas')" title="Ficha Técnica / Documentos"><i data-lucide="car" style="width:14px;height:14px;margin-right:4px;"></i>Ficha</button>
                <button class="btn btn-secondary" style="padding:6px; border-radius:8px;" onclick="window.generatePDFReceipt('${v.id}')" title="Emitir Recibo em PDF"><i data-lucide="file-check" style="width:14px;height:14px;margin-right:4px;"></i>Recibo</button>
                <button class="btn btn-secondary" style="padding:6px; border-radius:8px;" onclick="window.openEditVendaModal('${v.id}')" title="Editar"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                <button class="btn" style="padding:6px; border-radius:8px; background-color:rgba(239,68,68,0.12); color:var(--red-alert); border:1px solid rgba(239,68,68,0.18)" onclick="window.deleteVendaConfirm('${v.id}')" title="Excluir"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
            </div>`;
        body.appendChild(card);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Highlights a newly registered or edited sale row with visual glow
export function highlightVendaRow(vendaId) {
    if (!vendaId) return;
    setTimeout(() => {
        const row = document.getElementById(`venda-row-${vendaId}`) || document.querySelector(`[data-venda-id="${vendaId}"]`);
        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('newly-registered-sale-pulse');
            setTimeout(() => {
                row.classList.remove('newly-registered-sale-pulse');
            }, 4000);
        }
    }, 150);
}

// Edit sales models
export function openEditVendaModal(vendaId) {
    const v = state.vendas.find(v => String(v.id) === String(vendaId));
    if (!v) return;
    document.getElementById("edit-venda-id").value = v.id;
    document.getElementById("edit-venda-client").value = v.client || "";
    const sellerCnpjEl = document.getElementById("edit-venda-seller-cnpj");
    const customWrapper = document.getElementById("edit-venda-custom-cnpj-wrapper");
    const customInput = document.getElementById("edit-venda-seller-cnpj-custom");
    if (customWrapper) customWrapper.style.display = "none";
    if (customInput) customInput.value = "";

    if (sellerCnpjEl) {
        const currentCnpj = v.sellerCnpj || v.seller_cnpj || "";
        if (window.populateSellerCnpjsDropdown) {
            window.populateSellerCnpjsDropdown(sellerCnpjEl, currentCnpj);
        } else {
            sellerCnpjEl.value = currentCnpj;
        }
    }
    document.getElementById("edit-venda-price").value = v.sellPrice;
    document.getElementById("edit-venda-profit").value = v.profit;
    document.getElementById("edit-venda-margin").value = v.margin;
    document.getElementById("edit-venda-date").value = v.date;
    document.getElementById("edit-venda-type").value = v.type;
    document.getElementById("modal-edit-venda").classList.add("active");
}

export function closeEditVendaModal() {
    document.getElementById("modal-edit-venda").classList.remove("active");
}

export async function saveEditVenda(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById("edit-venda-id");
    if (!idInput) return;
    const vendaId = parseId(idInput.value);
    const client = (document.getElementById("edit-venda-client")?.value || "").trim();
    const rawSellerCnpj = document.getElementById("edit-venda-seller-cnpj")?.value;
    const customSellerCnpj = document.getElementById("edit-venda-seller-cnpj-custom")?.value;
    const sellerCnpj = (rawSellerCnpj === 'custom' ? customSellerCnpj : (rawSellerCnpj || "")).trim();
    const sellPrice = parseFloat(document.getElementById("edit-venda-price")?.value) || 0;
    const profit = parseFloat(document.getElementById("edit-venda-profit")?.value) || 0;
    const margin = parseFloat(document.getElementById("edit-venda-margin")?.value) || 0;
    const date = document.getElementById("edit-venda-date")?.value || "";
    const type = document.getElementById("edit-venda-type")?.value || "convencional";

    // Update in-memory state for both seller CNPJ fields
    const v = state.vendas.find(v => String(v.id) === String(vendaId));
    if (v) {
        v.client = client;
        v.sellerCnpj = sellerCnpj;
        v.seller_cnpj = sellerCnpj;
        v.sellPrice = sellPrice;
        v.profit = profit;
        v.margin = margin;
        v.date = date;
        v.type = type;
    }

    // Persist to server JSON database
    try {
        await fetch(`/api/crm/vendas/${vendaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client,
                sellerCnpj,
                seller_cnpj: sellerCnpj,
                sellPrice,
                profit,
                margin,
                date,
                type
            })
        });
    } catch (_) {}

    // Persist to Supabase if authenticated
    if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
        try {
            const updateData = { client, sell_price: sellPrice, profit, margin, date, type };
            if (sellerCnpj) updateData.seller_cnpj = sellerCnpj;
            const { error: errUpdate } = await state.supabaseClient.from('vendas').update(updateData).eq('id', vendaId);
            if (errUpdate && errUpdate.message?.includes('seller_cnpj')) {
                delete updateData.seller_cnpj;
                await state.supabaseClient.from('vendas').update(updateData).eq('id', vendaId);
            }
        } catch (_) {}
    }

    persistLocalData();
    window.updateApplicationState();
    closeEditVendaModal();

    if (window.showToast) {
        window.showToast("Venda e CNPJ Vendedor atualizados com sucesso!", "success");
    }
}

// Revert/Delete sale
export async function deleteVendaConfirm(vendaId) {
    const doDelete = async () => {
        const venda = state.vendas.find(v => String(v.id) === String(vendaId));
        const carId = venda ? (venda.carId || venda.car_id) : null;

        try {
            await fetch(`/api/crm/vendas/${vendaId}`, { method: 'DELETE' });
        } catch (_) {}

        if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
            try {
                await state.supabaseClient.from('vendas').delete().eq('id', vendaId);
                if (carId) {
                    await state.supabaseClient.from('estoque').update({ status: 'disponivel' }).eq('id', carId);
                }
            } catch (_) {}
        }

        state.vendas = state.vendas.filter(v => String(v.id) !== String(vendaId));
        if (carId) {
            const car = state.estoque.find(c => String(c.id) === String(carId));
            if (car) car.status = 'disponivel';
        }
        persistLocalData();
        window.updateApplicationState();
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Venda", "Excluir esta venda e reverter o veículo para disponível no estoque? Esta ação não pode ser desfeita.", doDelete, "Excluir");
    } else if (confirm("Excluir esta venda e reverter o veículo para disponível no estoque? Esta ação não pode ser desfeita.")) {
        await doDelete();
    }
}

// Generate contract PDF / Print receipt
export function generatePDFReceipt(saleId) {
    const v = state.vendas.find(sale => sale.id === saleId);
    if (!v) return;
    const car = state.estoque.find(c => c.id === v.carId) || { model: "Veículo de Giro", year: "N/A", km: 0, plate: "N/A", color: "N/A", chassis: "N/A" };

    const formattedDate = new Date(v.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedPrice = formatCurrency(v.sellPrice);

    const contentDiv = document.getElementById("receipt-print-content");
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="receipt-container">
                <div class="receipt-header-print">
                    <div>
                        <h2>AutoDrive CRM</h2>
                        <p>Gestão Automotiva Inteligente</p>
                        <p style="font-size:11px; color:#6b7280; margin-top:4px;">Operação de Vendas - Revendedora Sem Loja Física</p>
                    </div>
                    <div style="text-align:right;">
                        <div class="receipt-number">COMPROVANTE Nº #${v.id}</div>
                        <p style="font-size:12px; color:#4b5563; margin-top:8px;">Data de Emissão: ${formattedDate}</p>
                    </div>
                </div>

                <div class="receipt-grid-print">
                    <div class="receipt-section-print">
                        <div class="receipt-section-title-print">Vendedor / Emitente</div>
                        <p><strong>AutoDrive CRM & Marcelo Motors</strong></p>
                        ${(v.sellerCnpj || v.seller_cnpj) ? `<p>CNPJ Vendedor: <strong>${v.sellerCnpj || v.seller_cnpj}</strong></p>` : ''}
                        <p>Canal de Venda: ${v.type.toUpperCase()}</p>
                        <p>Status da Transação: CONCLUÍDA</p>
                    </div>
                    <div class="receipt-section-print">
                        <div class="receipt-section-title-print">Comprador / Destinatário</div>
                        <p>Nome: <strong>${v.client}</strong></p>
                        <p>Tipo de Transação: Recebimento de Venda</p>
                    </div>
                </div>

                <div class="receipt-section-title-print">Especificações do Veículo Vendido</div>
                <table class="receipt-table-print">
                    <thead>
                        <tr>
                            <th>Veículo / Modelo</th>
                            <th>Ano</th>
                            <th>Quilometragem</th>
                            <th>Placa</th>
                            <th>Cor</th>
                            <th>Chassi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>${car.model}</strong></td>
                            <td>${car.year}</td>
                            <td>${car.km.toLocaleString('pt-BR')} km</td>
                            <td>${car.plate || 'N/A'}</td>
                            <td>${car.color || 'N/A'}</td>
                            <td style="font-family:monospace; font-size:11px;">${car.chassis || 'N/A'}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="receipt-total-print">
                    <span>Valor Total Pago: </span>
                    <strong style="color: var(--green-profit); font-size:22px;">${formattedPrice}</strong>
                </div>

                <div style="margin-top: 40px; font-size: 11px; color:#6b7280; line-height:1.4; border-top: 1px dashed #e5e7eb; padding-top:16px;">
                    Declaro para os devidos fins que recebi a importância de <strong>${formattedPrice}</strong> referente à venda do veículo acima descrito, livre de quaisquer ônus fiscais ou multas até a presente data, outorgando plena, geral e irrevogável quitação.
                </div>

                <div class="receipt-signatures-print">
                    <div class="sig-box">
                        <div class="sig-line">Assinatura do Vendedor / Emitente</div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-line">Assinatura do Comprador</div>
                    </div>
                </div>
            </div>
        `;
    }

    document.getElementById("modal-receipt-print").classList.add("active");
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

export function closeReceiptPrintModal() {
    document.getElementById("modal-receipt-print").classList.remove("active");
}

// --------------------------------------------------------------------------
// EXPORTING AND DOWNLOAD CSV SYSTEM COMPATIBLE WITH EXCEL (UTF-8 BOM + SEMICOLON)
// --------------------------------------------------------------------------
export function downloadCSV(data, headers, fileName) {
    let csvContent = "\uFEFF"; // UTF-8 BOM PT-BR compatibility
    csvContent += headers.join(";") + "\n";

    data.forEach(row => {
        csvContent += row.map(val => {
            if (val === null || val === undefined) return "";
            let formattedVal = String(val).replace(/;/g, ",").replace(/\n/g, " ");
            return `"${formattedVal}"`;
        }).join(";") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function exportEstoqueToExcel() {
    const headers = ["ID", "Modelo", "Ano", "KM", "Valor Compra", "Valor Venda", "Tipo", "Status", "Placa", "Cor", "Chassi"];
    const activeCars = state.estoque.filter(c => c.status !== 'vendido');
    const rows = activeCars.map(c => [
        c.id, c.model, c.year, c.km, c.buyPrice, c.sellPrice, c.type, c.status, c.plate || "", c.color || "", c.chassis || ""
    ]);
    downloadCSV(rows, headers, `autodrive_estoque_patio_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportLeadsToExcel() {
    const headers = ["ID", "Nome Cliente", "Telefone", "ID Veiculo Interesse", "Origem", "Fase CRM", "Dias sem Contato", "Proxima Acao"];
    const rows = state.leads.map(l => [
        l.id, l.name, l.phone, l.interestCarId || "", l.origin, l.status, l.lastContactDays, l.nextAction || ""
    ]);
    downloadCSV(rows, headers, `autodrive_leads_${new Date().toISOString().split('T')[0]}.csv`);
}

export function exportVendasToExcel() {
    const { start, end } = getFilteredDates();
    const periodLabel = getPeriodLabel() || "Período Ativo";
    const periodSlug = (state.activePeriodFilter || 'periodo').replace(/[^a-zA-Z0-9_-]/g, '_');

    // 1. Filter sales according to the active selected period
    let vendasFiltradas = [...state.vendas].filter(v => {
        if (!v.date) return false;
        const d = new Date(v.date + 'T12:00:00');
        return d >= start && d <= end;
    });

    // 2. Also respect any active search filter on the sales table
    const searchVal = (document.getElementById("search-vendas")?.value || '').trim().toLowerCase();
    if (searchVal) {
        vendasFiltradas = vendasFiltradas.filter(v => {
            const car = state.estoque.find(c => String(c.id) === String(v.carId)) || {};
            const sellerCnpjVal = v.sellerCnpj || v.seller_cnpj || "";
            const clientVal = v.client || "";
            const clientDocVal = v.clientDocument || v.client_document || "";
            const sellerVal = v.seller || v.vendedor || "";
            const typeVal = v.type || "";
            const modelVal = car.model || "";
            const plateVal = car.plate || "";
            const colorVal = car.color || "";
            const chassisVal = car.chassis || "";
            const yearVal = car.year ? String(car.year) : "";
            const dateVal = v.date || "";
            const formattedDate = v.date ? v.date.split('-').reverse().join('/') : "";

            return clientVal.toLowerCase().includes(searchVal) ||
                clientDocVal.toLowerCase().includes(searchVal) ||
                modelVal.toLowerCase().includes(searchVal) ||
                plateVal.toLowerCase().includes(searchVal) ||
                colorVal.toLowerCase().includes(searchVal) ||
                chassisVal.toLowerCase().includes(searchVal) ||
                yearVal.toLowerCase().includes(searchVal) ||
                sellerCnpjVal.toLowerCase().includes(searchVal) ||
                sellerVal.toLowerCase().includes(searchVal) ||
                typeVal.toLowerCase().includes(searchVal) ||
                dateVal.includes(searchVal) ||
                formattedDate.includes(searchVal);
        });
    }

    if (vendasFiltradas.length === 0) {
        const msg = `Nenhuma venda encontrada para o período selecionado (${periodLabel}).`;
        if (window.showToast) {
            window.showToast(msg, "warning");
        } else {
            alert(msg);
        }
        return;
    }

    // Sort matching table view: newest sales first
    vendasFiltradas.sort((a, b) => new Date(b.date + 'T12:00:00') - new Date(a.date + 'T12:00:00'));

    const headers = [
        "ID Venda",
        "Data da Venda",
        "Período Filtrado",
        "CNPJ Vendedor (Emitente)",
        "Razão Social Vendedora",
        "Comprador / Destinatário",
        "CPF / CNPJ Comprador",
        "Veículo / Modelo",
        "Ano",
        "Placa",
        "Chassi",
        "Renavam",
        "Valor Compra (R$)",
        "Valor Venda (R$)",
        "Lucro Real (R$)",
        "Margem (%)",
        "Tipo / Canal"
    ];

    const defaultCompany = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault)) || 
                           (state.companyCnpjs && state.companyCnpjs[0]) || 
                           { cnpj: "65.760.566/0001-67", name: "M. DIAS DE CAMPOS LTDA" };

    const rows = vendasFiltradas.map(v => {
        const car = state.estoque.find(c => String(c.id) === String(v.carId)) || {
            model: "Veículo de Giro", year: "", plate: "", chassis: "", renavam: "", buyPrice: 0
        };
        const rawSellerCnpj = v.sellerCnpj || v.seller_cnpj || defaultCompany.cnpj;
        const matchingCompany = (state.companyCnpjs || []).find(c => c.cnpj === rawSellerCnpj) || defaultCompany;
        const sellerName = matchingCompany.name || "AutoDrive Revenda";
        const clientDoc = v.clientDocument || v.client_document || "";
        const formattedDate = v.date ? v.date.split('-').reverse().join('/') : "";

        const buyPriceVal = car.buyPrice !== undefined && car.buyPrice !== null ? Number(car.buyPrice) : 0;
        const sellPriceVal = v.sellPrice !== undefined && v.sellPrice !== null ? Number(v.sellPrice) : 0;
        const profitVal = v.profit !== undefined && v.profit !== null ? Number(v.profit) : (sellPriceVal - buyPriceVal);
        const marginVal = v.margin !== undefined && v.margin !== null ? Number(v.margin) : (sellPriceVal > 0 ? (profitVal / sellPriceVal) * 100 : 0);

        return [
            v.id,
            formattedDate || v.date,
            periodLabel,
            rawSellerCnpj,
            sellerName,
            v.client || "",
            clientDoc,
            car.model || "Veículo de Giro",
            car.year || "",
            car.plate || "",
            car.chassis || "",
            car.renavam || "",
            buyPriceVal.toFixed(2).replace('.', ','),
            sellPriceVal.toFixed(2).replace('.', ','),
            profitVal.toFixed(2).replace('.', ','),
            marginVal.toFixed(1).replace('.', ','),
            v.type || "convencional"
        ];
    });

    // 3. Add summary row with accounting totals for the filtered period
    const totalCompra = vendasFiltradas.reduce((sum, v) => {
        const car = state.estoque.find(c => String(c.id) === String(v.carId));
        return sum + (car && car.buyPrice ? Number(car.buyPrice) : 0);
    }, 0);
    const totalVenda = vendasFiltradas.reduce((sum, v) => sum + (Number(v.sellPrice) || 0), 0);
    const totalLucro = vendasFiltradas.reduce((sum, v) => sum + (Number(v.profit) || 0), 0);
    const margemMedia = totalVenda > 0 ? (totalLucro / totalVenda) * 100 : 0;

    rows.push([
        "TOTAL DO PERÍODO",
        `${vendasFiltradas.length} veículo(s) comercializado(s)`,
        periodLabel,
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        "-",
        totalCompra.toFixed(2).replace('.', ','),
        totalVenda.toFixed(2).replace('.', ','),
        totalLucro.toFixed(2).replace('.', ','),
        margemMedia.toFixed(1).replace('.', ','),
        "-"
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `relatorio_contabil_vendas_${periodSlug}_${dateStr}.csv`;
    downloadCSV(rows, headers, fileName);

    if (window.showToast) {
        window.showToast(`Relatório Contábil exportado! (${vendasFiltradas.length} vendas • ${periodLabel})`, 'success');
    }
}

export function exportDespesasToExcel() {
    const headers = ["ID", "Data", "Descricao", "ID Veiculo", "Categoria", "Valor (R$)"];
    const rows = state.despesas.map(d => [
        d.id, d.date, d.desc, d.carId || "Geral", d.category, d.val
    ]);
    downloadCSV(rows, headers, `autodrive_despesas_${new Date().toISOString().split('T')[0]}.csv`);
}

// --------------------------------------------------------------------------
// SELL CAR MODAL HANDLERS
// --------------------------------------------------------------------------
export function openSellCarModal(carId, clientName = '') {
    const car = state.estoque.find(c => String(c.id) === String(carId));
    if (!car) {
        alert("Veículo não encontrado no estoque.");
        return;
    }

    const existingSale = (state.vendas || []).find(v => (String(v.carId) === String(car.id) || String(v.car_id) === String(car.id)) && v.carId !== null);
    if (existingSale) {
        if (confirm(`O veículo "${car.model}" já consta como vendido no sistema (Venda #${existingSale.id}). Deseja visualizar esta venda no Menu de Vendas?`)) {
            if (window.switchTab) window.switchTab('vendas');
            if (window.highlightVendaRow) window.highlightVendaRow(existingSale.id);
        }
        return;
    }

    const idEl = document.getElementById("sell-car-id");
    const nameEl = document.getElementById("sell-car-name");
    const clientEl = document.getElementById("sell-client-name");
    const priceEl = document.getElementById("sell-price");
    const dateEl = document.getElementById("sell-date");
    const typeEl = document.getElementById("sell-type");

    if (idEl) idEl.value = car.id;
    if (nameEl) nameEl.value = `${car.model} (${car.year}) - ${car.plate || 'S/ Placa'}`;
    if (clientEl) clientEl.value = clientName || '';
    if (priceEl) priceEl.value = car.sellPrice || car.buyPrice || '';
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    if (typeEl) typeEl.value = car.type === 'repasse' ? 'repasse' : 'convencional';

    const modal = document.getElementById("modal-sell-car");
    if (modal) modal.classList.add("active");
}

export function closeSellModal() {
    const modal = document.getElementById("modal-sell-car");
    if (modal) modal.classList.remove("active");
}

export async function saveSale(event) {
    if (event) event.preventDefault();
    const rawCarId = document.getElementById("sell-car-id")?.value;
    const carId = parseId(rawCarId);
    const client = (document.getElementById("sell-client-name")?.value || "").trim();
    const sellPrice = parseFloat(document.getElementById("sell-price")?.value) || 0;
    const date = document.getElementById("sell-date")?.value || new Date().toISOString().split('T')[0];
    const type = document.getElementById("sell-type")?.value || 'convencional';

    if (!client) {
        alert("Por favor, preencha o nome do comprador.");
        return;
    }

    const car = state.estoque.find(c => String(c.id) === String(carId));
    if (!car) {
        alert("Veículo não encontrado no estoque.");
        return;
    }

    const existingSale = (state.vendas || []).find(v => (String(v.carId) === String(car.id) || String(v.car_id) === String(car.id)) && v.carId !== null);
    if (existingSale) {
        alert(`Este veículo ("${car.model}") já possui uma venda registrada no sistema (Venda #${existingSale.id}).`);
        closeSellModal();
        if (window.switchTab) window.switchTab('vendas');
        if (window.highlightVendaRow) window.highlightVendaRow(existingSale.id);
        return;
    }

    const finalPrice = sellPrice > 0 ? sellPrice : (Number(car.sellPrice) || 0);
    const despesasCarro = (state.despesas || []).filter(d => String(d.carId) === String(car.id) || String(d.car_id) === String(car.id)).reduce((sum, d) => sum + (Number(d.val) || 0), 0);
    const profit = finalPrice - (Number(car.buyPrice) || 0) - despesasCarro;
    const margin = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
    const defaultCnpj = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault))?.cnpj || "65.760.566/0001-67";

    const saleData = {
        carId: Number(car.id),
        car_id: Number(car.id),
        plate: car.plate || "",
        model: car.model || "",
        client,
        clientDocument: "",
        client_document: "",
        sellerCnpj: defaultCnpj,
        seller_cnpj: defaultCnpj,
        sellPrice: finalPrice,
        sell_price: finalPrice,
        date,
        profit,
        margin,
        type
    };

    // 1. Persist sale to central cloud server
    let savedSale = null;
    try {
        const res = await fetch('/api/crm/vendas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(saleData)
        });
        if (res.ok) {
            const data = await res.json();
            if (data && data.sale) {
                savedSale = data.sale;
            }
        }
    } catch (err) {
        console.warn("Falha ao registrar venda no servidor central:", err);
    }

    if (!savedSale) {
        const fallbackId = state.vendas.length > 0 ? Math.max(...state.vendas.map(v => Number(v.id) || 0)) + 1 : 1;
        savedSale = { id: fallbackId, ...saleData };
        if (!state.pendingOutbox) state.pendingOutbox = [];
        state.pendingOutbox.push({ type: 'venda', data: savedSale });
        try { localStorage.setItem('crm_pending_outbox', JSON.stringify(state.pendingOutbox)); } catch (_) {}
    }

    // 2. Add to in-memory state
    state.vendas = state.vendas.filter(v => String(v.id) !== String(savedSale.id));
    state.vendas.unshift(savedSale);

    // 3. Mark car as sold in memory
    car.status = 'vendido';
    car.sellPrice = finalPrice;
    car.soldDate = date;

    // 4. Close related lead if exists
    const lead = state.leads.find(l => String(l.interestCarId) === String(car.id) && l.status !== 'fechado');
    if (lead) {
        lead.status = 'fechado';
        if (!lead.interactions) lead.interactions = [];
        lead.interactions.push({ date: "Hoje", text: `Venda formalizada! Valor de R$ ${finalPrice.toLocaleString('pt-BR')}` });
    }

    // 5. Sync to Supabase if authenticated
    if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
        try {
            await state.supabaseClient.from('estoque').update({ status: 'vendido', sell_price: finalPrice }).eq('id', car.id);
            await state.supabaseClient.from('vendas').insert({
                car_id: car.id,
                client,
                sell_price: finalPrice,
                date,
                profit,
                margin,
                type,
                seller_cnpj: defaultCnpj
            });
        } catch (_) {}
    }

    persistLocalData();
    closeSellModal();
    if (window.updateApplicationState) window.updateApplicationState();

    // 6. Ensure active period filter displays the sale
    const { start, end } = getFilteredDates();
    const saleD = new Date(date + 'T12:00:00');
    if (saleD < start || saleD > end) {
        if (window.applyPeriodFilter) window.applyPeriodFilter('all');
    }

    // 7. Migrate to the Sales Menu
    if (window.switchTab) window.switchTab('vendas');
    if (window.highlightVendaRow) window.highlightVendaRow(savedSale.id);

    if (window.showToast) {
        window.showToast(`Venda do ${car.model} registrada com sucesso! Veículo migrado para o Menu de Vendas.`, 'success');
    }
}

// Manually trigger full cloud sync and re-render sales view
export async function syncVendasFromCloud() {
    const btn = document.getElementById("btn-sync-vendas");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="width:14px;height:14px;"></i> Sincronizando...`;
    }
    try {
        if (typeof window.flushPendingOutbox === 'function') {
            await window.flushPendingOutbox();
        }
        await fetchCloudData();
        renderVendasTable();
        if (window.showToast) {
            window.showToast(`Sincronização concluída! ${state.vendas.length} vendas atualizadas em tempo real.`, 'success');
        }
    } catch (e) {
        console.error("Erro na sincronização manual de vendas:", e);
        if (window.showToast) {
            window.showToast("Falha ao sincronizar vendas da nuvem central.", "error");
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Sincronizar Vendas`;
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }
    }
}

if (typeof window !== 'undefined') {
    window.syncVendasFromCloud = syncVendasFromCloud;
}


