// ==========================================================================
// AUTO DRIVE CRM - STOCK MANAGEMENT FEATURE
// ==========================================================================

import { filterStock } from '../../utils/stock.js';
import { state } from '../../services/state.js';
import { formatCurrency, calcDaysInStock, parseCurrencyBR } from '../../utils/helpers.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';

export let estoqueViewMode = 'lista';
export let estoqueSortColumn = 'id';
export let estoqueSortDirection = 'desc';

export let currentCdCarId = null;
export let carDetailsOriginTab = 'estoque';

// Select stock visual view: List vs Grid
export function setEstoqueView(mode) {
    estoqueViewMode = mode;
    const listView = document.getElementById('estoque-list-view');
    const gridView = document.getElementById('estoque-grid-view');
    const listBtn = document.getElementById('toggle-estoque-lista');
    const gridBtn = document.getElementById('toggle-estoque-grade');

    if (listView) listView.style.display = mode === 'lista' ? 'block' : 'none';
    if (gridView) gridView.style.display = mode === 'grade' ? 'grid' : 'none';
    if (listBtn) listBtn.classList.toggle('active', mode === 'lista');
    if (gridBtn) gridBtn.classList.toggle('active', mode === 'grade');
}

export function filterEstoqueTable() {
    renderEstoque();
}

export function filterEstoqueStatus() {
    renderEstoque();
}

