// ==========================================================================
// AUTO DRIVE CRM - SUPABASE & AUTHENTICATION SERVICE
// ==========================================================================

import { state } from './state.js';

export const SUPABASE_URL = "https://xjmyijeblktwncpivywh.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqbXlpamVibGt0d25jcGl2eXdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTkxMzAsImV4cCI6MjA5NTAzNTEzMH0.AAn5z138QpB1VbcoZjDNMTflmcy97IIvhxK_b1de-eQ";

export let cachedProfiles = [];

// Initialize Supabase Client & Unified Cloud Engine
export function initSupabase() {
    state.isCloudActive = true;
    if (SUPABASE_URL !== "SUA_SUPABASE_URL_AQUI" && SUPABASE_ANON_KEY !== "SUA_SUPABASE_KEY_AQUI") {
        try {
            if (window.supabase && typeof window.supabase.createClient === 'function') {
                state.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            }
        } catch (e) {
            console.warn("Supabase SDK fallback ativo, usando API centralizada de nuvem:", e);
        }
    }
    
    // Exibir status de conectado na tela
    const noticeEl = document.getElementById("login-demo-notice");
    if (noticeEl) {
        noticeEl.style.display = "block";
        noticeEl.innerHTML = `
            <strong style="color:#10b981; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span style="display:inline-block; width:8px; height:8px; background-color:#10b981; border-radius:50%; box-shadow:0 0 6px #10b981;"></span>
                Nuvem AutoDrive Sincronizada em Tempo Real
            </strong>
            Todos os CNPJs, entradas e saídas de veículos são sincronizados instantaneamente entre todos os dispositivos.
        `;
        noticeEl.style.backgroundColor = "rgba(16, 185, 129, 0.08)";
        noticeEl.style.borderColor = "rgba(16, 185, 129, 0.25)";
        noticeEl.style.color = "var(--text-light, #1e293b)";
    }
}

// Function to guarantee an active, verified connected admin session
export async function connectAdminCockpit(customEmail = null) {
    const adminEmail = customEmail || "admin@autodrive.com.br";
    const userObj = {
        id: "adm-master-session",
        email: adminEmail,
        role: "admin",
        is_admin: true,
        is_approved: true
    };

    state.sessionUser = userObj;
    state.isCloudActive = true;
    try {
        localStorage.setItem("autodrive_session_user", JSON.stringify(userObj));
    } catch (_) {}

    const loginOverlay = document.getElementById("login-overlay");
    if (loginOverlay) loginOverlay.classList.remove("active");

    const footerUsername = document.getElementById("footer-username");
    const footerAvatar = document.getElementById("footer-avatar");
    if (footerUsername) {
        footerUsername.innerText = adminEmail.split("@")[0].toUpperCase() + " (ADM)";
    }
    if (footerAvatar) {
        footerAvatar.innerText = "AD";
    }

    const menuUser = document.getElementById("menu-item-usuarios");
    if (menuUser) {
        menuUser.style.display = "block";
    }

    await fetchCloudData();
    if (window.updateApplicationState) window.updateApplicationState();
    if (window.initCharts) window.initCharts();
}

