// ==========================================================================
// AUTO DRIVE CRM - CENTRAL CONTROLLER ENTRY POINT (ES MODULE)
// ==========================================================================

import { state, initGlobalBindings } from './src/services/state.js';

// Initialize global bindings for index.html / legacy global scope compatibility
initGlobalBindings();
import { 
    initSupabase, 
    checkActiveSession, 
    handleLogin, 
    handleLogout, 
    handleSignup, 
    fetchCloudData, 
    toggleUserApproval, 
    toggleUserAdmin, 
    deleteUserAccount, 
    filterUsuariosTable,
    bypassLoginForDemo,
    loadProfiles,
    connectAdminCockpit
} from './src/services/supabase.js';

import { 
    formatCurrency, 
    parseCurrencyBR, 
    formatCurrencyInput,
    setupHeaderDate
} from './src/utils/helpers.js';

import { 
    switchTab, 
    applyPeriodFilter, 
    applyCustomPeriod, 
    syncAndApplyCustomPeriod, 
    initAppTheme, 
    toggleAppTheme, 
    toggleSidebar,
    toggleMenuSearch, 
    closeMenuSearch, 
    handleMenuSearch, 
    handleMenuSearchKey,
    selectSearchResult,
    getPeriodLabel,
    getFilteredDates,
    updateSellerCnpjDatalists,
    renderCompanyCnpjsTable,
    updatePeriodUI
} from './src/features/configuracoes/configuracoes.js';

import { 
    initCharts, 
    calculateKPIs,
    calculateCRMStats,
    dismissActionTask,
    toggleDismissOptions,
    restoreDismissedActions
} from './src/features/dashboard/dashboard.js';

import { 
    renderEstoqueTable, 
    renderEstoque,
    sortEstoque, 
    setEstoqueView,
    filterEstoqueTable,
    filterEstoqueStatus,
    openAddCarModal, 
    closeAddCarModal, 
    saveNewCar, 
    openCarDetails, 
    closeCarDetails, 
    editCarDetails, 
    saveEditCarDetails, managePending,
    deleteCarDoc, 
    openCarDoc,
    closeDocPreviewModal,
    downloadCarDoc,
    removeSinglePhoto,
    showCustomConfirm,
    handleDocUpload, 
    handleDocFileSelected,
    cancelDocUpload,
    confirmDocUpload,
    openAddDespesaModalFromCar,
    openFipeSearchModal, 
    closeFipeSearchModal, 
    fetchFipeBrands, 
    fetchFipeModels, 
    fetchFipeYears, 
    fetchFipePrice, 
    applyFipeResult, 
    openPlacaDemoModal, 
    closePlacaDemoModal, 
    runPlacaDemoSearch, 
    openCarDetailsForSale, 
    confirmCarSale, 
    renderCarExpenses,
    addCarExpenseInline,
    switchCarDetailsTab,
    updateDetailsStatusBadge,
    calculateDetailsFinancials,
    previewDetailsPhotos,
    clearCarPhotos,
    updateSummaryFields,
    quickFipeSearch,
    appendQuickNote,
    saveCarDetails,
    triggerCarDetailsAutoSave,
    initCarDetailsAutoSaveListeners,
    setAutoSaveStatus,
    previewVehiclePhoto,
    parseCarImageUrls,
    joinCarImageUrls,
    renderCarSaleCard,
    saveCarDetailsSale
} from './src/features/estoque/estoque.js';

import { 
    renderKanban, 
    renderLeadsList, 
    openAddLeadModal, 
    closeAddLeadModal, 
    saveNewLead, 
    openLeadDetailModal, 
    closeLeadDetailModal, 
    openEditLeadModal,
    closeEditLeadModal,
    saveEditLead,
    saveNewInteraction, 
    deleteLeadConfirm, 
    dragLead, 
    allowDrop,
    allowLeadDrop, 
    dropLead, 
    setLeadViewMode, 
    setLeadView,
    filterKanban,
    populateCarSelects,
    openTimelineModal,
    closeTimelineModal,
    addLeadInteraction,
    deleteInteractionConfirm
} from './src/features/leads/leads.js';

import { 
    renderVendasTable, 
    filterVendasTable,
    downloadCSV, 
    generatePDFReceipt,
    openEditVendaModal,
    closeEditVendaModal,
    saveEditVenda,
    deleteVendaConfirm,
    closeReceiptPrintModal,
    exportEstoqueToExcel,
    exportLeadsToExcel,
    exportVendasToExcel,
    exportDespesasToExcel,
    openSellCarModal,
    closeSellModal,
    saveSale,
    highlightVendaRow,
    syncVendasFromCloud
} from './src/features/vendas/vendas.js';