export function openAddDespesaModalFromCar() {
    if (window.openAddDespesaModal) {
        window.openAddDespesaModal();
        const activeCarId = currentCdCarId || window.currentCdCarId;
        if (activeCarId) {
            const select = document.getElementById("exp-car");
            if (select) select.value = activeCarId;
        }
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

export async function handleDocFileSelected(input) {
    if (!input || !input.files || !input.files.length) return;
    await confirmDocUpload();
}

export function cancelDocUpload() {
    const input = document.getElementById("cd-doc-file-input");
    if (input) input.value = "";
}

export async function confirmDocUpload() {
    const input = document.getElementById("cd-doc-file-input");
    const desc = document.getElementById("cd-doc-description");
    const activeCarId = currentCdCarId || window.currentCdCarId;
    if (!input || !input.files || !input.files.length || !activeCarId) return;

    const files = Array.from(input.files);
    const customDesc = desc ? desc.value.trim() : "";

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name;
        const fileExt = fileName.split('.').pop().toLowerCase();
        const description = customDesc || 'Documento Técnico';

        // 1. Read file as Data URL to ensure local availability and instant preview
        let fileDataUrl = '#';
        try {
            fileDataUrl = await readFileAsDataURL(file);
        } catch (e) {
            console.error("Erro ao ler arquivo como DataURL:", e);
            return;
        }

        let effectiveUrl = fileDataUrl;

        // 2. If Supabase is connected, attempt upload to storage
        if (state.isCloudActive && state.supabaseClient && state.supabaseClient.storage) {
            try {
                const cleanFileName = `${activeCarId}_${Date.now()}_${i}.${fileExt}`;
                const { data, error } = await state.supabaseClient.storage
                    .from('documentos')
                    .upload(cleanFileName, file);

                if (!error && data) {
                    const { data: urlData } = state.supabaseClient.storage
                        .from('documentos')
                        .getPublicUrl(cleanFileName);

                    if (urlData && urlData.publicUrl) {
                        effectiveUrl = urlData.publicUrl;
                    }
                }

                // Insert into Supabase table
                await state.supabaseClient.from('documentos_veiculo').insert([{
                    car_id: activeCarId,
                    file_name: fileName,
                    file_url: effectiveUrl,
                    file_type: fileExt,
                    description: description
                }]);
            } catch (e) {
                console.warn("Supabase storage sync fallback (usando persistência central do CRM):", e);
            }
        }

        // 3. Always persist to centralized CRM backend API (/api/crm/documentos)
        const docPayload = {
            carId: activeCarId,
            car_id: activeCarId,
            fileName: fileName,
            file_name: fileName,
            fileUrl: effectiveUrl,
            file_url: effectiveUrl,
            fileType: fileExt,
            file_type: fileExt,
            description: description,
            createdAt: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        let savedDoc = null;
        try {
            const apiRes = await fetch('/api/crm/documentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(docPayload)
            });
            if (apiRes.ok) {
                const resData = await apiRes.json();
                if (resData && resData.item) {
                    savedDoc = resData.item;
                }
            }
        } catch (err) {
            console.error("Erro ao enviar documento para API central:", err);
            return;
            return;
        }

        if (!savedDoc) { return; }

        // 4. Update in-memory state immediately
        if (!state.documentosVeiculo) state.documentosVeiculo = [];
        state.documentosVeiculo.unshift(savedDoc);
    }

    persistLocalData();
    cancelDocUpload();
    renderCarDocuments(activeCarId);

    if (window.showToast) {
        window.showToast(files.length === 1 ? `Documento "${files[0].name}" anexado e salvo com sucesso!` : `${files.length} documentos anexados com sucesso!`, 'success');
    }
}

// Sorting logic
export function sortEstoque(column) {
    if (estoqueSortColumn === column) {
        estoqueSortDirection = estoqueSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        estoqueSortColumn = column;
        estoqueSortDirection = 'asc';
    }

    document.querySelectorAll('.sortable-header').forEach(th => {
        th.classList.remove('active-sort');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.setAttribute('data-lucide', 'chevrons-up-down');
        }
    });

    const activeIcon = document.getElementById(`sort-icon-${column}`);
    if (activeIcon) {
        activeIcon.setAttribute('data-lucide', estoqueSortDirection === 'asc' ? 'chevron-up' : 'chevron-down');
        activeIcon.closest('.sortable-header').classList.add('active-sort');
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    renderEstoque();
}

// Global update function for Stock
export function updateEstoqueFilterCounts() {
    const totalYard = (state.estoque || []).length;
    const btns = document.querySelectorAll('#filter-estoque-group .filter-btn');
    if (btns && btns.length > 0) {
        btns[0].innerHTML = `Todos os veículos (${totalYard})`;
    }
}
window.updateEstoqueFilterCounts = updateEstoqueFilterCounts;

export function renderEstoque() {
    updateEstoqueFilterCounts();
    const searchVal = document.getElementById("search-estoque")?.value || '';
    renderEstoqueTable(searchVal);
}

// Both inventory views include available and sold vehicles, according to the filter.
export function renderEstoqueTable(searchQuery = document.getElementById('search-estoque')?.value || '') {
    const listBody = document.getElementById("estoque-modern-list-body");
    const gridView = document.getElementById("estoque-grid-view");
    if (!listBody || !gridView) return;

    listBody.innerHTML = "";
    gridView.innerHTML = "";

    const status = document.getElementById('filter-estoque-status')?.value || 'todos';
    let filteredCars = filterStock(state.estoque || [], searchQuery, status);
    const count = document.getElementById('estoque-filter-count');
    if (count) count.textContent = `${filteredCars.length} de ${(state.estoque || []).length} veículos`;

    // Sort records
    filteredCars.sort((a, b) => {
        let valA, valB;

        switch (estoqueSortColumn) {
            case 'model': valA = a.model.toLowerCase(); valB = b.model.toLowerCase(); break;
            case 'year': valA = a.year; valB = b.year; break;
            case 'km': valA = a.km; valB = b.km; break;
            case 'buyPrice': valA = a.buyPrice; valB = b.buyPrice; break;
            case 'sellPrice': valA = a.sellPrice; valB = b.sellPrice; break;
            case 'margin':
                valA = (a.sellPrice - a.buyPrice);
                valB = (b.sellPrice - b.buyPrice);
                break;
            case 'days':
                valA = a.purchaseDate ? calcDaysInStock(a.purchaseDate) : 0;
                valB = b.purchaseDate ? calcDaysInStock(b.purchaseDate) : 0;
                break;
            case 'type': valA = a.type; valB = b.type; break;
            case 'status': valA = a.status; valB = b.status; break;
            case 'document_status': valA = a.documentStatus; valB = b.documentStatus; break;
            default: valA = a.id; valB = b.id; break;
        }

        if (valA < valB) return estoqueSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return estoqueSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    if (filteredCars.length === 0) {
        listBody.innerHTML = `
            <div class="empty-state-container" style="padding: 40px; text-align: center; width: 100%;">
                <i data-lucide="package-search" style="width:48px; height:48px; stroke-width:1.5; color:var(--text-muted); margin-bottom:12px;"></i>
                <h4 style="margin:0 0 6px 0; color:var(--text-light); font-size:15px;">Nenhum veículo encontrado</h4>
                <p style="margin:0; color:var(--text-muted); font-size:13px;">Tente ajustar os filtros ou cadastre um novo carro no estoque.</p>
            </div>
        `;
        gridView.innerHTML = `
            <div class="empty-state-container" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                <i data-lucide="package-search" style="width:48px; height:48px; stroke-width:1.5; color:var(--text-muted); margin-bottom:12px;"></i>
                <h4 style="margin:0 0 6px 0; color:var(--text-light); font-size:15px;">Nenhum veículo encontrado</h4>
                <p style="margin:0; color:var(--text-muted); font-size:13px;">Tente ajustar os filtros ou cadastre um novo carro no estoque.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    filteredCars.forEach(car => {
        const lucroEst = car.sellPrice - car.buyPrice;
        const margemEst = car.sellPrice > 0 ? (lucroEst / car.sellPrice) * 100 : 0;
        const days = calcDaysInStock(car.purchaseDate);
        const isParado = days > 30 && car.status !== 'vendido';
        const daysClass = isParado ? "stock-days alert" : "stock-days";
        const daysContent = isParado ? `<i data-lucide="alert-triangle"></i> ${days} dias` : `${days} d`;

        // Thumbnail mapping
        const carImages = parseCarImageUrls(car.image_url);
        const firstImageUrl = carImages.length > 0 ? carImages[0] : null;
        const thumbContent = firstImageUrl
            ? `<img src="${firstImageUrl}" alt="${car.model}" style="width:100%; height:100%; object-fit:cover;">`
            : `<i data-lucide="car"></i>`;

        let docColor = 'var(--yellow-warning)';
        let docTitle = 'Pendente';
        let docIcon = 'file-clock';
        if (car.documentStatus === 'sim') {
            docColor = 'var(--green-profit)';
            docTitle = 'Documento OK';
            docIcon = 'file-check';
        } else if (car.documentStatus === 'nao') {
            docColor = 'var(--red-alert)';
            docTitle = 'Sem Documento';
            docIcon = 'file-x';
        }

        // --- ROW (LIST) ---
        const listDiv = document.createElement("div");
        listDiv.className = "estoque-modern-row";
        listDiv.style.cursor = "pointer";
        listDiv.onclick = (e) => {
            if (e.target.closest('button')) return;
            openCarDetails(car.id);
        };
        listDiv.innerHTML = `
            <div class="col-veh">
                <div class="car-cell">
                    <div class="car-thumb">${thumbContent}</div>
                    <div class="car-info">
                        <h4>${car.model}</h4>
                        <div class="car-info-sub">
                            <span>ID: #${car.id}</span>
                            ${car.plate ? `<span class="car-sub-item">Placa: ${car.plate}</span>` : ''}
                            ${car.color ? `<span class="car-sub-item">Cor: ${car.color}</span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-doc">
                <div style="display:flex; justify-content:flex-start; align-items:center; color:${docColor};" title="${docTitle}">
                    <i data-lucide="${docIcon}" style="width:20px;height:20px;"></i>
                </div>
            </div>
            <div class="col-year" style="font-weight:500;">${car.year}</div>
            <div class="col-km" style="font-family:monospace; color:var(--text-light); font-weight:500;">${car.km.toLocaleString('pt-BR')} km</div>
            <div class="col-buy" style="font-family:monospace; color:var(--text-muted);">${formatCurrency(car.buyPrice)}</div>
            <div class="col-sell" style="font-family:monospace; font-weight:700; color:var(--blue-primary);">${formatCurrency(car.sellPrice)}</div>
            <div class="col-margin">
                <div style="font-weight:600; color: var(--green-profit); font-size:13px;">${formatCurrency(lucroEst)}</div>
                <div style="font-size:10px; color: var(--text-muted); font-weight:500;">${margemEst.toFixed(1)}% margem</div>
            </div>
            <div class="col-days">
                <span class="${daysClass}">${daysContent}</span>
            </div>
            <div class="col-type">
                <span class="badge ${car.type}">${car.type === 'repasse' ? 'repasse' : (car.type === 'outros' ? 'outros' : 'varejo')}</span>
            </div>
            <div class="col-status">
                <span class="badge ${car.status}">${car.status}</span>
            </div>
            <div class="col-actions" style="text-align: center;">
                <div style="display:flex; gap:6px; justify-content:center; align-items:center;">
                    <button class="btn btn-secondary" style="padding:6px; border-radius:8px;" onclick="window.openCarDetails(${car.id})" title="Ficha Técnica / Editar"><i data-lucide="pencil" style="width:14px;height:14px;"></i></button>
                    ${car.status !== 'vendido' 
                        ? `<button class="btn btn-success" style="padding:6px; border-radius:8px;" onclick="event.stopPropagation(); window.openCarDetailsForSale(${car.id})" title="Registrar Venda"><i data-lucide="badge-dollar-sign" style="width:14px;height:14px;"></i></button>`
                        : `<button class="btn btn-secondary" style="padding:6px; border-radius:8px; color:var(--blue-primary);" onclick="event.stopPropagation(); window.openCarDetailsForSale(${car.id});" title="Ver venda na ficha do veículo"><i data-lucide="badge-dollar-sign" style="width:14px;height:14px;"></i></button>`}
                    <button class="btn" style="padding:6px; border-radius:8px; background-color:rgba(239,68,68,0.12); color:var(--red-alert); border:1px solid rgba(239,68,68,0.18)" onclick="window.deleteCarConfirm(${car.id})" title="Excluir"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>
            </div>
        `;
        listBody.appendChild(listDiv);

        // --- CARD (GRID) ---
        const gridDiv = document.createElement("div");
        gridDiv.className = `estoque-grid-card ${car.status}`;
        gridDiv.onclick = (e) => {
            if (e.target.closest('button')) return;
            openCarDetails(car.id);
        };
        gridDiv.innerHTML = `
            <div class="card-image-wrapper">
                ${firstImageUrl ? `<img src="${firstImageUrl}" alt="${car.model}">` : `<div class="card-no-image"><i data-lucide="car"></i></div>`}
                <span class="badge-status ${car.status}">${car.status}</span>
                <span class="badge-type ${car.type}">${car.type === 'repasse' ? 'repasse' : (car.type === 'outros' ? 'outros' : 'varejo')}</span>
            </div>
            <div class="card-details-content">
                <h3 class="card-veh-title">${car.model}</h3>
                <div class="card-veh-meta">
                    <span>${car.year}</span>
                    <span>•</span>
                    <span>${car.km.toLocaleString('pt-BR')} km</span>
                    ${car.plate ? `<span>•</span><span>Placa: ${car.plate}</span>` : ''}
                </div>
                <div class="card-prices-row">
                    <div class="card-price-block">
                        <span class="price-lbl">Preço de Venda</span>
                        <span class="price-val">${formatCurrency(car.sellPrice)}</span>
                    </div>
                    <div class="card-days-badge ${daysClass}">
                        ${daysContent}
                    </div>
                </div>
                <div class="card-margins-row">
                    <span>Custo: ${formatCurrency(car.buyPrice)}</span>
                    <span style="color:var(--green-profit); font-weight:600;">Lucro Est: ${formatCurrency(lucroEst)} (${margemEst.toFixed(0)}%)</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:14px; border-top:1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:${docColor}; font-weight:500;">
                        <i data-lucide="${docIcon}" style="width:16px; height:16px;"></i> ${docTitle}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn btn-secondary btn-sm" onclick="window.openCarDetails(${car.id})"><i data-lucide="pencil" style="width:12px; height:12px; margin-right:4px;"></i> Editar</button>
                        ${car.status !== 'vendido' 
                            ? `<button class="btn btn-success btn-sm" onclick="event.stopPropagation(); window.openCarDetailsForSale(${car.id})"><i data-lucide="badge-dollar-sign" style="width:12px; height:12px; margin-right:4px;"></i> Vender</button>`
                            : `<button class="btn btn-secondary btn-sm" style="color:var(--blue-primary);" onclick="event.stopPropagation(); window.openCarDetailsForSale(${car.id});"><i data-lucide="badge-dollar-sign" style="width:12px; height:12px; margin-right:4px;"></i> Ver Venda</button>`}
                    </div>
                </div>
            </div>
        `;
        gridView.appendChild(gridDiv);
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Add car handlers
export function previewVehiclePhoto(input, previewId) {
    const previewContainer = document.getElementById(previewId);
    if (!previewContainer) return;
    
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            previewContainer.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;" />`;
            input.setAttribute('data-base64', e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

export function openAddCarModal() {
    const modal = document.getElementById("modal-add-car");
    if (!modal) return;
    modal.classList.add("active");
    
    // Clear inputs
    const form = document.getElementById("form-add-car");
    if (form) form.reset();
    
    const previewCircle = document.getElementById("car-photo-preview");
    if (previewCircle) {
        previewCircle.innerHTML = `<i data-lucide="image"></i>`;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
}

export function closeAddCarModal() {
    const modal = document.getElementById("modal-add-car");
    if (modal) modal.classList.remove("active");
}

export async function handleAddCar(event) {
    event.preventDefault();
    
    const modelInput = document.getElementById("car-brand-model");
    const yearInput = document.getElementById("car-year");
    const kmInput = document.getElementById("car-km");
    const buyPriceInput = document.getElementById("car-buy-val");
    const sellPriceInput = document.getElementById("car-sell-val");
    const purchaseDateInput = document.getElementById("car-purchase-date");
    const statusInput = document.getElementById("car-status");
    const typeInput = document.getElementById("car-type");
    const plateInput = document.getElementById("car-plate");
    const colorInput = document.getElementById("car-color");
    const chassisInput = document.getElementById("car-chassis");
    const renavamInput = document.getElementById("car-renavam");
    const documentStatusInput = document.getElementById("car-document");
    const photoInput = document.getElementById("car-photo-input");

    const model = modelInput ? modelInput.value.trim() : "";
    const year = yearInput ? yearInput.value.trim() : "";
    const km = kmInput ? (parseInt(kmInput.value) || 0) : 0;
    const buyPrice = buyPriceInput ? parseFloat(buyPriceInput.value) || 0 : 0;
    const sellPrice = sellPriceInput ? parseFloat(sellPriceInput.value) || 0 : 0;
    const purchaseDate = purchaseDateInput ? purchaseDateInput.value || null : null;
    const status = statusInput ? statusInput.value : "disponivel";
    const type = typeInput ? typeInput.value : "convencional";
    const plate = plateInput ? plateInput.value.trim().toUpperCase() : "";
    const color = colorInput ? colorInput.value.trim() : "";
    const chassis = chassisInput ? chassisInput.value.trim().toUpperCase() : "";
    const renavam = renavamInput ? renavamInput.value.trim() : "";
    const documentStatus = documentStatusInput ? documentStatusInput.value : "pendente";
    
    const imagesUrl = photoInput ? photoInput.getAttribute('data-base64') || null : null;

    const carData = {
        model, year, km, 
        buy_price: buyPrice,
        sell_price: sellPrice,
        purchase_date: purchaseDate || null,
        status, type,
        plate: plate || null,
        color: color || null,
        chassis: chassis || null,
        renavam: renavam || null,
        fipe_code: null,
        fipe_price: 0,
        notes: null,
        document_status: documentStatus || 'pendente',
        image_url: imagesUrl || null
    };

    const newCarLocal = {
        model, year, km,
        buyPrice, sellPrice,
        purchaseDate: purchaseDate || null,
        status, type,
        plate: plate || "",
        color: color || "",
        chassis: chassis || "",
        renavam: renavam || "",
        fipeCode: "",
        fipePrice: 0,
        notes: "",
        documentStatus: documentStatus || 'pendente',
        image_url: imagesUrl || null
    };

    let savedCar = null;
    try {
        const res = await fetch('/api/crm/estoque', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCarLocal)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.car) {
                savedCar = data.car;
                state.estoque.unshift(savedCar);
            }
        }
    } catch (error) { window.showToast?.(error.message || 'Não foi possível salvar.', 'error'); return; }

    if (!savedCar) { return; }

    if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
        try {
            await state.supabaseClient.from('estoque').insert([carData]);
        } catch (error) { window.showToast?.(error.message || 'Não foi possível salvar.', 'error'); return; }
    }

    persistLocalData();
    closeAddCarModal();
    window.updateApplicationState();
    if (window.showToast) {
        window.showToast(`Veículo "${model}" cadastrado e sincronizado com a nuvem!`, 'success');
    }
}

// Car Technical specifications page details
export function openCarDetails(id, originTab = null) {
    currentCdCarId = id;
    window.currentCdCarId = id;

    if (originTab) {
        carDetailsOriginTab = originTab;
    } else {
        const activeTabEl = document.querySelector('.tab-pane.active');
        if (activeTabEl && activeTabEl.id && activeTabEl.id !== 'car-details-tab') {
            carDetailsOriginTab = activeTabEl.id.replace('-tab', '');
        }
    }

    const car = state.estoque.find(c => c.id == id);
    if (!car) return;

    // Switch view to detailed specifications page
    switchDetailsTab('car-details');

    // Switch details inner tab to 'geral' by default
    switchCarDetailsTab('geral');

    // Populate Fields
    document.getElementById("cd-title").innerText = car.model;
    const cdIdBadge = document.getElementById("cd-id-badge");
    if (cdIdBadge) cdIdBadge.innerText = `ID: #${car.id}`;
    
    const cdMetaInfo = document.getElementById("cd-meta-info");
    if (cdMetaInfo) cdMetaInfo.innerText = `Ano: ${car.year} | Km: ${car.km.toLocaleString('pt-BR')} km`;
    
    // Status color badge
    const badgeStatus = document.getElementById("cd-status-badge");
    if (badgeStatus) {
        badgeStatus.className = `badge ${car.status}`;
        badgeStatus.innerText = car.status;
    }
    
    const badgeType = document.getElementById("cd-type-badge");
    if (badgeType) {
        badgeType.className = `badge ${car.type}`;
        badgeType.innerText = car.type === 'repasse' ? 'repasse' : (car.type === 'outros' ? 'outros' : 'varejo');
    }

    // Set cover photo/car thumbnail
    const coverWrapper = document.getElementById("cd-image-cover-wrapper");
    if (coverWrapper) {
        const carCoverImages = parseCarImageUrls(car.image_url);
        const firstImg = carCoverImages.length > 0 ? carCoverImages[0] : null;
        if (firstImg) {
            coverWrapper.innerHTML = `<img src="${firstImg}" alt="${car.model}" style="width:100%; height:100%; object-fit:cover; border-radius:16px;">`;
        } else {
            coverWrapper.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); background:var(--card-bg); border:1px dashed var(--border-color); border-radius:16px;">
                    <i data-lucide="image" style="width:48px; height:48px; margin-bottom:12px; stroke-width:1;"></i>
                    <span style="font-size:13px; font-weight:500;">Nenhuma Imagem Cadastrada</span>
                </div>
            `;
        }
    }

    // Spec sheets
    const cdSpecPlate = document.getElementById("cd-spec-plate");
    if (cdSpecPlate) cdSpecPlate.innerText = car.plate || "Não informada";
    
    const cdSpecColor = document.getElementById("cd-spec-color");
    if (cdSpecColor) cdSpecColor.innerText = car.color || "Não informada";
    
    const cdSpecKm = document.getElementById("cd-spec-km");
    if (cdSpecKm) cdSpecKm.innerText = `${car.km.toLocaleString('pt-BR')} km`;
    
    const cdSpecYear = document.getElementById("cd-spec-year");
    if (cdSpecYear) cdSpecYear.innerText = car.year;
    
    const cdSpecChassis = document.getElementById("cd-spec-chassis");
    if (cdSpecChassis) cdSpecChassis.innerText = car.chassis || "Não informado";
    
    const cdSpecRenavam = document.getElementById("cd-spec-renavam");
    if (cdSpecRenavam) cdSpecRenavam.innerText = car.renavam || "Não informado";
    
    const days = calcDaysInStock(car.purchaseDate);
    const dayBadge = document.getElementById("cd-spec-days");
    if (dayBadge) {
        dayBadge.innerText = `${days} dias`;
        dayBadge.className = days > 30 ? "stock-days alert" : "stock-days";
    }

    // Fill notes
    const cdSpecNotes = document.getElementById("cd-spec-notes");
    if (cdSpecNotes) cdSpecNotes.innerText = car.notes || "Nenhuma observação cadastrada para este veículo.";

    // Auto-heal corrupted prices from former input mask dividing bug
    if (car.sellPrice > 0 && car.sellPrice < 500) {
        if (car.fipePrice > 1000) {
            car.sellPrice = car.fipePrice;
        } else {
            car.sellPrice = Math.round(car.sellPrice * 10000);
        }
    }
    if (car.buyPrice > 0 && car.buyPrice < 500) {
        car.buyPrice = Math.round(car.buyPrice * 10000);
    }
    if (car.fipePrice > 0 && car.fipePrice < 500) {
        car.fipePrice = Math.round(car.fipePrice * 10000);
    }

    // Pricing card details
    const cdBuyPrice = document.getElementById("cd-buy-price");
    if (cdBuyPrice) cdBuyPrice.innerText = formatCurrency(car.buyPrice);
    
    const cdSellPrice = document.getElementById("cd-sell-price");
    if (cdSellPrice) cdSellPrice.innerText = formatCurrency(car.sellPrice);
    
    const profit = car.sellPrice - car.buyPrice;
    const margin = car.sellPrice > 0 ? (profit / car.sellPrice) * 100 : 0;
    
    const cdEstProfit = document.getElementById("cd-est-profit");
    if (cdEstProfit) cdEstProfit.innerText = formatCurrency(profit);
    
    const cdEstMargin = document.getElementById("cd-est-margin");
    if (cdEstMargin) cdEstMargin.innerText = `${margin.toFixed(1)}%`;

    // Populate Editable Inline Inputs
    const cdYear = document.getElementById("cd-year");
    if (cdYear) cdYear.value = car.year || "";

    const cdKm = document.getElementById("cd-km");
    if (cdKm) cdKm.value = car.km || 0;

    const cdBrand = document.getElementById("cd-brand");
    if (cdBrand) {
        cdBrand.value = car.brand || (car.model ? car.model.split(' ')[0] : "");
    }

    const cdModel = document.getElementById("cd-model");
    if (cdModel) {
        const parts = car.model ? car.model.split(' ') : [];
        cdModel.value = car.modelName || (parts.length > 1 ? parts.slice(1).join(' ') : car.model || "");
    }

    const cdColor = document.getElementById("cd-color");
    if (cdColor) cdColor.value = car.color || "";

    const cdPlate = document.getElementById("cd-plate");
    if (cdPlate) cdPlate.value = car.plate || "";

    const cdChassis = document.getElementById("cd-chassis");
    if (cdChassis) cdChassis.value = car.chassis || "";

    const cdRenavam = document.getElementById("cd-renavam");
    if (cdRenavam) cdRenavam.value = car.renavam || "";

    const cdDocument = document.getElementById("cd-document");
    if (cdDocument) cdDocument.value = car.documentStatus || "pendente";

    const cdType = document.getElementById("cd-type");
    if (cdType) cdType.value = car.type || "convencional";

    const cdStatusSelect = document.getElementById("cd-status-select");
    if (cdStatusSelect) cdStatusSelect.value = car.status || "disponivel";

    const cdFipeCode = document.getElementById("cd-fipe-code");
    if (cdFipeCode) cdFipeCode.value = car.fipeCode || "";

    const cdFipePrice = document.getElementById("cd-fipe-price");
    if (cdFipePrice) {
        window.formatCurrencyInput(cdFipePrice, car.fipePrice || 0);
    }

    const cdPurchaseDate = document.getElementById("cd-purchase-date");
    if (cdPurchaseDate) cdPurchaseDate.value = car.purchaseDate || "";

    const cdBuy = document.getElementById("cd-buy");
    if (cdBuy) {
        window.formatCurrencyInput(cdBuy, car.buyPrice || 0);
    }

    const cdSell = document.getElementById("cd-sell");
    if (cdSell) {
        window.formatCurrencyInput(cdSell, car.sellPrice || 0);
    }

    const cdNotes = document.getElementById("cd-notes");
    if (cdNotes) cdNotes.value = car.notes || "";

    // Fill edit fields automatically so edits can be triggered easily
    const editCarId = document.getElementById("edit-car-id");
    if (editCarId) editCarId.value = car.id;
    
    const editCarModel = document.getElementById("edit-car-model");
    if (editCarModel) editCarModel.value = car.model;
    
    const editCarYear = document.getElementById("edit-car-year");
    if (editCarYear) editCarYear.value = car.year;
    
    const editCarKm = document.getElementById("edit-car-km");
    if (editCarKm) editCarKm.value = car.km;
    
    const buyPriceEl = document.getElementById("edit-car-buyPrice");
    if (buyPriceEl) {
        window.formatCurrencyInput(buyPriceEl, car.buyPrice || 0);
    }
    const sellPriceEl = document.getElementById("edit-car-sellPrice");
    if (sellPriceEl) {
        window.formatCurrencyInput(sellPriceEl, car.sellPrice || 0);
    }

    const editCarPurchaseDate = document.getElementById("edit-car-purchaseDate");
    if (editCarPurchaseDate) editCarPurchaseDate.value = car.purchaseDate || "";
    
    const editCarStatus = document.getElementById("edit-car-status");
    if (editCarStatus) editCarStatus.value = car.status;
    
    const editCarType = document.getElementById("edit-car-type");
    if (editCarType) editCarType.value = car.type;
    
    const editCarPlate = document.getElementById("edit-car-plate");
    if (editCarPlate) editCarPlate.value = car.plate || "";
    
    const editCarColor = document.getElementById("edit-car-color");
    if (editCarColor) editCarColor.value = car.color || "";
    
    const editCarChassis = document.getElementById("edit-car-chassis");
    if (editCarChassis) editCarChassis.value = car.chassis || "";
    
    const editCarRenavam = document.getElementById("edit-car-renavam");
    if (editCarRenavam) editCarRenavam.value = car.renavam || "";
    
    const editCarFipeCode = document.getElementById("edit-car-fipe-code");
    if (editCarFipeCode) editCarFipeCode.value = car.fipeCode || "";
    
    const fipePriceEl = document.getElementById("edit-car-fipe-price");
    if (fipePriceEl) {
        window.formatCurrencyInput(fipePriceEl, car.fipePrice || 0);
    }

    const editCarNotes = document.getElementById("edit-car-notes");
    if (editCarNotes) editCarNotes.value = car.notes || "";
    
    const editCarDocumentStatus = document.getElementById("edit-car-document-status");
    if (editCarDocumentStatus) editCarDocumentStatus.value = car.documentStatus || "pendente";
    
    const editCarImage = document.getElementById("edit-car-image");
    if (editCarImage) editCarImage.value = car.image_url || "";

    // Slices rendering
    renderCarExpenses(car.id);
    renderCarDocuments(car.id);
    renderDetailsPhotos(car);
    calculateDetailsFinancials();
    updateDetailsStatusBadge();
    updateSummaryFields();
    renderCarSaleCard(car);
    initCarDetailsAutoSaveListeners();
    setAutoSaveStatus('saved');
    
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Inline details handlers
export function switchCarDetailsTab(tab) {
    document.querySelectorAll('.mobile-tab-section').forEach(sec => {
        sec.classList.remove('active');
    });
    const activeSec = document.querySelector(`.mobile-tab-section.tab-${tab}`);
    if (activeSec) activeSec.classList.add('active');

    document.querySelectorAll('.cd-pill-btn').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        if (onclickAttr.includes(`'${tab}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    document.querySelectorAll('.cd-mobile-tab-btn').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        if (onclickAttr.includes(`'${tab}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

export function updateDetailsStatusBadge() {
    const select = document.getElementById("cd-status-select");
    const badge = document.getElementById("cd-status");
    if (select && badge) {
        const status = select.value;
        badge.className = `badge ${status}`;
        badge.innerText = status.toUpperCase();
    }
}

export function updateSummaryFields() {
    const year = document.getElementById("cd-year")?.value || "-";
    const km = parseInt(document.getElementById("cd-km")?.value || "0");
    const type = document.getElementById("cd-type")?.value || "convencional";
    const plate = document.getElementById("cd-plate")?.value || "-";
    const color = document.getElementById("cd-color")?.value || "-";
    const sellPrice = parseCurrencyBR(document.getElementById("cd-sell")?.value || "0");

    const metaEl = document.getElementById("cd-meta-info");
    if (metaEl) {
        metaEl.innerText = `Ano: ${year} | Km: ${km.toLocaleString('pt-BR')} km`;
    }

    const priceEl = document.getElementById("cd-summary-price");
    if (priceEl) {
        priceEl.innerText = formatCurrency(sellPrice);
    }

    const badgeType = document.getElementById("cd-type-badge");
    if (badgeType) {
        badgeType.className = `badge ${type}`;
        badgeType.innerText = type === 'repasse' ? 'repasse' : (type === 'outros' ? 'outros' : 'varejo');
    }

    // Update Quick Hero Spec Pills
    const pillId = document.getElementById("pill-id");
    if (pillId) pillId.innerHTML = `<i data-lucide="hash"></i> ID: #${currentCdCarId || '-'}`;

    const pillYear = document.getElementById("pill-year");
    if (pillYear) pillYear.innerHTML = `<i data-lucide="calendar"></i> ${year}`;

    const pillKm = document.getElementById("pill-km");
    if (pillKm) pillKm.innerHTML = `<i data-lucide="milestone"></i> ${km.toLocaleString('pt-BR')} km`;

    const pillType = document.getElementById("pill-type");
    if (pillType) pillType.innerHTML = `<i data-lucide="tag"></i> ${type === 'repasse' ? 'Repasse' : (type === 'outros' ? 'Outros' : 'Varejo')}`;

    const pillPlate = document.getElementById("pill-plate");
    if (pillPlate) pillPlate.innerHTML = `<i data-lucide="credit-card"></i> ${plate || '-'}`;

    const pillColor = document.getElementById("pill-color");
    if (pillColor) pillColor.innerHTML = `<i data-lucide="palette"></i> ${color || '-'}`;

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

export function calculateDetailsFinancials() {
    if (!currentCdCarId) return;
    const buyVal = parseCurrencyBR(document.getElementById("cd-buy")?.value || "0");
    const sellVal = parseCurrencyBR(document.getElementById("cd-sell")?.value || "0");

    const expenses = (state.despesas || []).filter(d => 
        d.carId !== null && d.carId !== undefined && 
        (String(d.carId) === String(currentCdCarId) || String(d.car_id) === String(currentCdCarId))
    );
    const totalExpenses = expenses.reduce((sum, d) => sum + (Number(d.val) || 0), 0);

    const profit = sellVal - buyVal - totalExpenses;
    const margin = sellVal > 0 ? (profit / sellVal) * 100 : 0;

    const expensesEl = document.getElementById("cd-fin-expenses");
    if (expensesEl) expensesEl.innerText = formatCurrency(totalExpenses);

    const profitEl = document.getElementById("cd-profit");
    if (profitEl) {
        profitEl.innerText = formatCurrency(profit);
        profitEl.className = profit >= 0 ? "metric-val green" : "metric-val red";
    }

    const marginEl = document.getElementById("cd-margin");
    if (marginEl) marginEl.innerText = `${margin.toFixed(1)}%`;

    // Circular progress
    const circleBar = document.getElementById("profit-circle-bar");
    const circlePercentage = document.getElementById("profit-circle-percentage");
    const visualizerStatus = document.getElementById("profit-visualizer-status");

    if (circlePercentage) circlePercentage.innerText = `${margin.toFixed(0)}%`;
    
    if (circleBar) {
        const clampedMargin = Math.max(0, Math.min(100, margin));
        const offset = 314 - (314 * clampedMargin / 100);
        circleBar.style.strokeDashoffset = offset.toString();
        circleBar.style.stroke = profit >= 0 ? "var(--green-profit)" : "var(--red-alert)";
    }

    if (visualizerStatus) {
        if (profit < 0) {
            visualizerStatus.innerText = "Prejuízo";
            visualizerStatus.style.color = "var(--red-alert)";
        } else if (margin < 10) {
            visualizerStatus.innerText = "Margem Baixa";
            visualizerStatus.style.color = "var(--yellow-warning)";
        } else {
            visualizerStatus.innerText = "Excelente";
            visualizerStatus.style.color = "var(--green-profit)";
        }
    }

    // Calc days
    const purchaseDateVal = document.getElementById("cd-purchase-date")?.value;
    const days = calcDaysInStock(purchaseDateVal);
    const daysEl = document.getElementById("cd-days");
    if (daysEl) {
        daysEl.innerText = days.toString();
        daysEl.className = days > 30 ? "days-number alert" : "days-number";
    }
}

// Parse stored image URLs safely handling base64 data URLs, ||| separators, and legacy comma splits
export function parseCarImageUrls(imageUrlStr) {
    if (!imageUrlStr || typeof imageUrlStr !== 'string') return [];
    
    const trimmed = imageUrlStr.trim();
    if (!trimmed) return [];

    // 1. Separated by |||
    if (trimmed.includes('|||')) {
        return trimmed.split('|||').map(u => u.trim()).filter(Boolean);
    }

    // 2. Separated by newlines
    if (trimmed.includes('\n')) {
        return trimmed.split('\n').map(u => u.trim()).filter(Boolean);
    }

    // 3. Comma delimited string (need to handle data:image/...;base64, where comma is inside the header)
    const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    const urls = [];
    let i = 0;
    while (i < parts.length) {
        let part = parts[i];
        // Header without body
        if (part.startsWith('data:') && !part.includes(';base64,') && i + 1 < parts.length) {
            urls.push(part + ',' + parts[i + 1]);
            i += 2;
        } else if (part.startsWith('data:') && part.endsWith('base64') && i + 1 < parts.length) {
            urls.push(part + ',' + parts[i + 1]);
            i += 2;
        } else {
            if (!part.startsWith('data:') && !part.startsWith('http://') && !part.startsWith('https://') && !part.startsWith('/') && !part.startsWith('blob:')) {
                // If orphaned base64 payload from previous bad split
                if (part.length > 30 && /^[A-Za-z0-9+/=]+$/.test(part.substring(0, 30))) {
                    urls.push('data:image/jpeg;base64,' + part);
                }
            } else {
                urls.push(part);
            }
            i += 1;
        }
    }
    return urls;
}

export function joinCarImageUrls(urls) {
    if (!urls || !Array.isArray(urls)) return null;
    const clean = urls.map(u => typeof u === 'string' ? u.trim() : '').filter(Boolean);
    if (clean.length === 0) return null;
    return clean.join('|||');
}
window.parseCarImageUrls = parseCarImageUrls;
window.joinCarImageUrls = joinCarImageUrls;

export function removeSinglePhoto(idx) {
    if (currentCdCarId === null || currentCdCarId === undefined) return;
    const car = state.estoque.find(c => String(c.id) === String(currentCdCarId));
    if (!car) return;

    let images = parseCarImageUrls(car.image_url);
    if (idx >= 0 && idx < images.length) {
        images.splice(idx, 1);
        car.image_url = joinCarImageUrls(images);
        persistLocalData();
        renderDetailsPhotos(car);
        if (state.isCloudActive && state.supabaseClient) {
            state.supabaseClient.from('estoque').update({ image_url: car.image_url }).eq('id', currentCdCarId)
                .then(() => window.fetchCloudData && window.fetchCloudData())
                .catch(err => console.error("Erro ao atualizar fotos na nuvem:", err));
            return;
        }
    }
}
window.removeSinglePhoto = removeSinglePhoto;

export function renderDetailsPhotos(car) {
    const mainImg = document.getElementById("cd-main-img");
    const noImg = document.getElementById("cd-no-img");
    const thumbsContainer = document.getElementById("cd-thumbs");

    const images = parseCarImageUrls(car.image_url);

    if (images.length > 0) {
        if (mainImg) {
            mainImg.src = images[0];
            mainImg.style.display = "block";
        }
        if (noImg) noImg.style.display = "none";
    } else {
        if (mainImg) {
            mainImg.src = "";
            mainImg.style.display = "none";
        }
        if (noImg) noImg.style.display = "flex";
    }

    if (thumbsContainer) {
        thumbsContainer.innerHTML = "";
        images.forEach((url, idx) => {
            const thumb = document.createElement("div");
            thumb.className = `cd-thumb-item ${idx === 0 ? 'active' : ''}`;
            thumb.title = `Foto ${idx + 1} - Clique para ampliar`;
            thumb.innerHTML = `
                <img src="${url}" alt="Foto ${idx + 1}" onerror="this.onerror=null; this.parentElement.style.opacity='0.4';">
                <button type="button" class="cd-thumb-delete-btn" title="Remover esta foto" onclick="event.preventDefault(); event.stopPropagation(); window.removeSinglePhoto(${idx})">
                    <i data-lucide="x"></i>
                </button>
            `;
            thumb.onclick = (e) => {
                if (e.target.closest('.cd-thumb-delete-btn')) return;
                document.querySelectorAll('.cd-thumb-item').forEach(item => item.classList.remove('active'));
                thumb.classList.add('active');
                if (mainImg) {
                    mainImg.src = url;
                    mainImg.style.display = "block";
                }
                if (noImg) noImg.style.display = "none";
            };
            thumbsContainer.appendChild(thumb);
        });
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    // Update cover photo if wrapper exists
    const coverWrapper = document.getElementById("cd-image-cover-wrapper");
    if (coverWrapper) {
        if (images.length > 0) {
            coverWrapper.innerHTML = `<img src="${images[0]}" alt="${car.model}" style="width:100%; height:100%; object-fit:cover; border-radius:16px;">`;
        } else {
            coverWrapper.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-muted); background:var(--card-bg); border:1px dashed var(--border-color); border-radius:16px;">
                    <i data-lucide="image" style="width:48px; height:48px; margin-bottom:12px; stroke-width:1;"></i>
                    <span style="font-size:13px; font-weight:500;">Nenhuma Imagem Cadastrada</span>
                </div>
            `;
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        }
    }
}

export function previewDetailsPhotos(input) {
    if (!input.files || input.files.length === 0) return;
    
    const car = state.estoque.find(c => c.id == currentCdCarId);
    if (!car) return;

    let currentImages = parseCarImageUrls(car.image_url);

    let loadedCount = 0;
    const files = Array.from(input.files);

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            if (base64) {
                currentImages.push(base64);
            }
            loadedCount++;
            if (loadedCount === files.length) {
                car.image_url = joinCarImageUrls(currentImages);
                persistLocalData();
                renderDetailsPhotos(car);
                if (state.isCloudActive && state.supabaseClient) {
                    state.supabaseClient.from('estoque').update({ image_url: car.image_url }).eq('id', currentCdCarId)
                        .then(() => {
                            if (window.fetchCloudData) window.fetchCloudData();
                        })
                        .catch(err => console.error(err));
            return;
                }
                input.value = '';
            }
        };
        reader.readAsDataURL(file);
    });
}

export function clearCarPhotos() {
    if (!currentCdCarId) return;
    showCustomConfirm(
        "Remover Fotos",
        "Tem certeza que deseja remover todas as fotos deste veículo?",
        async () => {
            const car = state.estoque.find(c => c.id == currentCdCarId);
            if (!car) return;
            car.image_url = null;
            persistLocalData();
            renderDetailsPhotos(car);
            if (state.isCloudActive) {
                state.supabaseClient.from('estoque').update({ image_url: null }).eq('id', currentCdCarId)
                    .then(() => window.fetchCloudData())
                    .catch(err => console.error(err));
            return;
            }
        },
        "Remover"
    );
}

export function appendQuickNote(text) {
    const textarea = document.getElementById("cd-notes");
    if (textarea) {
        const currentVal = textarea.value.trim();
        if (currentVal) {
            textarea.value = currentVal + "\n" + text;
        } else {
            textarea.value = text;
        }
        triggerCarDetailsAutoSave(0);
    }
}

export async function quickFipeSearch() {
    const code = document.getElementById("cd-fipe-code")?.value.trim();
    if (!code) return;
    try {
        const response = await fetch(`https://brasilapi.com.br/api/fipe/preco/v1/${code}`);
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            const item = data[0];
            const price = parseFloat(item.valor.replace(/[^\d]/g, "")) / 100;
            const fipePriceEl = document.getElementById("cd-fipe-price");
            if (fipePriceEl) {
                window.formatCurrencyInput(fipePriceEl, price);
                triggerCarDetailsAutoSave(0);
            }
        }
    } catch (e) {
        console.error("FIPE lookup failed", e);
            return;
    }
}

// Auto-Save Management for Car Details Screen
let autoSaveDebounceTimer = null;
let isAutoSaving = false;
let pendingAutoSave = false;
let carDetailsAutoSaveInitialized = false;

export function triggerCarDetailsAutoSave(delay = 400) {
    if (!currentCdCarId) return;

    // Immediately update live computed previews on screen
    updateSummaryFields();
    calculateDetailsFinancials();
    updateDetailsStatusBadge();

    // Show 'Salvando...' status indicator
    setAutoSaveStatus('saving');

    if (autoSaveDebounceTimer) {
        clearTimeout(autoSaveDebounceTimer);
    }

    if (delay === 0) {
        saveCarDetails({ silent: true });
    } else {
        autoSaveDebounceTimer = setTimeout(() => {
            saveCarDetails({ silent: true });
        }, delay);
    }
}

export function setAutoSaveStatus(status) {
    const indicator = document.getElementById("cd-autosave-status");
    const icon = document.getElementById("cd-autosave-icon");
    const text = document.getElementById("cd-autosave-text");
    if (!indicator || !text || !icon) return;

    if (status === 'saving') {
        icon.setAttribute('data-lucide', 'refresh-cw');
        icon.classList.add('spin-animation');
        icon.style.color = 'var(--blue-primary)';
        text.innerText = 'Salvando...';
    } else if (status === 'saved') {
        icon.setAttribute('data-lucide', 'cloud-check');
        icon.classList.remove('spin-animation');
        icon.style.color = 'var(--green-profit)';
        text.innerText = 'Salvo automaticamente';
    } else if (status === 'error') {
        icon.setAttribute('data-lucide', 'alert-circle');
        icon.classList.remove('spin-animation');
        icon.style.color = '#ef4444';
        text.innerText = 'Erro ao salvar';
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

export function initCarDetailsAutoSaveListeners() {
    const tab = document.getElementById("car-details-tab");
    if (!tab || carDetailsAutoSaveInitialized) return;
    carDetailsAutoSaveInitialized = true;

    // Listen to input events (typing in text, numbers, textarea, contenteditable)
    tab.addEventListener("input", (e) => {
        if (e.target.type === 'file' || e.target.id === 'fipe-search-input') return;
        triggerCarDetailsAutoSave(400);
    });

    // Listen to change events (selects, dates, finalized fields)
    tab.addEventListener("change", (e) => {
        if (e.target.type === 'file' || e.target.id === 'fipe-search-input') return;
        triggerCarDetailsAutoSave(0);
    });

    // Listen to blur events on editable title
    const cdTitle = document.getElementById("cd-title");
    if (cdTitle) {
        cdTitle.addEventListener("blur", () => {
            triggerCarDetailsAutoSave(0);
        });
    }
}

export async function saveCarDetails(options = { silent: true }) {
    if (!currentCdCarId) return;
    const car = state.estoque.find(c => c.id == currentCdCarId);
    if (!car) return;

    if (isAutoSaving) {
        pendingAutoSave = true;
        return;
    }
    isAutoSaving = true;

    const inputBrand = document.getElementById("cd-brand")?.value.trim() || "";
    const inputModel = document.getElementById("cd-model")?.value.trim() || "";
    let model = document.getElementById("cd-title")?.innerText.trim() || car.model || "";
    if (inputBrand || inputModel) {
        model = [inputBrand, inputModel].filter(Boolean).join(' ');
        const cdTitleEl = document.getElementById("cd-title");
        if (cdTitleEl && cdTitleEl.innerText !== model && document.activeElement !== cdTitleEl) {
            cdTitleEl.innerText = model;
        }
    }

    const year = document.getElementById("cd-year")?.value.trim() || car.year || "";
    const km = parseInt(document.getElementById("cd-km")?.value) || 0;
    const color = document.getElementById("cd-color")?.value.trim() || "";
    const plate = document.getElementById("cd-plate")?.value.trim().toUpperCase() || "";
    const chassis = document.getElementById("cd-chassis")?.value.trim().toUpperCase() || "";
    const renavam = document.getElementById("cd-renavam")?.value.trim() || "";
    const documentStatus = document.getElementById("cd-document")?.value || car.documentStatus || "pendente";
    const type = document.getElementById("cd-type")?.value || car.type || "convencional";
    const status = document.getElementById("cd-status-select")?.value || car.status || "disponivel";
    const fipeCode = document.getElementById("cd-fipe-code")?.value.trim() || "";
    const fipePrice = parseCurrencyBR(document.getElementById("cd-fipe-price")?.value) || 0;
    const purchaseDate = document.getElementById("cd-purchase-date")?.value || null;
    const buyPrice = parseCurrencyBR(document.getElementById("cd-buy")?.value) || 0;
    const sellPrice = parseCurrencyBR(document.getElementById("cd-sell")?.value) || 0;
    const notes = document.getElementById("cd-notes")?.value.trim() || "";

    const carData = {
        model,
        year,
        km,
        buy_price: buyPrice,
        sell_price: sellPrice,
        purchase_date: purchaseDate,
        status,
        type,
        plate: plate || null,
        color: color || null,
        chassis: chassis || null,
        renavam: renavam || null,
        fipe_code: fipeCode || null,
        fipe_price: fipePrice,
        notes: notes || null,
        document_status: documentStatus,
        image_url: car.image_url
    };

    // Update in-memory state immediately
    car.model = model;
    car.brand = inputBrand;
    car.modelName = inputModel;
    car.year = year;
    car.km = km;
    car.color = color;
    car.plate = plate;
    car.chassis = chassis;
    car.renavam = renavam;
    car.documentStatus = documentStatus;
    car.type = type;
    car.status = status;
    car.fipeCode = fipeCode;
    car.fipePrice = fipePrice;
    car.purchaseDate = purchaseDate;
    car.buyPrice = buyPrice;
    car.sellPrice = sellPrice;
    car.notes = notes;

    // Check if there is an existing sale linked to this car and sync any edited sale details
    const existingSale = (state.vendas || []).find(v => (String(v.carId) === String(car.id) || String(v.car_id) === String(car.id)));
    if (existingSale) {
        const sellClient = (document.getElementById("cd-sell-client")?.value || "").trim();
        const sellDoc = (document.getElementById("cd-sell-doc")?.value || "").trim();
        const sellDate = document.getElementById("cd-sell-date")?.value || "";
        const sellType = document.getElementById("cd-sell-type")?.value || "convencional";
        const rawSellerCnpj = document.getElementById("cd-sell-seller-cnpj")?.value;
        const customSellerCnpj = document.getElementById("cd-sell-seller-cnpj-custom")?.value;
        const sellerCnpj = (rawSellerCnpj === 'custom' ? customSellerCnpj : (rawSellerCnpj || "")).trim();
        
        const despesasCarro = (state.despesas || []).filter(d => String(d.carId) === String(car.id)).reduce((sum, d) => sum + d.val, 0);
        const saleProfit = sellPrice - (buyPrice || 0) - despesasCarro;
        const saleMargin = sellPrice > 0 ? (saleProfit / sellPrice) * 100 : 0;

        if (sellClient) {
            existingSale.client = sellClient;
            existingSale.clientDocument = sellDoc;
            existingSale.date = sellDate;
            existingSale.type = sellType;
            existingSale.sellerCnpj = sellerCnpj;
            existingSale.seller_cnpj = sellerCnpj;
            existingSale.sellPrice = sellPrice;
            existingSale.profit = saleProfit;
            existingSale.margin = saleMargin;

            fetch(`/api/crm/vendas/${existingSale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client: sellClient,
                    clientDocument: sellDoc,
                    sellerCnpj,
                    seller_cnpj: sellerCnpj,
                    sellPrice,
                    profit: saleProfit,
                    margin: saleMargin,
                    date: sellDate,
                    type: sellType
                })
            }).catch(error => { window.showToast?.(error.message, 'error'); });

            if (state.isCloudActive && state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
                try {
                    const saleUpdateData = { client: sellClient, sell_price: sellPrice, profit: saleProfit, margin: saleMargin, date: sellDate, type: sellType };
                    if (sellDoc) saleUpdateData.client_document = sellDoc;
                    if (sellerCnpj) saleUpdateData.seller_cnpj = sellerCnpj;
                    state.supabaseClient.from('vendas').update(saleUpdateData).eq('id', existingSale.id).then(() => {});
                } catch (e) {
                    console.error("Erro ao auto-salvar venda:", e);
            return;
                }
            }
        }
    }

    if (state.isCloudActive && state.supabaseClient) {
        try {
            const { error } = await state.supabaseClient.from('estoque').update(carData).eq('id', currentCdCarId);
            if (error) throw error;
            setAutoSaveStatus('saved');
        } catch (e) {
            console.error("Erro ao atualizar o veículo na nuvem:", e);
            setAutoSaveStatus('error');
        }
    } else {
        persistLocalData();
        setAutoSaveStatus('saved');
    }

    isAutoSaving = false;
    if (pendingAutoSave) {
        pendingAutoSave = false;
        triggerCarDetailsAutoSave(300);
    }
}

export { handleAddCar as saveNewCar };
export { openCarDetails as editCarDetails };
export { saveCarDetails as saveEditCarDetails };

export function closeCarDetails() {
    const origin = carDetailsOriginTab || 'estoque';
    if (window.switchTab) {
        window.switchTab(origin);
    } else {
        switchDetailsTab('inventory-list');
    }
    currentCdCarId = null;
}

// Subtab switcher inside Spec specifications page
export function switchDetailsTab(view) {
    const specsPane = document.getElementById("car-details-specs-pane");
    const docsPane = document.getElementById("car-details-docs-pane");
    const expensesPane = document.getElementById("car-details-expenses-pane");
    const editPane = document.getElementById("car-details-edit-pane");
    
    if (view === 'inventory-list') {
        if (window.switchTab) {
            window.switchTab('estoque');
        } else {
            const specDetailsSection = document.getElementById("car-details-tab");
            if (specDetailsSection) specDetailsSection.classList.remove("active");
            const estoqueSection = document.getElementById("estoque-tab");
            if (estoqueSection) estoqueSection.classList.add("active");
        }
        return;
    }

    if (window.switchTab) {
        window.switchTab('car-details');
    } else {
        const estoqueSection = document.getElementById("estoque-tab");
        if (estoqueSection) estoqueSection.classList.remove("active");
        const specDetailsSection = document.getElementById("car-details-tab");
        if (specDetailsSection) specDetailsSection.classList.add("active");
    }

    // Clear and toggle subpanes inside Specs Page
    const subpanes = [specsPane, docsPane, expensesPane, editPane];
    subpanes.forEach(p => { if (p) p.style.display = "none"; });

    const menuItems = document.querySelectorAll(".cd-nav-item");
    menuItems.forEach(item => item.classList.remove("active"));

    if (view === 'car-details') {
        if (specsPane) specsPane.style.display = "block";
        const btn = document.querySelector('.cd-nav-item[onclick*="car-details"]');
        if (btn) btn.classList.add("active");
    } else if (view === 'car-docs') {
        if (docsPane) docsPane.style.display = "block";
        const btn = document.querySelector('.cd-nav-item[onclick*="car-docs"]');
        if (btn) btn.classList.add("active");
    } else if (view === 'car-expenses') {
        if (expensesPane) expensesPane.style.display = "block";
        const btn = document.querySelector('.cd-nav-item[onclick*="car-expenses"]');
        if (btn) btn.classList.add("active");
    } else if (view === 'car-edit') {
        if (editPane) editPane.style.display = "block";
        const btn = document.querySelector('.cd-nav-item[onclick*="car-edit"]');
        if (btn) btn.classList.add("active");
    }
}

// Delete confirm dialog
export async function deleteCarConfirm(id) {
    showCustomConfirm(
        "Excluir Veículo",
        "Tem certeza que deseja excluir permanentemente este veículo do sistema?",
        async () => {
            try {
                await fetch(`/api/crm/estoque/${id}`, { method: 'DELETE' });
            } catch (error) { window.showToast?.(error.message || 'Não foi possível salvar.', 'error'); return; }

            if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
                try {
                    await state.supabaseClient.from('estoque').delete().eq('id', id);
                } catch (error) { window.showToast?.(error.message || 'Não foi possível salvar.', 'error'); return; }
            }

            state.estoque = state.estoque.filter(c => String(c.id) !== String(id));
            persistLocalData();
            closeCarDetails();
            window.updateApplicationState();
            if (window.showToast) {
                window.showToast("Veículo removido com sucesso!", "success");
            }
        },
        "Excluir Veículo"
    );
}

// Render sub-expenses for spec page
export function renderCarExpenses(carId) {
    const listContainer = document.getElementById("cd-expenses-list");
    if (!listContainer) return;

    const filteredExpenses = (state.despesas || []).filter(d => 
        d.carId !== null && d.carId !== undefined && 
        (String(d.carId) === String(carId) || String(d.car_id) === String(carId))
    );
    const sum = filteredExpenses.reduce((acc, d) => acc + (Number(d.val) || 0), 0);

    const totalEl = document.getElementById("cd-expenses-total");
    if (totalEl) {
        totalEl.innerText = formatCurrency(sum);
    }

    if (filteredExpenses.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:32px; color:var(--text-muted);">
                <i data-lucide="receipt" style="width:32px; height:32px; margin-bottom:8px; opacity:0.5;"></i>
                <div style="font-size:13px;">Nenhuma despesa lançada para este veículo</div>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    listContainer.innerHTML = filteredExpenses.map(d => {
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--body-bg); border-radius:8px; border:1px solid var(--border-color); margin-bottom:8px;">
                <div>
                    <span style="font-size:11px; font-weight:600; text-transform:uppercase; background:rgba(59,130,246,0.12); color:var(--blue-primary); padding:2px 6px; border-radius:4px; margin-right:8px;">${d.category}</span>
                    <strong style="color:var(--text-light); font-size:13px;">${d.desc}</strong>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Data: ${d.date ? d.date.split('-').reverse().join('/') : '-'}</div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-family:monospace; font-weight:700; color:var(--red-alert); font-size:13px;">- ${formatCurrency(d.val)}</span>
                    <button class="btn btn-icon btn-secondary btn-sm" onclick="window.deleteDespesaFromDetails('${d.id}')" style="color:var(--red-alert); border-color:rgba(239,68,68,0.15);"><i data-lucide="trash-2" style="width:12px; height:12px;"></i></button>
                </div>
            </div>
        `;
    }).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

export async function addCarExpenseInline() {
    const activeCarId = currentCdCarId || window.currentCdCarId;
    if (!activeCarId) {
        alert("Nenhum veículo selecionado para lançar o custo.");
        return;
    }

    const descInput = document.getElementById("cd-quick-exp-desc");
    const catInput = document.getElementById("cd-quick-exp-cat");
    const valInput = document.getElementById("cd-quick-exp-val");
    const dateInput = document.getElementById("cd-quick-exp-date");

    const desc = descInput?.value.trim() || '';
    const val = parseCurrencyBR(valInput?.value || '0');
    const date = dateInput?.value || new Date().toISOString().split('T')[0];
    const category = catInput?.value || 'Preparação';

    if (!desc) {
        alert("Por favor, informe a descrição do custo (ex: Troca de óleo, Polimento, Martelinho).");
        if (descInput) descInput.focus();
        return;
    }
    if (val <= 0) {
        alert("Por favor, informe um valor válido para a despesa.");
        if (valInput) valInput.focus();
        return;
    }

    const parsedCarId = parseId(activeCarId);
    const newId = state.despesas.length > 0 ? Math.max(...state.despesas.map(d => Number(d.id) || 0)) + 1 : 1;
    const newDespesaLocal = { id: newId, desc, carId: parsedCarId, date, val, category };

    state.despesas.push(newDespesaLocal);
    persistLocalData();

    if (state.isCloudActive && state.supabaseClient) {
        try {
            const despesaData = {
                description: desc,
                car_id: parsedCarId,
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
            return;
        }
    }

    // Reset quick inputs
    if (descInput) descInput.value = '';
    if (valInput) valInput.value = '';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Refresh expenses and financials immediately
    renderCarExpenses(activeCarId);
    calculateDetailsFinancials();
    if (typeof setAutoSaveStatus === 'function') {
        setAutoSaveStatus('saved');
    }
    window.updateApplicationState();
}

// Helper for custom confirm modal
export function showCustomConfirm(title, message, onConfirm, okText = "Excluir") {
    const modal = document.getElementById("modal-global-confirm");
    if (!modal) {
        if (onConfirm) onConfirm();
        return;
    }

    const titleEl = document.getElementById("confirm-modal-title");
    const msgEl = document.getElementById("confirm-modal-message");
    const okBtn = document.getElementById("confirm-modal-ok-btn");
    const cancelBtn = document.getElementById("confirm-modal-cancel-btn");

    if (titleEl) titleEl.innerText = title || "Confirmar Ação";
    if (msgEl) msgEl.innerText = message || "Tem certeza?";

    const closeModal = () => {
        modal.classList.remove("active");
    };

    if (okBtn) {
        okBtn.innerText = okText;
        const newOkBtn = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOkBtn, okBtn);
        newOkBtn.addEventListener("click", async () => {
            closeModal();
            if (onConfirm) await onConfirm();
        });
    }

    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener("click", () => {
            closeModal();
        });
    }

    modal.classList.add("active");
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}
window.showCustomConfirm = showCustomConfirm;

// Helper for converting base64 data URLs to Blob
function dataURLtoBlob(dataurl) {
    if (!dataurl || typeof dataurl !== 'string' || !dataurl.includes(',')) return null;
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Erro ao converter dataURL para Blob:", e);
        return null;
    }
}

// Open document safely using in-app preview modal
export function openCarDoc(docId) {
    const doc = state.documentosVeiculo.find(d => String(d.id) === String(docId));
    if (!doc || !doc.fileUrl || doc.fileUrl === '#') {
        alert("Arquivo indisponível.");
        return;
    }

    const modal = document.getElementById("modal-view-document");
    const previewBody = document.getElementById("doc-preview-body");
    const previewTitle = document.getElementById("doc-preview-title");
    const downloadBtn = document.getElementById("doc-preview-download-btn");

    if (!modal || !previewBody) {
        downloadCarDoc(docId);
        return;
    }

    if (previewTitle) {
        previewTitle.innerText = doc.fileName || doc.description || "Visualizar Documento";
    }

    if (downloadBtn) {
        downloadBtn.onclick = () => downloadCarDoc(docId);
    }

    const ext = (doc.fileName || '').split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext) || doc.fileUrl.startsWith('data:image/');
    const isPdf = ext === 'pdf' || doc.fileUrl.startsWith('data:application/pdf');

    if (isImage) {
        previewBody.innerHTML = `<img src="${doc.fileUrl}" alt="${doc.fileName || 'Documento'}" style="max-width:100%; max-height:68vh; object-fit:contain; border-radius:8px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" />`;
    } else if (isPdf) {
        previewBody.innerHTML = `<iframe src="${doc.fileUrl}" style="width:100%; height:62vh; border:none; border-radius:8px; background:#ffffff;"></iframe>`;
    } else {
        previewBody.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <i data-lucide="file-text" style="width:56px; height:56px; color: var(--blue-primary); margin-bottom: 16px;"></i>
                <p style="font-size:15px; font-weight:600; color:var(--text-primary); margin-bottom:6px;">${doc.fileName || 'Documento Anexado'}</p>
                <p style="font-size:13px; color:var(--text-muted); margin-bottom:20px;">Pré-visualização direta não suportada para este formato.</p>
                <button class="btn btn-primary" onclick="window.downloadCarDoc('${docId}')"><i data-lucide="download"></i> Baixar Arquivo</button>
            </div>
        `;
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }

    modal.classList.add("active");
}
window.openCarDoc = openCarDoc;

export function closeDocPreviewModal() {
    const modal = document.getElementById("modal-view-document");
    if (modal) {
        modal.classList.remove("active");
    }
}
window.closeDocPreviewModal = closeDocPreviewModal;

// Download document safely without navigating iframe to data URIs
export async function downloadCarDoc(docId) {
    const doc = state.documentosVeiculo.find(d => String(d.id) === String(docId));
    if (!doc || !doc.fileUrl || doc.fileUrl === '#') {
        return;
    }

    const fileName = doc.fileName || 'documento';

    try {
        if (doc.fileUrl.startsWith('data:')) {
            const blob = dataURLtoBlob(doc.fileUrl);
            const blobUrl = blob ? URL.createObjectURL(blob) : doc.fileUrl;
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                if (document.body.contains(a)) document.body.removeChild(a);
                if (blob) URL.revokeObjectURL(blobUrl);
            }, 300);
        } else {
            try {
                const response = await fetch(doc.fileUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = fileName;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) document.body.removeChild(a);
                    URL.revokeObjectURL(blobUrl);
                }, 300);
            } catch (err) {
                const a = document.createElement('a');
                a.href = doc.fileUrl;
                a.download = fileName;
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    if (document.body.contains(a)) document.body.removeChild(a);
                }, 300);
            }
        }
    } catch (e) {
        console.error("Erro ao baixar documento:", e);
            return;
    }
}
window.downloadCarDoc = downloadCarDoc;

export let currentDocViewMode = 'grid'; // 'grid' | 'list'
export let currentDocSearchQuery = '';

export function setCarDocViewMode(mode) {
    currentDocViewMode = mode;
    const gridBtn = document.getElementById("cd-docs-view-grid-btn");
    const listBtn = document.getElementById("cd-docs-view-list-btn");
    if (gridBtn) gridBtn.classList.toggle("active", mode === 'grid');
    if (listBtn) listBtn.classList.toggle("active", mode === 'list');

    if (currentCdCarId) {
        renderCarDocuments(currentCdCarId);
    }
}
window.setCarDocViewMode = setCarDocViewMode;

export function filterCarDocuments(query) {
    currentDocSearchQuery = (query || '').toLowerCase().trim();
    if (currentCdCarId) {
        renderCarDocuments(currentCdCarId);
    }
}
window.filterCarDocuments = filterCarDocuments;

// Render uploaded documents in horizontal thumbnail grid or space-saving list mode
export function renderCarDocuments(carId) {
    const listContainer = document.getElementById("cd-documents-list") || document.getElementById("cd-docs-list");
    if (!listContainer) return;

    const allDocs = (state.documentosVeiculo || []).filter(d => String(d.carId || d.car_id) === String(carId));

    // Update document count badge
    const badge = document.getElementById("cd-docs-count-badge");
    if (badge) {
        badge.innerText = `${allDocs.length} ${allDocs.length === 1 ? 'doc' : 'docs'}`;
    }

    if (allDocs.length === 0) {
        listContainer.className = "premium-documents-dynamic-list grid-mode";
        listContainer.innerHTML = `
            <div style="text-align:center; padding:28px 16px; color:var(--text-muted); width:100%; grid-column: 1 / -1;">
                <i data-lucide="files" style="width:32px; height:32px; margin-bottom:8px; opacity:0.5;"></i>
                <div style="font-size:13px; font-weight:500;">Nenhum documento anexado ainda para este veículo.</div>
                <div style="font-size:11px; opacity:0.8; margin-top:3px;">Clique em "Anexar PDF/Foto" para salvar CRLVs, contratos ou laudos.</div>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    // Apply search filter
    const filteredDocs = currentDocSearchQuery
        ? allDocs.filter(d => (d.fileName || '').toLowerCase().includes(currentDocSearchQuery) || (d.description || '').toLowerCase().includes(currentDocSearchQuery))
        : allDocs;

    if (filteredDocs.length === 0) {
        listContainer.className = "premium-documents-dynamic-list grid-mode";
        listContainer.innerHTML = `
            <div style="text-align:center; padding:20px 16px; color:var(--text-muted); width:100%; grid-column: 1 / -1;">
                <i data-lucide="search-x" style="width:28px; height:28px; margin-bottom:6px; opacity:0.5;"></i>
                <div style="font-size:13px; font-weight:500;">Nenhum documento encontrado para "${currentDocSearchQuery}".</div>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    listContainer.className = `premium-documents-dynamic-list ${currentDocViewMode === 'list' ? 'list-mode' : 'grid-mode'}`;

    if (currentDocViewMode === 'list') {
        // Ultra-compact List Row Layout
        const listHtml = filteredDocs.map(d => {
            const ext = (d.fileName || '').split('.').pop().toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
            const isPdf = ext === 'pdf';
            const hasValidUrl = d.fileUrl && d.fileUrl !== '#';
            const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('pt-BR') : '';

            let iconClass = 'pdf';
            let iconName = 'file-text';
            if (isImage) {
                iconClass = 'image';
                iconName = 'file-image';
            } else if (!isPdf) {
                iconClass = '';
                iconName = 'file';
            }

            return `
                <div class="doc-list-row" id="doc-card-${d.id}">
                    <div class="doc-list-row-left">
                        <div class="doc-list-icon-badge ${iconClass}">
                            <i data-lucide="${iconName}" style="width:16px; height:16px;"></i>
                        </div>
                        <div class="doc-list-details">
                            <span class="doc-list-title" title="${d.fileName}">${d.fileName}</span>
                            <span class="doc-list-meta">${d.description || 'Documento'} ${dateStr ? '• ' + dateStr : ''} (${ext.toUpperCase()})</span>
                        </div>
                    </div>
                    <div class="doc-list-actions">
                        ${hasValidUrl ? `<button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.openCarDoc('${d.id}')" class="doc-thumb-btn view" title="Visualizar / Acessar"><i data-lucide="eye" style="width:12px;height:12px;"></i> Abrir</button>` : ''}
                        ${hasValidUrl ? `<button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.downloadCarDoc('${d.id}')" class="doc-thumb-btn download" title="Baixar Arquivo"><i data-lucide="download" style="width:12px;height:12px;"></i> Baixar</button>` : ''}
                        <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.deleteCarDoc('${d.id}')" class="doc-thumb-btn delete" title="Remover Documento"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
                    </div>
                </div>
            `;
        }).join('');
        listContainer.innerHTML = listHtml;
    } else {
        // Grid/Cards Mode Layout
        const cardsHtml = filteredDocs.map(d => {
            const ext = (d.fileName || '').split('.').pop().toLowerCase();
            const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
            const isPdf = ext === 'pdf';
            const hasValidUrl = d.fileUrl && d.fileUrl !== '#';

            let previewContent = '';
            if (isImage && hasValidUrl) {
                previewContent = `
                    <img src="${d.fileUrl}" alt="${d.fileName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div class="doc-thumb-icon-placeholder" style="display:none;">
                        <i data-lucide="file-image" style="width:28px; height:28px; color:var(--blue-primary);"></i>
                    </div>
                `;
            } else if (isPdf) {
                previewContent = `
                    <div class="doc-thumb-icon-placeholder">
                        <i data-lucide="file-text" style="width:32px; height:32px; color:#ef4444;"></i>
                        <span style="font-size:10px; font-weight:700; color:#ef4444; letter-spacing:0.5px;">DOCUMENTO PDF</span>
                    </div>
                `;
            } else {
                previewContent = `
                    <div class="doc-thumb-icon-placeholder">
                        <i data-lucide="${isImage ? 'file-image' : 'file'}" style="width:30px; height:30px; color:var(--blue-primary);"></i>
                        <span style="font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase;">${ext || 'DOC'}</span>
                    </div>
                `;
            }

            const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('pt-BR') : '';

            return `
                <div class="doc-thumb-card" id="doc-card-${d.id}">
                    <div class="doc-thumb-preview">
                        ${previewContent}
                        <span class="doc-thumb-badge-ext">${ext || 'doc'}</span>
                    </div>
                    <div class="doc-thumb-info">
                        <div>
                            <div class="doc-thumb-title" title="${d.fileName}">${d.fileName}</div>
                            <div class="doc-thumb-desc" title="${d.description || 'Documento'}">${d.description || 'Documento Técnico'} ${dateStr ? '• ' + dateStr : ''}</div>
                        </div>
                        <div class="doc-thumb-actions">
                            ${hasValidUrl ? `<button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.openCarDoc('${d.id}')" class="doc-thumb-btn view" title="Visualizar / Acessar"><i data-lucide="eye" style="width:12px;height:12px;"></i> Abrir</button>` : `<button disabled class="doc-thumb-btn view" style="opacity:0.5; cursor:not-allowed;"><i data-lucide="eye" style="width:12px;height:12px;"></i> Indisponível</button>`}
                            ${hasValidUrl ? `<button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.downloadCarDoc('${d.id}')" class="doc-thumb-btn download" title="Baixar Arquivo"><i data-lucide="download" style="width:12px;height:12px;"></i> Baixar</button>` : ''}
                            <button type="button" onclick="event.preventDefault(); event.stopPropagation(); window.deleteCarDoc('${d.id}')" class="doc-thumb-btn delete" title="Remover Documento"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        listContainer.innerHTML = cardsHtml;
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Upload document implementation
export async function handleDocUpload(event) {
    if (event) event.preventDefault();
    const fileInput = document.getElementById("cd-doc-file") || document.getElementById("cd-doc-file-input");
    if (fileInput && fileInput.files && fileInput.files.length) {
        await confirmDocUpload();
    }
}

// Delete document from spec
export async function deleteCarDoc(docId) {
    if (!docId) return;

    showCustomConfirm(
        "Excluir Documento",
        "Tem certeza que deseja remover este documento permanentemente do veículo?",
        async () => {
            const docIdStr = String(docId);
            const activeCarId = currentCdCarId || window.currentCdCarId;

            // 1. Remove do estado local imediatamente para atualização instantânea
            state.documentosVeiculo = (state.documentosVeiculo || []).filter(d => String(d.id) !== docIdStr);
            
            // 2. Persistir localmente
            persistLocalData();

            // 3. Atualizar UI
            if (activeCarId) {
                renderCarDocuments(activeCarId);
            }

            // 4. Deletar no servidor central
            try {
                await fetch(`/api/crm/documentos/${docId}`, { method: 'DELETE' });
            } catch (err) {
                console.warn("Erro ao deletar documento na API central:", err);
                return;
            }

            if (window.showToast) {
                window.showToast("Documento removido com sucesso!", "info");
            }
        },
        "Excluir"
    );
}

// --------------------------------------------------------------------------
// CONSULTAS TABELA FIPE (BRASILAPI INTEGRATION)
// --------------------------------------------------------------------------
let fipeSelectedBrand = '';
let fipeSelectedModel = '';
let fipeSelectedYear = '';
let fipeSelectedPrice = 0;
let fipeSelectedCode = '';
let fipeSelectedMonth = '';

export function openFipeSearchModal() {
    const modal = document.getElementById("modal-fipe");
    if (!modal) return;
    modal.classList.add("active");

    // Clear dropdowns
    document.getElementById("fipe-brand").innerHTML = `<option value="">Selecione...</option>`;
    document.getElementById("fipe-brand").disabled = true;
    document.getElementById("fipe-model").innerHTML = `<option value="">Selecione...</option>`;
    document.getElementById("fipe-model").disabled = true;
    document.getElementById("fipe-year").innerHTML = `<option value="">Selecione...</option>`;
    document.getElementById("fipe-year").disabled = true;
    document.getElementById("fipe-result").style.display = "none";
    document.getElementById("btn-apply-fipe").disabled = true;

    // Fetch initial brands
    fetchFipeBrands();
}

export function closeFipeSearchModal() {
    const modal = document.getElementById("modal-fipe");
    if (modal) modal.classList.remove("active");
}

export async function fetchFipeBrands() {
    const type = document.getElementById("fipe-type")?.value || "carros";
    const brandSel = document.getElementById("fipe-brand");
    const modelSel = document.getElementById("fipe-model");
    const yearSel = document.getElementById("fipe-year");
    if (!brandSel) return;

    brandSel.innerHTML = `<option value="">Carregando marcas...</option>`;
    brandSel.disabled = true;
    if (modelSel) { modelSel.innerHTML = `<option value="">Selecione...</option>`; modelSel.disabled = true; }
    if (yearSel) { yearSel.innerHTML = `<option value="">Selecione...</option>`; yearSel.disabled = true; }

    try {
        const response = await fetch(`https://parallelum.com.br/fipe/api/v1/${type}/marcas`);
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            brandSel.innerHTML = `<option value="">Nenhuma marca encontrada</option>`;
            return;
        }

        brandSel.innerHTML = `<option value="">Selecione...</option>` + 
            data.map(b => `<option value="${b.codigo}">${b.nome}</option>`).join('');
        brandSel.disabled = false;

        // Auto-detect brand from explicitly entered brand input or car title
        const cdBrandVal = document.getElementById("cd-brand")?.value?.trim().toLowerCase() || "";
        const carTitle = document.getElementById("cd-title")?.innerText?.trim().toLowerCase() || "";
        
        let foundBrand = null;
        if (cdBrandVal && cdBrandVal !== "-") {
            foundBrand = data.find(b => b.nome && (b.nome.toLowerCase() === cdBrandVal || b.nome.toLowerCase().startsWith(cdBrandVal) || cdBrandVal.includes(b.nome.toLowerCase())));
        }
        if (!foundBrand && carTitle) {
            foundBrand = data.find(b => b.nome && carTitle.includes(b.nome.toLowerCase()));
        }

        if (foundBrand) {
            brandSel.value = foundBrand.codigo;
            fetchFipeModels();
        }
    } catch (e) {
        console.error(e);
        brandSel.innerHTML = `<option value="">Erro ao carregar marcas</option>`;
    }
}

export async function fetchFipeModels() {
    const type = document.getElementById("fipe-type")?.value || "carros";
    const brand = document.getElementById("fipe-brand")?.value;
    const modelSel = document.getElementById("fipe-model");
    const yearSel = document.getElementById("fipe-year");
    if (!brand || !modelSel) return;

    fipeSelectedBrand = brand;
    modelSel.innerHTML = `<option value="">Carregando modelos...</option>`;
    modelSel.disabled = true;
    if (yearSel) { yearSel.innerHTML = `<option value="">Selecione...</option>`; yearSel.disabled = true; }

    try {
        const modelsRes = await fetch(`https://parallelum.com.br/fipe/api/v1/${type}/marcas/${brand}/modelos`);
        const data = await modelsRes.json();

        const modelsList = Array.isArray(data?.modelos) ? data.modelos : [];

        if (!modelsRes.ok || modelsList.length === 0) {
            modelSel.innerHTML = `<option value="">Nenhum modelo encontrado</option>`;
            return;
        }

        modelSel.innerHTML = `<option value="">Selecione...</option>` + 
            modelsList.map(m => `<option value="${m.codigo}">${m.nome}</option>`).join('');
        modelSel.disabled = false;

        // Auto-detect model from explicit cd-model or car title
        const cdModelVal = document.getElementById("cd-model")?.value?.trim().toLowerCase() || "";
        const carTitle = document.getElementById("cd-title")?.innerText?.trim().toLowerCase() || "";
        const brandSel = document.getElementById("fipe-brand");
        const brandOptionText = brandSel?.options[brandSel?.selectedIndex]?.text?.toLowerCase() || "";
        
        let searchString = (cdModelVal && cdModelVal !== "-") ? cdModelVal : carTitle;
        if (searchString && brandOptionText) {
            searchString = searchString.replace(brandOptionText, "");
        }
        
        if (searchString) {
            const targetWords = searchString.split(/[\s\-\/]+/).filter(w => w.length >= 2);
            
            if (targetWords.length > 0) {
                let bestModel = null;
                let bestScore = -1;

                modelsList.forEach(m => {
                    const mName = m.nome.toLowerCase();
                    let score = 0;
                    
                    targetWords.forEach((word, index) => {
                        if (mName.includes(word)) {
                            score += (index === 0 ? 5 : 2);
                        }
                    });

                    if (targetWords[0] && mName.startsWith(targetWords[0])) {
                        score += 3;
                    }

                    if (score > bestScore && score > 0) {
                        bestScore = score;
                        bestModel = m;
                    }
                });

                if (bestModel) {
                    modelSel.value = bestModel.codigo;
                    fetchFipeYears();
                }
            }
        }
    } catch (e) {
        console.error(e);
        modelSel.innerHTML = `<option value="">Erro ao carregar modelos</option>`;
    }
}

export async function fetchFipeYears() {
    const type = document.getElementById("fipe-type")?.value || "carros";
    const brand = document.getElementById("fipe-brand")?.value;
    const model = document.getElementById("fipe-model")?.value;
    const yearSel = document.getElementById("fipe-year");
    if (!brand || !model || !yearSel) return;

    fipeSelectedModel = model;
    yearSel.innerHTML = `<option value="">Carregando anos...</option>`;
    yearSel.disabled = true;

    try {
        const response = await fetch(`https://parallelum.com.br/fipe/api/v1/${type}/marcas/${brand}/modelos/${model}/anos`);
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            yearSel.innerHTML = `<option value="">Nenhum ano encontrado</option>`;
            return;
        }

        yearSel.innerHTML = `<option value="">Selecione...</option>` + 
            data.map(y => `<option value="${y.codigo}">${y.nome}</option>`).join('');
        yearSel.disabled = false;

        // Auto-detect year if available
        const carYear = document.getElementById("cd-year")?.value?.trim() || "";
        if (carYear) {
            const rawNumbers = carYear.match(/\d+/g) || [];
            const parsedYears = rawNumbers.map(num => {
                if (num.length === 2) return (parseInt(num, 10) > 50 ? "19" : "20") + num;
                return num;
            }).reverse(); // Check model year (last number) first

            let foundYear = null;
            for (const yearStr of parsedYears) {
                foundYear = data.find(y => y.nome.includes(yearStr) || y.codigo.startsWith(yearStr));
                if (foundYear) break;
            }

            if (foundYear) {
                yearSel.value = foundYear.codigo;
                fetchFipePrice();
            }
        }
    } catch (e) {
        console.error(e);
        yearSel.innerHTML = `<option value="">Erro ao carregar anos</option>`;
    }
}

export async function fetchFipePrice() {
    const type = document.getElementById("fipe-type")?.value || "carros";
    const brand = document.getElementById("fipe-brand")?.value;
    const model = document.getElementById("fipe-model")?.value;
    const year = document.getElementById("fipe-year")?.value;
    const resultBox = document.getElementById("fipe-result");
    const applyBtn = document.getElementById("btn-apply-fipe");
    if (!brand || !model || !year || !resultBox || !applyBtn) return;

    fipeSelectedYear = year;

    try {
        const response = await fetch(`https://parallelum.com.br/fipe/api/v1/${type}/marcas/${brand}/modelos/${model}/anos/${year}`);
        const data = await response.json();

        if (!response.ok || !data?.Valor) {
            alert("Erro ao buscar preço Fipe para a seleção atual.");
            return;
        }

        fipeSelectedPrice = parseFloat(data.Valor.replace(/[^\d]/g, "")) / 100;
        fipeSelectedCode = data.CodigoFipe || '';
        fipeSelectedMonth = data.MesReferencia || '';

        const elMonth = document.getElementById("fipe-res-month");
        const elCode = document.getElementById("fipe-res-code");
        const elPrice = document.getElementById("fipe-res-price");
        if (elMonth) elMonth.innerText = fipeSelectedMonth;
        if (elCode) elCode.innerText = fipeSelectedCode;
        if (elPrice) elPrice.innerText = data.Valor;

        resultBox.style.display = "block";
        applyBtn.disabled = false;
    } catch (e) {
        console.error(e);
        alert("Erro ao buscar preço Fipe.");
    }
}

export function applyFipeResult() {
    // Inject pricing back into active form (Edit Car)
    const inputPrice = document.getElementById("cd-fipe-price");
    const inputCode = document.getElementById("cd-fipe-code");
    if (inputPrice) { 
        inputPrice.value = fipeSelectedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    if (inputCode) {
        inputCode.value = fipeSelectedCode;
    }

    closeFipeSearchModal();
}

// --------------------------------------------------------------------------
// CONSULTA PLACA DEMO (SINESP API MOCK INTEGRATION)
// --------------------------------------------------------------------------
export function openPlacaDemoModal() {
    const modal = document.getElementById("modal-placa");
    if (modal) {
        modal.classList.add("active");
        document.getElementById("placa-demo-input").value = "";
        document.getElementById("placa-demo-result").style.display = "none";
    }
}

export function closePlacaDemoModal() {
    const modal = document.getElementById("modal-placa");
    if (modal) modal.classList.remove("active");
}

export function runPlacaDemoSearch() {
    const plate = document.getElementById("placa-demo-input").value.trim().toUpperCase();
    const resultBox = document.getElementById("placa-demo-result");
    if (!plate || !resultBox) return;

    document.getElementById("placa-demo-spinner").style.display = "block";
    resultBox.style.display = "none";

    setTimeout(() => {
        document.getElementById("placa-demo-spinner").style.display = "none";

        // Generate robust demo responses depending on query
        let model = "VW T-Cross Comfortline 250 TSI";
        let color = "Bronze Namíbia";
        let year = "2021/2022";
        let chassis = "9BWZZZ99Z9990" + Math.floor(Math.random() * 9000 + 1000);
        let status = "Sem restrições (Ativo)";
        let statusColor = "var(--green-profit)";

        if (plate === "ABC1234" || plate === "ABC1D23") {
            model = "Chevrolet Onix LTZ Turbo";
            color = "Azul Seeker";
            year = "2020/2020";
        } else if (plate === "KAS5H77" || plate === "KAS5877") {
            model = "Ford Ka SE 1.0";
            color = "Branco Ártico";
            year = "2019/2019";
        } else if (plate.includes("ROU") || plate.includes("999")) {
            status = "RESTRIÇÃO ATIVA: Queixa de Roubo/Furto";
            statusColor = "var(--red-alert)";
        }

        const resModel = document.getElementById("placa-res-model");
        const resColor = document.getElementById("placa-res-color");
        const resYear = document.getElementById("placa-res-year");
        const resChassis = document.getElementById("placa-res-chassis");
        const resStatus = document.getElementById("placa-res-status");

        if (resModel) resModel.innerText = model;
        if (resColor) resColor.innerText = color;
        if (resYear) resYear.innerText = year;
        if (resChassis) resChassis.innerText = chassis;
        if (resStatus) {
            resStatus.innerText = status;
            resStatus.style.color = statusColor;
        }

        // Auto populate values in Add Car Form if visible
        const carForm = document.getElementById("modal-add-car");
        if (carForm && carForm.classList.contains("active")) {
            const mInput = document.getElementById("car-brand-model");
            const yInput = document.getElementById("car-year");
            const cInput = document.getElementById("car-color");
            const chInput = document.getElementById("car-chassis");
            const pInput = document.getElementById("car-plate");

            if (mInput && !mInput.value) mInput.value = model;
            if (yInput && !yInput.value) yInput.value = year;
            if (cInput && !cInput.value) cInput.value = color;
            if (chInput && !chInput.value) chInput.value = chassis;
            if (pInput && !pInput.value) pInput.value = plate;
        }

        resultBox.style.display = "block";
    }, 1200);
}

export function openCarDetailsForSale(carId) {
    const car = state.estoque.find(c => String(c.id) === String(carId));
    if (!car) {
        alert("Veículo não encontrado no estoque.");
        return;
    }

    openCarDetails(carId, 'estoque');
    switchCarDetailsTab('docs');
    setTimeout(() => {
        const saleCard = document.getElementById('cd-sale-card');
        if (saleCard) saleCard.scrollIntoView({ behavior: 'smooth' });
        const clientInput = document.getElementById('cd-sell-client');
        if (clientInput) clientInput.focus();
    }, 120);
}

export async function confirmCarSale(event) {
    if (event) event.preventDefault();
    const carId = currentCdCarId || window.currentCdCarId;
    if (!carId) {
        alert("Nenhum veículo selecionado para registrar venda.");
        return;
    }

    const car = state.estoque.find(c => String(c.id) === String(carId));
    if (!car) {
        alert("Veículo não encontrado no estoque.");
        return;
    }

    const existingSale = (state.vendas || []).find(v => (String(v.carId) === String(car.id) || String(v.car_id) === String(car.id)) && v.carId !== null);
    if (existingSale) {
        openCarDetailsForSale(carId);
        return;
    }

    const client = (document.getElementById("cd-sell-client")?.value || "").trim();
    const documentStr = (document.getElementById("cd-sell-doc")?.value || "").trim();
    const date = document.getElementById("cd-sell-date")?.value || new Date().toISOString().split('T')[0];
    const type = document.getElementById("cd-sell-type")?.value || "convencional";
    const rawSellerCnpj = document.getElementById("cd-sell-seller-cnpj")?.value;
    const customSellerCnpj = document.getElementById("cd-sell-seller-cnpj-custom")?.value;
    const defaultCompanyCnpj = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault))?.cnpj || "65.760.566/0001-67";
    const sellerCnpj = (rawSellerCnpj === 'custom' ? customSellerCnpj : (rawSellerCnpj || "")).trim() || defaultCompanyCnpj;

    if (!client) {
        alert("Por favor, preencha o nome do comprador.");
        const cInp = document.getElementById("cd-sell-client");
        if (cInp) cInp.focus();
        return;
    }

    // Auto-register buyer into client base if not exists
    const clientExists = state.clientes.some(c => (c.name || '').toLowerCase() === client.toLowerCase());
    if (!clientExists) {
        const newClientObj = {
            id: Date.now(),
            name: client,
            document: documentStr,
            createdAt: new Date().toISOString()
        };
        state.clientes.push(newClientObj);
        try {
            fetch('/api/crm/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newClientObj)
            }).catch(() => {});
        } catch (error) { window.showToast?.(error.message || 'Não foi possível salvar.', 'error'); return; }
        if (window.renderClientesTable) window.renderClientesTable();
    }

    const finalPriceInput = document.getElementById("cd-sell-final-price");
    const regularSellInput = document.getElementById("cd-sell");
    let sellPrice = parseCurrencyBR(finalPriceInput?.value) || parseCurrencyBR(regularSellInput?.value) || Number(car.sellPrice) || 0;
    if (sellPrice <= 0) {
        alert("Por favor, informe o valor final da venda.");
        if (finalPriceInput) finalPriceInput.focus();
        return;
    }

    const despesasCarro = (state.despesas || []).filter(d => String(d.carId) === String(car.id) || String(d.car_id) === String(car.id)).reduce((sum, d) => sum + (Number(d.val) || 0), 0);
    const buyPrice = Number(car.buyPrice) || 0;
    const profit = sellPrice - buyPrice - despesasCarro;
    const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

    const saleData = {
        carId: Number(car.id),
        car_id: Number(car.id),
        plate: car.plate || "",
        model: car.model || "",
        client,
        clientDocument: documentStr,
        client_document: documentStr,
        sellerCnpj,
        seller_cnpj: sellerCnpj,
        sellPrice,
        sell_price: sellPrice,
        date,
        profit,
        margin,
        type
    };

    // 1. Persist sale to central cloud database
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
        console.warn("Falha ao registrar venda no servidor:", err);
        return;
    }

    if (!savedSale) { return; }

    // 2. Add to in-memory state
    state.vendas = state.vendas.filter(v => String(v.id) !== String(savedSale.id));
    state.vendas.unshift(savedSale);

    // 3. Mark car as sold in memory
    car.status = 'vendido';
    car.sellPrice = sellPrice;
    car.soldDate = date;

    // 4. Close related lead if exists
    const lead = state.leads.find(l => String(l.interestCarId) === String(car.id) && l.status !== 'fechado');
    if (lead) {
        lead.status = 'fechado';
        if (!lead.interactions) lead.interactions = [];
        lead.interactions.push({ date: "Hoje", text: `Venda formalizada! Valor de R$ ${sellPrice.toLocaleString('pt-BR')} (CNPJ: ${sellerCnpj})` });
    }

    // 5. Sync to Supabase if authenticated
    if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
        try {
            await state.supabaseClient.from('estoque').update({ status: 'vendido', sell_price: sellPrice }).eq('id', car.id);
            const supaSaleData = { car_id: car.id, client, sell_price: sellPrice, date, profit, margin, type };
            if (documentStr) supaSaleData.client_document = documentStr;
            if (sellerCnpj) supaSaleData.seller_cnpj = sellerCnpj;
            await state.supabaseClient.from('vendas').insert(supaSaleData);
        } catch (error) { window.showToast?.(error.message || 'Não foi possível salvar.', 'error'); return; }
    }

    // 6. Persist local storage and refresh state
    persistLocalData();
    window.updateApplicationState();

    // 7. Ensure active period filter includes the sale date
    const { start, end } = getFilteredDates();
    const saleD = new Date(date + 'T12:00:00');
    if (saleD < start || saleD > end) {
        if (window.applyPeriodFilter) window.applyPeriodFilter('all');
    }

    // 8. Close car details drawer
    if (window.closeCarDetails) {
        window.closeCarDetails();
    } else {
        const carDetailsTab = document.getElementById("car-details-tab");
        if (carDetailsTab) carDetailsTab.classList.remove("active");
    }

    // Keep the sold vehicle visible in the unified inventory.
    const statusFilter = document.getElementById('filter-estoque-status');
    if (statusFilter) statusFilter.value = 'vendido';
    const search = document.getElementById('search-estoque');
    if (search) search.value = '';
    if (window.switchTab) window.switchTab('estoque');
    if (window.showToast) window.showToast(`Venda do ${car.model} registrada com sucesso! Veículo disponível no filtro Vendido.`, 'success');

}

// Populate and adapt the Fechamento e Venda card based on sale registration status
export function renderCarSaleCard(car) {
    if (!car) return;

    const existingSale = (state.vendas || []).find(v => (String(v.carId) === String(car.id) || String(v.car_id) === String(car.id)));
    const saleCardTitle = document.getElementById("cd-sale-card-title");
    const saleCardSubtitle = document.getElementById("cd-sale-card-subtitle");
    const saleCardIcon = document.getElementById("cd-sale-card-icon");
    const saleActionRow = document.getElementById("cd-sale-action-row");

    const sellClientInput = document.getElementById("cd-sell-client");
    const sellFinalPriceInput = document.getElementById("cd-sell-final-price");
    const sellDocInput = document.getElementById("cd-sell-doc");
    const sellDateInput = document.getElementById("cd-sell-date");
    const sellCnpjInput = document.getElementById("cd-sell-seller-cnpj");
    const sellTypeSelect = document.getElementById("cd-sell-type");

    const defaultCnpj = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault))?.cnpj || "";
    if (existingSale) {
        if (sellClientInput) sellClientInput.value = existingSale.client || "";
        if (sellFinalPriceInput) sellFinalPriceInput.value = formatCurrency(existingSale.sellPrice || 0).replace('R$', '').trim();
        if (sellDocInput) sellDocInput.value = existingSale.clientDocument || existingSale.client_document || "";
        if (sellDateInput) sellDateInput.value = existingSale.date || "";
        const selectedCnpj = existingSale.sellerCnpj || existingSale.seller_cnpj || defaultCnpj;
        if (sellCnpjInput) {
            if (window.populateSellerCnpjsDropdown) {
                window.populateSellerCnpjsDropdown(sellCnpjInput, selectedCnpj);
            } else {
                sellCnpjInput.value = selectedCnpj;
            }
        }
        if (sellTypeSelect) sellTypeSelect.value = existingSale.type || "convencional";

        const dateObj = existingSale.date ? new Date(existingSale.date + 'T12:00:00') : null;
        const formattedDate = dateObj && !isNaN(dateObj) ? dateObj.toLocaleDateString('pt-BR') : (existingSale.date || 'Data não informada');
        
        if (saleCardTitle) {
            const badgeType = existingSale.type === 'repasse' ? 'repasse' : (existingSale.type === 'outros' ? 'outros' : 'varejo');
            saleCardTitle.innerHTML = `Venda Registrada <span class="badge ${badgeType}" style="margin-left:8px; font-size:11px; vertical-align:middle; text-transform:uppercase;">${existingSale.type === 'repasse' ? 'Repasse' : 'Concluída'}</span>`;
        }
        if (saleCardSubtitle) {
            saleCardSubtitle.innerHTML = `Venda #${existingSale.id} realizada em <strong>${formattedDate}</strong> • Lucro Líquido: <strong style="color:var(--green-profit);">${formatCurrency(existingSale.profit || 0)}</strong>`;
        }
        if (saleCardIcon) {
            saleCardIcon.setAttribute('data-lucide', 'badge-check');
            saleCardIcon.style.color = 'var(--green-profit)';
        }
        if (saleActionRow) {
            saleActionRow.innerHTML = `
                <div style="display:flex; gap:10px; width:100%; flex-wrap:wrap;">
                    <button type="button" class="btn btn-primary" style="flex:1; min-width:180px; display:inline-flex; align-items:center; justify-content:center; gap:6px; height:42px; font-weight:600; border-radius:10px;" onclick="window.saveCarDetailsSale(${existingSale.id})">
                        <i data-lucide="check" style="width:16px;height:16px;"></i> Salvar Alterações da Venda
                    </button>
                    <button type="button" class="btn btn-secondary" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; height:42px; padding:0 16px; border-radius:10px;" onclick="window.generatePDFReceipt(${existingSale.id})" title="Emitir Recibo em PDF">
                        <i data-lucide="file-check" style="width:16px;height:16px; color:var(--blue-primary);"></i> Emitir Recibo
                    </button>
                    <button type="button" class="btn btn-secondary" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; height:42px; padding:0 16px; border-radius:10px; color:var(--blue-primary);" onclick="window.closeCarDetails();" title="Voltar ao estoque">
                        <i data-lucide="badge-dollar-sign" style="width:16px;height:16px;"></i> Voltar ao Estoque
                    </button>
                    <button type="button" class="btn btn-danger" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; height:42px; padding:0 16px; border-radius:10px;" onclick="window.deleteVendaConfirm(${existingSale.id})" title="Reverter venda e devolver ao estoque">
                        <i data-lucide="undo-2" style="width:16px;height:16px;"></i> Reverter Venda
                    </button>
                </div>
            `;
        }
    } else {
        if (sellClientInput) sellClientInput.value = "";
        if (sellFinalPriceInput) sellFinalPriceInput.value = formatCurrency(car.sellPrice || 0).replace('R$', '').trim();
        if (sellDocInput) sellDocInput.value = "";
        if (sellDateInput) sellDateInput.value = new Date().toISOString().split('T')[0];
        
        const defaultCnpj = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault))?.cnpj || "";
        if (sellCnpjInput) {
            if (window.populateSellerCnpjsDropdown) {
                window.populateSellerCnpjsDropdown(sellCnpjInput, defaultCnpj);
            } else {
                sellCnpjInput.value = defaultCnpj;
            }
        }
        if (sellTypeSelect) sellTypeSelect.value = car.type || "convencional";

        if (car.status === 'vendido') {
            if (saleCardTitle) {
                saleCardTitle.innerHTML = `Venda Pendente de Registro <span class="badge repasse" style="margin-left:8px; font-size:11px; vertical-align:middle; text-transform:uppercase;">Pendente</span>`;
            }
            if (saleCardSubtitle) {
                saleCardSubtitle.innerHTML = `<span style="color:var(--yellow-warning); font-weight:500;">⚠️ Veículo consta como vendido no pátio. Confirme os dados abaixo para salvar os dados da venda nesta ficha.</span>`;
            }
            if (saleCardIcon) {
                saleCardIcon.setAttribute('data-lucide', 'badge-alert');
                saleCardIcon.style.color = 'var(--yellow-warning)';
            }
            if (saleActionRow) {
                saleActionRow.innerHTML = `
                    <button class="btn btn-success btn-confirm-sale-premium" onclick="confirmCarSale(event)">
                        <i data-lucide="check-circle" style="width:18px; height:18px;"></i> Salvar dados da venda
                    </button>
                `;
            }
        } else {
            if (saleCardTitle) {
                saleCardTitle.innerHTML = `Fechamento e Venda`;
            }
            if (saleCardSubtitle) {
                saleCardSubtitle.innerText = `Registrar saída do veículo para o caixa`;
            }
            if (saleCardIcon) {
                saleCardIcon.setAttribute('data-lucide', 'badge-dollar-sign');
                saleCardIcon.style.color = 'var(--green-profit)';
            }
            if (saleActionRow) {
                saleActionRow.innerHTML = `
                    <button class="btn btn-success btn-confirm-sale-premium" onclick="confirmCarSale(event)">
                        <i data-lucide="check-circle" style="width:18px; height:18px;"></i> Confirmar Venda do Veículo
                    </button>
                `;
            }
        }
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Save edits directly from the vehicle details sale card
export async function saveCarDetailsSale(vendaId) {
    const carId = currentCdCarId || window.currentCdCarId;
    const client = (document.getElementById("cd-sell-client")?.value || "").trim();
    const documentStr = (document.getElementById("cd-sell-doc")?.value || "").trim();
    const date = document.getElementById("cd-sell-date")?.value || "";
    const type = document.getElementById("cd-sell-type")?.value || "convencional";
    const rawSellerCnpj = document.getElementById("cd-sell-seller-cnpj")?.value;
    const customSellerCnpj = document.getElementById("cd-sell-seller-cnpj-custom")?.value;
    const sellerCnpj = (rawSellerCnpj === 'custom' ? customSellerCnpj : (rawSellerCnpj || "")).trim();
    const car = state.estoque.find(c => String(c.id) === String(carId)) || {};

    if (!client) {
        alert("Por favor, informe o nome do comprador.");
        return;
    }

    const finalPriceInput = document.getElementById("cd-sell-final-price");
    const regularSellInput = document.getElementById("cd-sell");
    const sellPrice = parseCurrencyBR(finalPriceInput?.value) || parseCurrencyBR(regularSellInput?.value) || car.sellPrice || 0;
    const despesasCarro = (state.despesas || []).filter(d => String(d.carId) === String(carId) || String(d.car_id) === String(carId)).reduce((sum, d) => sum + (Number(d.val) || 0), 0);
    const profit = sellPrice - (car.buyPrice || 0) - despesasCarro;
    const margin = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

    // 1. Update in-memory state
    const v = state.vendas.find(v => String(v.id) === String(vendaId));
    if (v) {
        v.client = client;
        v.clientDocument = documentStr;
        v.client_document = documentStr;
        v.sellerCnpj = sellerCnpj;
        v.seller_cnpj = sellerCnpj;
        v.sellPrice = sellPrice;
        v.sell_price = sellPrice;
        v.profit = profit;
        v.margin = margin;
        v.date = date;
        v.type = type;
    }

    if (car && car.id) {
        car.sellPrice = sellPrice;
        car.soldDate = date;
    }

    // 2. Persist to server JSON database
    try {
        await fetch(`/api/crm/vendas/${vendaId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client,
                clientDocument: documentStr,
                client_document: documentStr,
                sellerCnpj,
                seller_cnpj: sellerCnpj,
                sellPrice,
                sell_price: sellPrice,
                profit,
                margin,
                date,
                type
            })
        });
    } catch (err) {
        console.warn("Erro ao atualizar venda no servidor:", err);
    }

    // 3. Persist to Supabase if authenticated
    if (state.supabaseClient && state.sessionUser && state.sessionUser.id !== 'adm-master-session') {
        try {
            const updateData = { client, sell_price: sellPrice, profit, margin, date, type };
            if (documentStr) updateData.client_document = documentStr;
            if (sellerCnpj) updateData.seller_cnpj = sellerCnpj;

            let { error: errUpdate } = await state.supabaseClient.from('vendas').update(updateData).eq('id', vendaId);
            if (errUpdate && (errUpdate.message?.includes('seller_cnpj') || errUpdate.message?.includes('client_document') || errUpdate.message?.includes('schema cache'))) {
                delete updateData.seller_cnpj;
                delete updateData.client_document;
                await state.supabaseClient.from('vendas').update(updateData).eq('id', vendaId);
            }
        } catch (e) {
            console.warn("Supabase update error:", e);
        }
    }

    persistLocalData();

    if (window.showToast) {
        window.showToast("Dados da venda e CNPJ vendedor atualizados com sucesso!", "success");
    } else {
        alert("Dados da venda atualizados com sucesso!");
    }

    window.updateApplicationState();
    if (carId) openCarDetails(carId);
}