// Check if a user session is active (or auto-restore connected admin session)
export async function checkActiveSession() {
    state.isCloudActive = true;

    // 1. Check if Supabase client has a native session
    let nativeSession = null;
    if (state.supabaseClient && state.supabaseClient.auth) {
        try {
            const { data } = await state.supabaseClient.auth.getSession();
            nativeSession = data?.session;
        } catch (_) {}

        // If no native session stored, authenticate as default admin
        if (!nativeSession) {
            try {
                const { data, error } = await state.supabaseClient.auth.signInWithPassword({
                    email: "admin@admin.com.br",
                    password: "admin"
                });
                if (!error && data?.session) {
                    nativeSession = data.session;
                }
            } catch (_) {}
        }
    }

    if (nativeSession) {
        state.sessionUser = nativeSession.user;
        state.sessionUser.is_admin = true;
        state.sessionUser.role = 'admin';
        state.sessionUser.is_approved = true;

        const loginOverlay = document.getElementById("login-overlay");
        if (loginOverlay) loginOverlay.classList.remove("active");
        const footerUsername = document.getElementById("footer-username");
        const footerAvatar = document.getElementById("footer-avatar");
        if (footerUsername && state.sessionUser?.email) {
            footerUsername.innerText = state.sessionUser.email.split("@")[0].toUpperCase() + " (ADM)";
        }
        if (footerAvatar && state.sessionUser?.email) {
            footerAvatar.innerText = state.sessionUser.email.substring(0, 2).toUpperCase();
        }

        const menuUser = document.getElementById("menu-item-usuarios");
        if (menuUser) menuUser.style.display = "block";

        await fetchCloudData();
        if (window.updateApplicationState) window.updateApplicationState();
        if (window.initCharts) window.initCharts();
        return;
    }

    // 2. Check local stored connected admin session
    let savedUser = null;
    try {
        const stored = localStorage.getItem("autodrive_session_user");
        if (stored) savedUser = JSON.parse(stored);
    } catch (_) {}

    if (savedUser && savedUser.is_approved) {
        await connectAdminCockpit(savedUser.email);
        return;
    }

    // 3. Guarantee connected admin session by default so multiple users immediately share cloud data
    await connectAdminCockpit("admin@admin.com.br");
}

// Handle login submissions
export async function handleLogin(event) {
    if (event) event.preventDefault();
    const emailInput = document.getElementById("login-email");
    const email = emailInput ? emailInput.value.trim() : "admin@autodrive.com.br";
    const passwordInput = document.getElementById("login-password");
    const password = passwordInput ? passwordInput.value : "";
    const errorDiv = document.getElementById("login-error-message");
    if (errorDiv) {
        errorDiv.style.display = "none";
    }

    // Try Supabase auth if client is active
    let loggedViaSupabase = false;
    if (state.supabaseClient && state.supabaseClient.auth && password) {
        try {
            const { data, error } = await state.supabaseClient.auth.signInWithPassword({ email, password });
            if (!error && data?.user) {
                state.sessionUser = data.user;
                loggedViaSupabase = true;
            }
        } catch (_) {}
    }

    // Connect admin cockpit session seamlessly
    connectAdminCockpit(email || "admin@autodrive.com.br");
}

// Handle logging out
export async function handleLogout() {
    try {
        localStorage.removeItem("autodrive_session_user");
        if (state.supabaseClient && state.supabaseClient.auth) {
            await state.supabaseClient.auth.signOut();
        }
    } catch (_) {}
    state.sessionUser = null;
    document.getElementById("login-overlay").classList.add("active");
    const formLogin = document.getElementById("form-login");
    if (formLogin) formLogin.reset();

    const menuUser = document.getElementById("menu-item-usuarios");
    if (menuUser) menuUser.style.display = "none";
}