import { 
    renderFinanceiro, 
    populateDespesaCarSelect, 
    openAddDespesaModal, 
    closeAddDespesaModal, 
    saveNewDespesa, 
    openEditDespesaModal, 
    closeEditDespesaModal, 
    saveEditDespesa, 
    deleteDespesaConfirm, 
    deleteDespesaFromDetails,
    initFinanceChart
} from './src/features/financeiro/financeiro.js';


import { 
    renderClientesTable, 
    openAddClientModal, 
    closeClientModal, 
    openEditClientModal, 
    saveClient, 
    deleteClient, 
    handleClientSearch, 
    selectClientFromDropdown, 
    sortClientesTable, 
    calculateClientesKPIs 
} from './src/features/clientes/clientes.js';


// Global state updater that cascades across all features
export function updateApplicationState() {
    calculateKPIs();
    calculateCRMStats();
    renderEstoqueTable();
    populateCarSelects();
    renderKanban();
    renderLeadsList();
    renderVendasTable();
    renderFinanceiro();
    calculateClientesKPIs();
    renderClientesTable();
    updateSellerCnpjDatalists();

    // Rerender car details spec subtab if visible
    const carTab = document.getElementById('car-details-tab');
    if (carTab && carTab.classList.contains('active') && window.currentCdCarId) {
        renderCarExpenses(window.currentCdCarId);
        calculateDetailsFinancials();
    }
}

// Attach all modules handlers to window for complete HTML compatibility
window.state = state;
window.updateApplicationState = updateApplicationState;
window.fetchCloudData = fetchCloudData;

// Formatting & Input Helpers
window.formatCurrency = formatCurrency;
window.parseCurrencyBR = parseCurrencyBR;
window.formatCurrencyInput = formatCurrencyInput;

// Configs & Filters
window.switchTab = switchTab;
window.applyPeriodFilter = applyPeriodFilter;
window.applyCustomPeriod = applyCustomPeriod;
window.syncAndApplyCustomPeriod = syncAndApplyCustomPeriod;
window.initAppTheme = initAppTheme;
window.toggleAppTheme = toggleAppTheme;
window.toggleSidebar = toggleSidebar;
window.setupHeaderDate = setupHeaderDate;
window.toggleMenuSearch = toggleMenuSearch;
window.closeMenuSearch = closeMenuSearch;
window.handleMenuSearch = handleMenuSearch;
window.handleMenuSearchKey = handleMenuSearchKey;
window.selectSearchResult = selectSearchResult;
window.getPeriodLabel = getPeriodLabel;
window.getFilteredDates = getFilteredDates;
window.updatePeriodUI = updatePeriodUI;

// Dashboard Charts
window.initCharts = initCharts;
window.calculateKPIs = calculateKPIs;
window.dismissActionTask = dismissActionTask;
window.toggleDismissOptions = toggleDismissOptions;
window.restoreDismissedActions = restoreDismissedActions;

// Inventory
window.renderEstoqueTable = renderEstoqueTable;
window.renderEstoque = renderEstoque;
window.sortEstoque = sortEstoque;
window.setEstoqueView = setEstoqueView;
window.filterEstoqueTable = filterEstoqueTable;
window.filterEstoqueStatus = filterEstoqueStatus;
window.openAddCarModal = openAddCarModal;
window.closeAddCarModal = closeAddCarModal;
window.saveNewCar = saveNewCar;
window.openCarDetails = openCarDetails;
window.closeCarDetails = closeCarDetails;
window.editCarDetails = editCarDetails;
window.saveEditCarDetails = saveEditCarDetails;
window.managePending = managePending;
window.deleteCarDoc = deleteCarDoc;
window.openCarDoc = openCarDoc;
window.closeDocPreviewModal = closeDocPreviewModal;
window.downloadCarDoc = downloadCarDoc;
window.removeSinglePhoto = removeSinglePhoto;
window.showCustomConfirm = showCustomConfirm;
window.handleDocUpload = handleDocUpload;
window.handleDocFileSelected = handleDocFileSelected;
window.cancelDocUpload = cancelDocUpload;
window.confirmDocUpload = confirmDocUpload;
window.openAddDespesaModalFromCar = openAddDespesaModalFromCar;
window.openFipeSearchModal = openFipeSearchModal;
window.closeFipeSearchModal = closeFipeSearchModal;
window.fetchFipeBrands = fetchFipeBrands;
window.fetchFipeModels = fetchFipeModels;
window.fetchFipeYears = fetchFipeYears;
window.fetchFipePrice = fetchFipePrice;
window.applyFipeResult = applyFipeResult;
window.openPlacaDemoModal = openPlacaDemoModal;
window.closePlacaDemoModal = closePlacaDemoModal;
window.runPlacaDemoSearch = runPlacaDemoSearch;
window.openCarDetailsForSale = openCarDetailsForSale;
window.confirmCarSale = confirmCarSale;
window.renderCarExpenses = renderCarExpenses;
window.addCarExpenseInline = addCarExpenseInline;
window.switchCarDetailsTab = switchCarDetailsTab;
window.updateDetailsStatusBadge = updateDetailsStatusBadge;
window.calculateDetailsFinancials = calculateDetailsFinancials;
window.previewDetailsPhotos = previewDetailsPhotos;
window.clearCarPhotos = clearCarPhotos;
window.updateSummaryFields = updateSummaryFields;
window.quickFipeSearch = quickFipeSearch;
window.appendQuickNote = appendQuickNote;
window.saveCarDetails = saveCarDetails;
window.triggerCarDetailsAutoSave = triggerCarDetailsAutoSave;
window.initCarDetailsAutoSaveListeners = initCarDetailsAutoSaveListeners;
window.setAutoSaveStatus = setAutoSaveStatus;
window.previewVehiclePhoto = previewVehiclePhoto;
window.parseCarImageUrls = parseCarImageUrls;
window.joinCarImageUrls = joinCarImageUrls;
window.renderCarSaleCard = renderCarSaleCard;
window.saveCarDetailsSale = saveCarDetailsSale;

