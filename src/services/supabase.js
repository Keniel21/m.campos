// Compatibility exports for the original UI. Persistence uses the local Java API.
import { state } from './state.js';
const rawFetch = window.fetch.bind(window);
let session;
let installed = false;
let signingIn = false;
let expired = false;
export const cachedProfiles = [];
function report(error) {
    if (window.showToast) window.showToast(error.message, 'error');
    else console.error(error.message);
}
export function initSupabase() {
    state.isCloudActive = true;
    state.sessionUser = null;
    state.supabaseClient = { from: table => new LocalQuery(table) };
    if (installed) return;
    installed = true;
    window.fetch = async (input, options = {}) => {
        const url = new URL(typeof input === 'string' ? input : input.url, location.href);
        if (url.origin !== location.origin || !/^\/api\/(crm|company-cnpjs)(\/|$)/.test(url.pathname)) return rawFetch(input, options);
        url.pathname = '/api/desktop' + url.pathname.substring(4);
        const headers = new Headers(options.headers);
        const method = (options.method || 'GET').toUpperCase();
        const write = !['GET', 'HEAD'].includes(method);
        if (write && session) headers.set(session.header, session.token);
        try {
            const response = await rawFetch(url, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
            if (response.status === 401 && session?.mode === 'web') {
                if (!expired) { expired = true; location.reload(); }
                throw new Error('Sua sessão expirou. Entre novamente.');
            }
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || body.message || 'Não foi possível salvar. Confira a conexão e tente novamente.');
            }
            return response;
        } catch (error) {
            if (write) {
                await fetchCloudData().catch(() => {});
                window.updateApplicationState?.();
                report(error);
            }
            throw error;
        }
    };
}
class LocalQuery {
    constructor(table) { this.module = table === 'documentos_veiculo' ? 'documentos' : table; this.method = 'GET'; }
    insert(body) { this.method = 'POST'; this.body = body; return this; }
    update(body) { this.method = 'PUT'; this.body = body; return this; }
    delete() { this.method = 'DELETE'; return this; }
    select() { return this; }
    order() { return this; }
    eq(key, value) { if (key !== 'id') throw new Error('Filtro não suportado.'); this.id = value; return this; }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
    catch(reject) { return this.execute().catch(reject); }
    async execute() {
        if (!['estoque','vendas','clientes','despesas','documentos','company_cnpjs','pendencias','status_mc_options','status_options'].includes(this.module)) throw new Error('Cadastro indisponível.');
        if (['PUT','DELETE'].includes(this.method) && this.id == null) throw new Error('Selecione um registro.');
        const url = `/api/crm/${this.module}` + (this.id == null ? '' : `/${encodeURIComponent(this.id)}`);
        const bodies = Array.isArray(this.body) ? this.body : [this.body];
        const data = [];
        for (const body of bodies) {
            const response = await fetch(url, { method: this.method, headers: { 'Content-Type': 'application/json' },
                ...(body == null ? {} : { body: JSON.stringify(body) }) });
            const saved = await response.json();
            if (Array.isArray(saved)) data.push(...saved); else data.push(saved.car || saved.sale || saved.item || saved);
        }
        if (this.method !== 'GET') await fetchCloudData();
        return { data, error: null };
    }
}
export async function fetchCloudData() {
    const response = await fetch('/api/crm/data');
    const data = await response.json();
    for (const key of ['estoque','vendas','clientes','despesas','leads','agenda']) state[key] = Array.isArray(data[key]) ? data[key] : [];
    state.companyCnpjs = data.company_cnpjs || data.companyCnpjs || [];
    state.documentosVeiculo = data.documentos || [];
    state.pendencias = data.pendencias || [];
    state.status_mc_options = data.status_mc_options || [];
    state.status_options = data.status_options || [];
    state.serverDate = data.serverDate;
    state.operationalDate = data.serverDate;
    return data;
}
export async function checkActiveSession() {
    let stage = 'session';
    try {
        const response = await rawFetch('/api/desktop/session', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Não foi possível acessar o sistema. Confira a conexão e tente novamente.');
        session = await response.json();
        const logout = document.getElementById('btn-web-logout');
        if (logout) logout.style.display = 'none';
        if (session.mode === 'web' && !session.authenticated) {
            document.getElementById('login-overlay')?.classList.add('active');
            return false;
        }
        state.sessionUser = { id: 'adm-master-session', name: session.userName || 'Operador', role: 'admin' };
        stage = 'data';
        await fetchCloudData();
        stage = 'render';
        window.updateApplicationState?.();
        document.getElementById('login-overlay')?.classList.remove('active');
        if (logout && session.mode === 'web') logout.style.display = 'inline-flex';
        window.initCharts?.();
        return true;
    } catch (error) {
        console.error(`Falha ao iniciar a aplicação (${stage}):`, error.message);
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.classList.add('active');
            loginError(stage === 'render' ? 'Os dados foram carregados, mas houve um erro ao exibir a tela. Atualize a página.' : error.message);
        }
        report(error);
        return false;
    }
}
// Old localStorage and outbox data are never automatically uploaded.
export function persistLocalData() {}
export const connectAdminCockpit = checkActiveSession;
function loginError(message) {
    const box = document.getElementById('login-error-message');
    if (box) { box.textContent = message; box.style.display = message ? 'block' : 'none'; }
}
export async function handleLogin(event) {
    event?.preventDefault();
    if (signingIn) return;
    signingIn = true;
    const button = document.querySelector('#form-login button[type="submit"]');
    if (button) button.disabled = true;
    loginError('');
    try {
        const response = await rawFetch('/api/desktop/session', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Não foi possível acessar o sistema. Tente novamente.');
        session = await response.json();
        if (session.mode === 'web') {
            const body = new URLSearchParams({ email: document.getElementById('login-email').value.trim(), password: document.getElementById('login-password').value });
            const result = await rawFetch('/api/web/login', { method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', [session.header]: session.token }, body });
            if (!result.ok) throw new Error(result.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente novamente.' : result.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Atualize a página e tente novamente.');
            document.getElementById('login-password').value = '';
        }
        await checkActiveSession(); // Login rotates the CSRF token and the session id.
    } catch (error) { loginError(error.message); }
    finally { signingIn = false; if (button) button.disabled = false; }
}
export async function handleLogout() {
    try {
        if (session?.mode === 'web') {
            const response = await rawFetch('/api/web/logout', { method: 'POST', credentials: 'same-origin',
                headers: { [session.header]: session.token }, cache: 'no-store' });
            if (!response.ok) throw new Error('Não foi possível sair. Tente novamente.');
        }
        location.reload(); // Drop all private in-memory data and rendered forms.
    } catch (error) { report(error); }
}
export const handleSignup = event => event?.preventDefault();
export const bypassLoginForDemo = checkActiveSession;
export const loadProfiles = async () => [];
export const toggleUserApproval = () => {};
export const toggleUserAdmin = () => {};
export const deleteUserAccount = () => {};
export const filterUsuariosTable = () => {};