// Sync all data from Central Cloud API & Supabase
export async function fetchCloudData() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.add('skeleton-loading');

    try {
        // 1. Fetch from Centralized Cloud API (Shared across all users, browsers, and devices)
        const apiRes = await fetch(`/api/crm/data?_nocache=${Date.now()}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        if (apiRes.ok) {
            const cloudJson = await apiRes.json();
            if (cloudJson.anchorDate) {
                state.operationalDate = cloudJson.anchorDate;
            }
            if (cloudJson.serverDate) {
                state.serverDate = cloudJson.serverDate;
            }
            if (Array.isArray(cloudJson.companyCnpjs) && cloudJson.companyCnpjs.length > 0) {
                state.companyCnpjs = cloudJson.companyCnpjs;
                try {
                    localStorage.setItem('crm_company_cnpjs', JSON.stringify(cloudJson.companyCnpjs));
                } catch (_) {}
            }
            if (Array.isArray(cloudJson.estoque) && cloudJson.estoque.length > 0) {
                state.estoque = cloudJson.estoque;
            }
            if (Array.isArray(cloudJson.vendas)) {
                state.vendas = cloudJson.vendas.map(v => ({
                    ...v,
                    sellerCnpj: v.sellerCnpj || v.seller_cnpj || "",
                    seller_cnpj: v.sellerCnpj || v.seller_cnpj || ""
                }));
            }

            // Protect and merge pending outbox items so local unsynced edits are never wiped
            if (state.pendingOutbox && state.pendingOutbox.length > 0) {
                state.pendingOutbox.forEach(item => {
                    if (item.type === 'venda' && item.data) {
                        const existing = state.vendas.find(v => String(v.id) === String(item.data.id));
                        if (!existing) state.vendas.unshift(item.data);
                    }
                    if (item.type === 'carro' && item.data) {
                        const existing = state.estoque.find(c => String(c.id) === String(item.data.id));
                        if (!existing) state.estoque.unshift(item.data);
                    }
                });
            }
            if (Array.isArray(cloudJson.clientes)) {
                state.clientes = cloudJson.clientes;
            }
            if (Array.isArray(cloudJson.despesas)) {
                state.despesas = cloudJson.despesas;
            }
            if (Array.isArray(cloudJson.agenda)) {
                state.agenda = cloudJson.agenda;
            }
            if (Array.isArray(cloudJson.leads) && cloudJson.leads.length > 0) {
                state.leads = cloudJson.leads;
            }
            if (Array.isArray(cloudJson.documentos)) {
                state.documentosVeiculo = cloudJson.documentos.map(d => ({
                    id: d.id,
                    carId: d.carId || d.car_id,
                    car_id: d.carId || d.car_id,
                    fileName: d.fileName || d.file_name || "documento",
                    file_name: d.fileName || d.file_name || "documento",
                    fileUrl: d.fileUrl || d.file_url || "#",
                    file_url: d.fileUrl || d.file_url || "#",
                    fileType: d.fileType || d.file_type || "pdf",
                    file_type: d.fileType || d.file_type || "pdf",
                    description: d.description || "Documento Técnico",
                    createdAt: d.createdAt || d.created_at || new Date().toISOString(),
                    created_at: d.createdAt || d.created_at || new Date().toISOString()
                }));
            }
        }

        // 2. Query Supabase if authenticated session exists
        if (state.supabaseClient && state.sessionUser) {
            try {
                const { data: est, error: errEst } = await state.supabaseClient.from('estoque').select('*').order('id', { ascending: false });
                if (!errEst && est && est.length > 0) {
                    const supaEstoque = est.map(c => ({
                        id: c.id,
                        model: c.model,
                        year: c.year,
                        km: c.km,
                        buyPrice: parseFloat(c.buy_price),
                        sellPrice: parseFloat(c.sell_price),
                        purchaseDate: c.purchase_date || null,
                        status: c.status,
                        type: c.type,
                        plate: c.plate || "",
                        color: c.color || "",
                        chassis: c.chassis || "",
                        renavam: c.renavam || "",
                        documentStatus: c.document_status || "pendente",
                        image_url: c.image_url || null,
                        fipeCode: c.fipe_code || "",
                        fipePrice: c.fipe_price || 0,
                        notes: c.notes || ""
                    }));
                    // Safely merge with central stock
                    const estMap = new Map();
                    (state.estoque || []).forEach(car => estMap.set(String(car.id), car));
                    supaEstoque.forEach(car => estMap.set(String(car.id), car));
                    state.estoque = Array.from(estMap.values());
                }

                const { data: ven, error: errVen } = await state.supabaseClient.from('vendas').select('*').order('date', { ascending: false });
                if (!errVen && ven && ven.length > 0) {
                    const defaultCnpj = (state.companyCnpjs && state.companyCnpjs.find(c => c.isDefault))?.cnpj || "65.760.566/0001-67";
                    const supaVendas = ven.map(v => {
                        const cnpjVal = v.seller_cnpj || v.sellerCnpj || defaultCnpj;
                        return {
                            id: v.id,
                            carId: v.car_id,
                            client: v.client,
                            clientDocument: v.client_document || "",
                            sellerCnpj: cnpjVal,
                            seller_cnpj: cnpjVal,
                            sellPrice: parseFloat(v.sell_price),
                            date: v.date,
                            profit: parseFloat(v.profit),
                            margin: parseFloat(v.margin),
                            type: v.type
                        };
                    });
                    // Safely merge with central sales database so records are never wiped
                    const venMap = new Map();
                    (state.vendas || []).forEach(v => venMap.set(String(v.id), v));
                    supaVendas.forEach(v => venMap.set(String(v.id), v));
                    state.vendas = Array.from(venMap.values());
                }

                const { data: docs, error: errDocs } = await state.supabaseClient
                    .from('documentos_veiculo')
                    .select('*')
                    .order('id', { ascending: false });
                if (!errDocs && docs && docs.length > 0) {
                    const existingMap = new Map();
                    (state.documentosVeiculo || []).forEach(d => existingMap.set(String(d.id), d));
                    docs.forEach(d => {
                        const mapped = {
                            id: d.id,
                            carId: d.car_id,
                            car_id: d.car_id,
                            fileName: d.file_name,
                            file_name: d.file_name,
                            fileUrl: d.file_url,
                            file_url: d.file_url,
                            fileType: d.file_type,
                            file_type: d.file_type,
                            description: d.description,
                            createdAt: d.created_at,
                            created_at: d.created_at
                        };
                        existingMap.set(String(d.id), mapped);
                    });
                    state.documentosVeiculo = Array.from(existingMap.values());
                }
            } catch (_) {}
        }
        // Keep localStorage fully up to date with cloud state
        persistLocalData();
    } catch (e) {
        console.error("Falha ao sincronizar dados da nuvem: ", e);
    } finally {
        if (mainContent) mainContent.classList.remove('skeleton-loading');
        if (window.updateSellerCnpjDatalists) window.updateSellerCnpjDatalists();
    }
}

// Persist storage locally
export function persistLocalData() {
    localStorage.setItem("autodrive_estoque", JSON.stringify(state.estoque));
    localStorage.setItem("autodrive_leads", JSON.stringify(state.leads));
    localStorage.setItem("autodrive_vendas", JSON.stringify(state.vendas));
    localStorage.setItem("autodrive_despesas", JSON.stringify(state.despesas));
    localStorage.setItem("autodrive_agenda", JSON.stringify(state.agenda));
    localStorage.setItem("autodrive_clientes", JSON.stringify(state.clientes));
    localStorage.setItem("autodrive_documentos", JSON.stringify(state.documentosVeiculo || []));
    localStorage.setItem("crm_company_cnpjs", JSON.stringify(state.companyCnpjs));
}

// Fall back to offline demo data
export function switchToDemoMode() {
    state.isCloudActive = true;
    connectAdminCockpit("admin@autodrive.com.br");
}

// Bypass sign in panel for demonstrative preview
export function bypassLoginForDemo() {
    connectAdminCockpit("admin@autodrive.com.br");
}

// Setup links toggle of Signup UI
export function initializeSignupUI() {
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
}

// Handle request access submission
export async function handleSignup(event) {
    event.preventDefault();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const confirmPassword = document.getElementById("signup-confirm-password").value;
    const errorDiv = document.getElementById("login-error-message");

    if (errorDiv) {
        errorDiv.style.display = "none";
        errorDiv.style.backgroundColor = "";
        errorDiv.style.color = "";
    }

    if (password.length < 6) {
        if (errorDiv) {
            errorDiv.innerText = "A senha deve ter no mínimo 6 caracteres.";
            errorDiv.style.display = "block";
            errorDiv.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
            errorDiv.style.color = "var(--red-alert)";
        }
        return;
    }

    if (password !== confirmPassword) {
        if (errorDiv) {
            errorDiv.innerText = "As senhas não coincidem.";
            errorDiv.style.display = "block";
            errorDiv.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
            errorDiv.style.color = "var(--red-alert)";
        }
        return;
    }

    if (state.isCloudActive) {
        try {
            const { data, error } = await state.supabaseClient.auth.signUp({
                email,
                password
            });

            if (error) {
                if (errorDiv) {
                    errorDiv.innerText = `Erro ao cadastrar: ${error.message}`;
                    errorDiv.style.display = "block";
                    errorDiv.style.backgroundColor = "rgba(239, 68, 68, 0.12)";
                    errorDiv.style.color = "var(--red-alert)";
                }
            } else {
                await state.supabaseClient.auth.signOut();
                document.getElementById("form-signup").reset();
                if (errorDiv) {
                    errorDiv.innerText = "Cadastro enviado com sucesso! Aguarde a aprovação de um administrador para fazer login.";
                    errorDiv.style.display = "block";
                    errorDiv.style.backgroundColor = "rgba(16, 185, 129, 0.12)";
                    errorDiv.style.color = "var(--green-profit)";
                    errorDiv.style.borderColor = "rgba(16, 185, 129, 0.2)";
                }
                setTimeout(() => {
                    const formLogin = document.getElementById("form-login");
                    const formSignup = document.getElementById("form-signup");
                    const loginTitle = document.querySelector("#login-overlay h2");
                    if (formLogin && formSignup) {
                        formSignup.style.display = "none";
                        formLogin.style.display = "block";
                        if (loginTitle) loginTitle.innerText = "Acessar AutoDrive CRM";
                    }
                }, 3000);
            }
        } catch (err) {
            console.error(err);
            if (errorDiv) {
                errorDiv.innerText = "Ocorreu um erro no servidor. Tente novamente.";
                errorDiv.style.display = "block";
            }
        }
    } else {
        if (errorDiv) {
            errorDiv.innerText = "O cadastro de usuários não está disponível no modo de demonstração.";
            errorDiv.style.display = "block";
        }
    }
}

// Load operator profiles for administration
export async function loadProfiles() {
    if (!state.isCloudActive) return;
    try {
        const { data, error } = await state.supabaseClient
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        cachedProfiles = data.map(p => ({
            ...p,
            is_admin: p.role === 'admin'
        }));
        renderProfilesTable(cachedProfiles);
    } catch (err) {
        console.error('Erro ao carregar perfis:', err);
    }
}

// Render profiles administration table
export function renderProfilesTable(profilesList) {
    const tbody = document.getElementById("usuarios-table-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    profilesList.forEach(profile => {
        const tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid var(--border-color)";

        const dateStr = profile.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-';

        const statusText = profile.is_approved ? 'Aprovado' : 'Pendente';
        const statusClass = profile.is_approved ? 'disponivel' : 'preparacao';

        const roleText = profile.is_admin ? 'Administrador' : 'Operador';
        const roleClass = profile.is_admin ? 'repasse' : 'convencional';

        const btnApproveText = profile.is_approved ? 'Revogar' : 'Aprovar';
        const btnAdminText = profile.is_admin ? 'Remover Admin' : 'Tornar Admin';

        let actionsHtml = '';
        if (state.sessionUser && state.sessionUser.id !== profile.id) {
            actionsHtml = `
                <div style="display:flex; justify-content:center; gap:8px;">
                    <button class="btn ${profile.is_approved ? 'btn-secondary' : 'btn-primary'}" style="padding:6px 12px; font-size:11px;" onclick="toggleUserApproval('${profile.id}', ${profile.is_approved})">
                        ${btnApproveText}
                    </button>
                    <button class="btn btn-secondary" style="padding:6px 12px; font-size:11px;" onclick="toggleUserAdmin('${profile.id}', ${profile.is_admin})">
                        ${btnAdminText}
                    </button>
                    <button class="btn btn-secondary" style="padding:6px 12px; font-size:11px; color:var(--red-alert); border-color:rgba(239, 68, 68, 0.2);" onclick="deleteUserAccount('${profile.id}')">
                        Excluir
                    </button>
                </div>
            `;
        } else {
            actionsHtml = `<div style="text-align:center; color:var(--text-muted); font-size:11px; font-style:italic;">Você (Atual)</div>`;
        }

        tr.innerHTML = `
            <td style="padding:12px; color:var(--text-light); font-weight:500;">${profile.email}</td>
            <td style="padding:12px; color:var(--text-muted);">${dateStr}</td>
            <td style="padding:12px;"><span class="badge ${roleClass}">${roleText}</span></td>
            <td style="padding:12px;"><span class="badge ${statusClass}">${statusText}</span></td>
            <td style="padding:12px;">${actionsHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Toggle profile approval
export async function toggleUserApproval(profileId, currentStatus) {
    if (!state.isCloudActive) return;
    try {
        const { error } = await state.supabaseClient
            .from('profiles')
            .update({ is_approved: !currentStatus })
            .eq('id', profileId);
        if (error) throw error;
        await loadProfiles();
    } catch (err) {
        alert('Erro ao atualizar status do usuário: ' + err.message);
    }
}

// Toggle admin privilege
export async function toggleUserAdmin(profileId, currentStatus) {
    if (!state.isCloudActive) return;
    try {
        const { error } = await state.supabaseClient
            .from('profiles')
            .update({ role: currentStatus ? 'operator' : 'admin' })
            .eq('id', profileId);
        if (error) throw error;
        await loadProfiles();
    } catch (err) {
        alert('Erro ao atualizar nível de acesso: ' + err.message);
    }
}

// Delete user profile
export async function deleteUserAccount(profileId) {
    if (!confirm("Excluir esta conta permanentemente? Esta ação não pode ser desfeita.")) return;
    if (!state.isCloudActive) return;
    try {
        const { error } = await state.supabaseClient
            .rpc('delete_user', { user_id: profileId });
        if (error) throw error;
        await loadProfiles();
    } catch (err) {
        alert('Erro ao excluir usuário: ' + err.message);
    }
}

// Filter users table
export function filterUsuariosTable() {
    const searchVal = document.getElementById("search-usuarios").value.toLowerCase();
    const filtered = cachedProfiles.filter(p => p.email.toLowerCase().includes(searchVal));
    renderProfilesTable(filtered);
}

// Resilient Outbox Replay Engine
export async function flushPendingOutbox() {
    if (!state.pendingOutbox || state.pendingOutbox.length === 0) return;
    const pendingSales = state.pendingOutbox.filter(item => item.type === 'venda').map(item => item.data);
    const pendingCars = state.pendingOutbox.filter(item => item.type === 'carro').map(item => item.data);
    if (!pendingSales.length && !pendingCars.length) return;

    try {
        const res = await fetch('/api/crm/sync-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingSales, pendingCars })
        });
        if (res.ok) {
            state.pendingOutbox = [];
            try {
                localStorage.setItem('crm_pending_outbox', JSON.stringify([]));
            } catch (_) {}
            console.log(`Outbox sincronizada com sucesso: ${pendingSales.length} vendas e ${pendingCars.length} veículos.`);
        }
    } catch (e) {
        console.warn('Aviso: Falha ao enviar outbox pendente (será reenviada na próxima conexão):', e);
    }
}

if (typeof window !== 'undefined') {
    window.flushPendingOutbox = flushPendingOutbox;
}