// CRM Leads Kanban
window.calculateCRMStats = calculateCRMStats;
window.renderKanban = renderKanban;
window.renderLeadsList = renderLeadsList;
window.openAddLeadModal = openAddLeadModal;
window.closeAddLeadModal = closeAddLeadModal;
window.saveNewLead = saveNewLead;
window.openLeadDetailModal = openLeadDetailModal;
window.closeLeadDetailModal = closeLeadDetailModal;
window.openEditLeadModal = openEditLeadModal;
window.closeEditLeadModal = closeEditLeadModal;
window.saveEditLead = saveEditLead;
window.saveNewInteraction = saveNewInteraction;
window.openTimelineModal = openTimelineModal;
window.closeTimelineModal = closeTimelineModal;
window.addLeadInteraction = addLeadInteraction;
window.deleteInteractionConfirm = deleteInteractionConfirm;
window.deleteLeadConfirm = deleteLeadConfirm;
window.dragLead = dragLead;
window.allowDrop = allowDrop;
window.allowLeadDrop = allowLeadDrop;
window.dropLead = dropLead;
window.setLeadViewMode = setLeadViewMode;
window.setLeadView = setLeadView;
window.filterKanban = filterKanban;
window.populateCarSelects = populateCarSelects;

// Sales Transactions
window.renderVendasTable = renderVendasTable;
window.filterVendasTable = filterVendasTable;
window.syncVendasFromCloud = syncVendasFromCloud;
window.downloadCSV = downloadCSV;
window.generatePDFReceipt = generatePDFReceipt;
window.openEditVendaModal = openEditVendaModal;
window.closeEditVendaModal = closeEditVendaModal;
window.saveEditVenda = saveEditVenda;
window.deleteVendaConfirm = deleteVendaConfirm;
window.closeReceiptPrintModal = closeReceiptPrintModal;
window.exportEstoqueToExcel = exportEstoqueToExcel;
window.exportLeadsToExcel = exportLeadsToExcel;
window.exportVendasToExcel = exportVendasToExcel;
window.exportDespesasToExcel = exportDespesasToExcel;
window.openSellCarModal = openSellCarModal;
window.closeSellModal = closeSellModal;
window.saveSale = saveSale;
window.highlightVendaRow = highlightVendaRow;

// Financial Ledger
window.renderFinanceiro = renderFinanceiro;
window.populateDespesaCarSelect = populateDespesaCarSelect;
window.openAddDespesaModal = openAddDespesaModal;
window.closeAddDespesaModal = closeAddDespesaModal;
window.saveNewDespesa = saveNewDespesa;
window.openEditDespesaModal = openEditDespesaModal;
window.closeEditDespesaModal = closeEditDespesaModal;
window.saveEditDespesa = saveEditDespesa;
window.deleteDespesaConfirm = deleteDespesaConfirm;
window.deleteDespesaFromDetails = deleteDespesaFromDetails;
window.initFinanceChart = initFinanceChart;

// Customers Profiles
window.renderClientesTable = renderClientesTable;
window.openAddClientModal = openAddClientModal;
window.closeClientModal = closeClientModal;
window.openEditClientModal = openEditClientModal;
window.saveClient = saveClient;
window.deleteClient = deleteClient;
window.handleClientSearch = handleClientSearch;
window.selectClientFromDropdown = selectClientFromDropdown;
window.sortClientesTable = sortClientesTable;
window.calculateClientesKPIs = calculateClientesKPIs;

