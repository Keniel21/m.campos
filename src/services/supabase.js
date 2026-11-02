// Compatibility exports for the original UI. Persistence uses the local Java API.
import { state } from './state.js';
const rawFetch = window.fetch.bind(window);
let session;
let installed = false;
export const cachedProfiles = [];
function report(error) {
    if (window.showToast) window.showToast(error.message, 'error');
    else console.error(error.message);
}
export function initSupabase() {
    state.isCloudActive = true;
    state.sessionUser = { id: 'adm-master-session', name: 'Operador', role: 'admin' };
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
        if (!['estoque','vendas','clientes','despesas','documentos','company_cnpjs'].includes(this.module)) throw new Error('Cadastro indisponível.');
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
    state.serverDate = data.serverDate;
    state.operationalDate = data.serverDate;
    return data;
}
export async function checkActiveSession() {
    let stage = 'session';
    try {
        const response = await rawFetch('/api/desktop/session', { credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('O servidor local não está disponível. Inicie o backend Java.');
        session = await response.json();
        stage = 'data';
        await fetchCloudData();
        stage = 'render';
        document.getElementById('login-overlay')?.classList.remove('active');
        window.updateApplicationState?.();
        window.initCharts?.();
    } catch (error) {
        console.error(`Falha ao iniciar a aplicação (${stage}):`, error.message);
        const overlay = document.getElementById('login-overlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.innerHTML = '<div class="login-card"><h2>Conexão indisponível</h2><p>Confira o servidor local e a internet. Os dados não foram alterados.</p><button onclick="location.reload()">Tentar novamente</button></div>';
            if (stage === 'render') {
                overlay.querySelector('h2').textContent = 'Erro ao carregar a tela';
                overlay.querySelector('p').textContent = 'Os dados foram carregados, mas não foi possível exibir a tela. Tente novamente.';
            }
        }
        report(error);
    }
}
// Old localStorage and outbox data are never automatically uploaded.
export function persistLocalData() {}
export const connectAdminCockpit = checkActiveSession;
export const handleLogin = async event => { event?.preventDefault(); await checkActiveSession(); };
export const handleLogout = () => location.reload();
export const handleSignup = event => event?.preventDefault();
export const bypassLoginForDemo = checkActiveSession;
export const loadProfiles = async () => [];
export const toggleUserApproval = () => {};
export const toggleUserAdmin = () => {};
export const deleteUserAccount = () => {};
export const filterUsuariosTable = () => {};