// Authentication
window.loadProfiles = loadProfiles;
window.handleLogin = handleLogin;
// Bind before asynchronous startup so a login never becomes a native GET navigation.
document.getElementById("form-login")?.addEventListener("submit", handleLogin);
window.handleLogout = handleLogout;
window.handleSignup = handleSignup;
window.bypassLoginForDemo = bypassLoginForDemo;
window.connectAdminCockpit = connectAdminCockpit;
window.toggleUserApproval = toggleUserApproval;
window.toggleUserAdmin = toggleUserAdmin;
window.deleteUserAccount = deleteUserAccount;
window.filterUsuariosTable = filterUsuariosTable;

// DOM Initialization Sequence
document.addEventListener("DOMContentLoaded", async () => {
    initSupabase();
    await checkActiveSession();
    const readyLoginButton = document.querySelector('#form-login button[type="submit"]');
    if (readyLoginButton) readyLoginButton.disabled = false;
    setupHeaderDate();
    initAppTheme();
    updateSellerCnpjDatalists();

    // Register Service Worker for PWA Offline functionality
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
            console.log('Service Worker registrado com sucesso:', reg.scope);
            if (reg && typeof reg.update === 'function') {
                reg.update().catch(updateErr => {
                    console.warn('Verificação de atualização do Service Worker ignorada com segurança:', updateErr);
                });
            }
        } catch (err) {
            console.warn('Aviso: Service Worker operando em modo degradado:', err);
        }
    }

    // Purge any stale /api/ responses cached in CacheStorage from previous versions
    if ('caches' in window) {
        try {
            const cacheKeys = await caches.keys();
            for (const key of cacheKeys) {
                if (key !== 'mcampos-desktop-v8') {
                    await caches.delete(key);
                } else {
                    const c = await caches.open(key);
                    const reqs = await c.keys();
                    for (const r of reqs) {
                        if (r.url.includes('/api/')) await c.delete(r);
                    }
                }
            }
        } catch (_) {}
    }

    updatePeriodUI();

    // Setup toggling links inside login modal overlay
    const toggleSignupLink = document.getElementById("toggle-signup-link");
    const toggleLoginLink = document.getElementById("toggle-login-link");
    const formLogin = document.getElementById("form-login");
    const formSignup = document.getElementById("form-signup");
    const loginTitle = document.querySelector("#login-overlay h2");

    if (toggleSignupLink && toggleLoginLink && formLogin && formSignup) {
        toggleSignupLink.addEventListener("click", (e) => {
            e.preventDefault();
            formLogin.style.display = "none";
            formSignup.style.display = "block";
            if (loginTitle) loginTitle.innerText = "Solicitar Acesso";
            const errorDiv = document.getElementById("login-error-message");
            if (errorDiv) {
                errorDiv.style.display = "none";
            }
        });
        toggleLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            formSignup.style.display = "none";
            formLogin.style.display = "block";
            if (loginTitle) loginTitle.innerText = "Acessar AutoDrive CRM";
            const errorDiv = document.getElementById("login-error-message");
            if (errorDiv) {
                errorDiv.style.display = "none";
            }
        });
    }

    // Bind auth forms submit listeners
    const signupForm = document.getElementById("form-signup");
    if (signupForm) {
        signupForm.addEventListener("submit", handleSignup);
    }

    // Restore sidebar collapsed state on load
    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    const savedCollapsed = localStorage.getItem("sidebar-collapsed");
    if (savedCollapsed === "true" && sidebar) {
        sidebar.classList.add("collapsed");
        if (toggleBtn) {
            toggleBtn.innerHTML = `<i data-lucide="chevron-right"></i>`;
        }
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    // Sidebar hover auto expand & collapse behavior
    if (sidebar) {
        sidebar.addEventListener("mouseenter", () => {
            if (sidebar.classList.contains("collapsed")) {
                sidebar.classList.remove("collapsed");
                sidebar.classList.add("hover-expanded");
            }
        });

        sidebar.addEventListener("mouseleave", () => {
            if (sidebar.classList.contains("hover-expanded")) {
                sidebar.classList.remove("hover-expanded");
                sidebar.classList.add("collapsed");
            }
        });
    }

    // Retract search component when clicking outside
    document.addEventListener("click", (e) => {
        const searchInput = document.getElementById("navbar-search-input");
        const dropdown = document.getElementById("search-results-dropdown");
        const searchBtn = document.querySelector('.navbar-util-btn[onclick*="toggleMenuSearch"]');
        
        if (searchInput && searchInput.classList.contains("expanded")) {
            const clickedInsideInput = searchInput.contains(e.target);
            const clickedInsideDropdown = dropdown && dropdown.contains(e.target);
            const clickedInsideBtn = searchBtn && searchBtn.contains(e.target);
            
            if (!clickedInsideInput && !clickedInsideDropdown && !clickedInsideBtn) {
                if (typeof window.closeMenuSearch === "function") {
                    window.closeMenuSearch();
                }
            }
        }
    });

    // Initialize Google Calendar state

});
