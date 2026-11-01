// ==========================================================================
// AUTO DRIVE CRM - CALENDAR & GOOGLE CALENDAR INTEGRATION
// ==========================================================================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { state } from '../../services/state.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';
import { parseId } from '../../utils/helpers.js';

export let currentCalendarDate = new Date();
export let selectedAgendaDate = new Date();
export let currentGcalView = 'month'; // 'month' | 'week' | 'day' | 'agenda'
export let gcalSearchQuery = '';

export const gcalLayers = {
    google_calendar: true,
    visitas: true,
    entregas: true,
    revisao: true,
    documentos: true
};

// State of Google Calendar OAuth Integration
export const googleCalendarState = {
    isConnected: false,
    user: null, // { name, email, picture }
    accessToken: null,
    events: [],
    lastSynced: null,
    isSyncing: false,
    clientId: localStorage.getItem('autodrive_gcal_client_id') || ''
};

let firebaseAuthInstance = null;

async function getFirebaseAuth() {
    if (firebaseAuthInstance) return firebaseAuthInstance;
    try {
        const res = await fetch('/firebase-applet-config.json');
        if (!res.ok) return null;
        const config = await res.json();
        
        let app;
        if (!getApps().length) {
            app = initializeApp(config);
        } else {
            app = getApps()[0];
        }
        firebaseAuthInstance = getAuth(app);
        return firebaseAuthInstance;
    } catch (e) {
        console.error("Erro ao inicializar Firebase Auth para Google Calendar:", e);
        return null;
    }
}

// Initialize Google Calendar state from localStorage & register listeners
export async function initGoogleCalendar() {
    getFirebaseAuth();

    try {
        const storedToken = localStorage.getItem('autodrive_gcal_token');
        const storedUser = localStorage.getItem('autodrive_gcal_user');
        const storedEvents = localStorage.getItem('autodrive_gcal_events');
        const storedSynced = localStorage.getItem('autodrive_gcal_last_synced');

        if (storedToken) {
            googleCalendarState.accessToken = storedToken;
            googleCalendarState.isConnected = true;
        }
        if (storedUser) {
            googleCalendarState.user = JSON.parse(storedUser);
        }
        if (storedEvents) {
            googleCalendarState.events = JSON.parse(storedEvents);
        }
        if (storedSynced) {
            googleCalendarState.lastSynced = storedSynced;
        }
    } catch (e) {
        console.error("Erro ao carregar estado salvo do Google Calendar:", e);
    }

    if (googleCalendarState.isConnected && googleCalendarState.accessToken) {
        syncGoogleCalendarEvents();
    }

    renderGoogleCalendarApp();
}

// Global Google Calendar App Renderer
export function renderGoogleCalendarApp() {
    renderGoogleAccountWidget();
    renderCalendar(); // Renders Mini Calendar
    renderActiveGcalView();
}

// Renders Account & Sync Status in Header
export function renderGoogleAccountWidget() {
    const container = document.getElementById("gcal-account-widget");
    if (!container) return;

    const isConn = googleCalendarState.isConnected;
    const user = googleCalendarState.user;
    const lastSync = googleCalendarState.lastSynced || 'Nunca';

    if (isConn) {
        const avatarHtml = user?.picture 
            ? `<img src="${user.picture}" style="width:28px; height:28px; border-radius:50%; border:1.5px solid #1a73e8;" alt="${user.name}">`
            : `<div style="width:28px; height:28px; border-radius:50%; background:#1a73e8; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">${(user?.name || 'G')[0]}</div>`;

        container.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; background:rgba(26,115,232,0.08); border:1px solid rgba(26,115,232,0.2); padding:4px 10px; border-radius:20px;">
                ${avatarHtml}
                <div style="display:flex; flex-direction:column; line-height:1.2;">
                    <span style="font-size:12px; font-weight:700; color:var(--text-primary); max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${user?.name || 'Google Agenda'}</span>
                    <span style="font-size:10px; color:#1a73e8; font-weight:600;">Sincronizado ${lastSync}</span>
                </div>
                <button onclick="window.syncGoogleCalendarEvents()" class="gcal-icon-btn" style="width:24px; height:24px;" title="Atualizar agora">
                    <i data-lucide="refresh-cw" style="width:12px; height:12px;"></i>
                </button>
                <button onclick="window.disconnectGoogleCalendar()" class="gcal-icon-btn" style="width:24px; height:24px; color:#ef4444;" title="Desconectar">
                    <i data-lucide="log-out" style="width:12px; height:12px;"></i>
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="window.connectGoogleCalendar()" style="background:#1a73e8; color:#fff; border-radius:18px; font-weight:600; font-size:12px; padding:6px 14px; display:inline-flex; align-items:center; gap:6px;">
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/></svg>
                Conectar Google
            </button>
        `;
    }

    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

// Backward compatibility banner wrapper
export function renderGoogleCalendarBanner() {
    renderGoogleAccountWidget();
}

// Opens Google OAuth authorization popup or flow using Firebase Auth
export async function connectGoogleCalendar() {
    try {
        const auth = await getFirebaseAuth();
        if (!auth) {
            alert("Não foi possível carregar a configuração do Google Auth. Verifique o arquivo firebase-applet-config.json.");
            return;
        }

        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
        provider.addScope('https://www.googleapis.com/auth/calendar.events');

        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);

        if (!credential || !credential.accessToken) {
            throw new Error("Não foi possível obter o Token de Acesso do Google Calendar.");
        }

        const accessToken = credential.accessToken;
        const user = {
            name: result.user.displayName || result.user.email,
            email: result.user.email,
            picture: result.user.photoURL
        };

        googleCalendarState.accessToken = accessToken;
        googleCalendarState.user = user;
        googleCalendarState.isConnected = true;

        localStorage.setItem('autodrive_gcal_token', accessToken);
        localStorage.setItem('autodrive_gcal_user', JSON.stringify(user));

        await syncGoogleCalendarEvents();
    } catch (error) {
        console.error("Erro na autenticação do Google Calendar:", error);
        if (error.code === 'auth/popup-closed-by-user') {
            console.warn("Pop-up fechado pelo usuário.");
        } else {
            alert("Erro ao conectar com Google Agenda: " + (error.message || error));
        }
    }
}

// Disconnects Google Calendar and resets state
export async function disconnectGoogleCalendar() {
    try {
        const auth = await getFirebaseAuth();
        if (auth) {
            await firebaseSignOut(auth);
        }
    } catch (e) {
        console.warn("Erro ao fazer logout do Firebase Auth:", e);
    }

    googleCalendarState.isConnected = false;
    googleCalendarState.accessToken = null;
    googleCalendarState.user = null;
    googleCalendarState.events = [];
    googleCalendarState.lastSynced = null;

    localStorage.removeItem('autodrive_gcal_token');
    localStorage.removeItem('autodrive_gcal_user');
    localStorage.removeItem('autodrive_gcal_events');
    localStorage.removeItem('autodrive_gcal_last_synced');

    renderGoogleCalendarBanner();
    renderCalendar();
    renderAgendaTimeline();
}

// Fetches events from primary Google Calendar API
export async function syncGoogleCalendarEvents() {
    if (!googleCalendarState.accessToken) return;

    googleCalendarState.isSyncing = true;
    renderGoogleCalendarBanner();

    try {
        // 1. Get user profile info
        const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${googleCalendarState.accessToken}` }
        });

        if (userRes.ok) {
            const uData = await userRes.json();
            googleCalendarState.user = {
                name: uData.name || uData.email,
                email: uData.email,
                picture: uData.picture
            };
            localStorage.setItem('autodrive_gcal_user', JSON.stringify(googleCalendarState.user));
        }

        // 2. Fetch events around current date
        const now = new Date();
        const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const timeMax = new Date(now.getFullYear(), now.getMonth() + 3, 1).toISOString();

        const calUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

        const calRes = await fetch(calUrl, {
            headers: { Authorization: `Bearer ${googleCalendarState.accessToken}` }
        });

        if (!calRes.ok) {
            if (calRes.status === 401) {
                // Token expired
                googleCalendarState.isConnected = false;
                googleCalendarState.accessToken = null;
                localStorage.removeItem('autodrive_gcal_token');
                renderGoogleCalendarBanner();
                renderCalendar();
                renderAgendaTimeline();
                return;
            }
            throw new Error(`Google Calendar API Error: ${calRes.status}`);
        }

        const calData = await calRes.json();
        const items = calData.items || [];

        const parsedEvents = items.map(item => {
            const startStr = item.start?.dateTime || item.start?.date || '';
            const endStr = item.end?.dateTime || item.end?.date || '';

            let dateStr = '';
            let timeStr = 'Dia inteiro';
            let endTimeStr = '';

            if (startStr.includes('T')) {
                const dObj = new Date(startStr);
                dateStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;
                timeStr = `${String(dObj.getHours()).padStart(2, '0')}:${String(dObj.getMinutes()).padStart(2, '0')}`;
            } else {
                dateStr = startStr;
            }

            if (endStr.includes('T')) {
                const eObj = new Date(endStr);
                endTimeStr = `${String(eObj.getHours()).padStart(2, '0')}:${String(eObj.getMinutes()).padStart(2, '0')}`;
            }

            return {
                id: `gcal_${item.id}`,
                googleEventId: item.id,
                title: item.summary || '(Sem título)',
                date: dateStr,
                time: timeStr,
                endTime: endTimeStr,
                desc: item.description || '',
                location: item.location || '',
                category: 'google_calendar',
                htmlLink: item.htmlLink,
                hangoutLink: item.hangoutLink || (item.conferenceData?.entryPoints?.[0]?.uri || null),
                isGoogle: true
            };
        });

        googleCalendarState.events = parsedEvents;
        googleCalendarState.isConnected = true;
        googleCalendarState.lastSynced = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        localStorage.setItem('autodrive_gcal_events', JSON.stringify(parsedEvents));
        localStorage.setItem('autodrive_gcal_last_synced', googleCalendarState.lastSynced);

    } catch (err) {
        console.error("Erro ao sincronizar com o Google Calendar:", err);
    } finally {
        googleCalendarState.isSyncing = false;
        renderGoogleCalendarBanner();
        renderCalendar();
        renderAgendaTimeline();
    }
}

// Load demo mirror events for Google Calendar
export function loadDemoGoogleEvents() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const demoEvents = [
        {
            id: 'gcal_demo_1',
            title: 'Reunião de Alinhamento Comercial (Google Calendar)',
            date: todayStr,
            time: '09:00',
            endTime: '10:00',
            desc: 'Alinhamento de metas mensais do setor de vendas.',
            location: 'Google Meet',
            category: 'google_calendar',
            htmlLink: 'https://calendar.google.com',
            hangoutLink: 'https://meet.google.com/abc-defg-hij',
            isGoogle: true
        },
        {
            id: 'gcal_demo_2',
            title: 'Atendimento Cliente Premium (Google Calendar)',
            date: todayStr,
            time: '14:30',
            endTime: '15:30',
            desc: 'Apresentação de propostas para frota corporativa.',
            location: 'Showroom Virtual',
            category: 'google_calendar',
            htmlLink: 'https://calendar.google.com',
            hangoutLink: 'https://meet.google.com/xyz-uvwx-rst',
            isGoogle: true
        }
    ];

    googleCalendarState.events = demoEvents;
    googleCalendarState.isConnected = true;
    googleCalendarState.user = {
        name: 'Operador AutoDrive',
        email: 'operador@autodrive.com.br',
        picture: null
    };
    googleCalendarState.lastSynced = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    renderGoogleCalendarBanner();
    renderCalendar();
    renderAgendaTimeline();
}

// Modal Config Handlers
export function openGoogleCalendarConfigModal() {
    const clientIdInput = document.getElementById("gcal-client-id-input");
    if (clientIdInput) clientIdInput.value = googleCalendarState.clientId || '';
    
    const tokenInput = document.getElementById("gcal-manual-token-input");
    if (tokenInput) tokenInput.value = googleCalendarState.accessToken || '';

    document.getElementById("modal-gcal-config")?.classList.add("active");
}

export function closeGoogleCalendarConfigModal() {
    document.getElementById("modal-gcal-config")?.classList.remove("active");
}

export async function saveGoogleCalendarConfig() {
    const clientId = document.getElementById("gcal-client-id-input")?.value.trim() || '';
    const token = document.getElementById("gcal-manual-token-input")?.value.trim() || '';

    if (clientId) {
        googleCalendarState.clientId = clientId;
        localStorage.setItem('autodrive_gcal_client_id', clientId);
    }
    if (token) {
        googleCalendarState.accessToken = token;
        googleCalendarState.isConnected = true;
        localStorage.setItem('autodrive_gcal_token', token);
        await syncGoogleCalendarEvents();
    }

    closeGoogleCalendarConfigModal();
    renderGoogleCalendarBanner();
    renderCalendar();
    renderAgendaTimeline();
}

export function calendarPrevMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
}

export function calendarNextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
}

// Renders the interactive Monthly Grid Calendar including Google Calendar event markers
export function renderCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const miniMonthTitle = document.getElementById("gcal-mini-month-year");
    if (miniMonthTitle) miniMonthTitle.innerText = `${monthNames[month]} de ${year}`;

    const daysContainer = document.getElementById("agenda-cal-days");
    if (!daysContainer) return;
    daysContainer.innerHTML = "";

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    const crmEventDates = new Set(state.agenda.map(a => a.date));
    const gcalEventDates = new Set(googleCalendarState.events.map(g => g.date));

    // Fill blank previous month padding blocks
    for (let x = firstDayIndex; x > 0; x--) {
        const d = prevLastDay - x + 1;
        const span = document.createElement("span");
        span.className = "gcal-mini-day text-muted";
        span.innerText = d;
        span.style.opacity = "0.4";
        daysContainer.appendChild(span);
    }

    // Render active current month blocks
    for (let i = 1; i <= lastDay; i++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const span = document.createElement("span");
        span.className = "gcal-mini-day";
        span.innerText = i;

        if (crmEventDates.has(dStr) || gcalEventDates.has(dStr)) {
            span.classList.add("has-event");
        }

        const selY = selectedAgendaDate.getFullYear();
        const selM = selectedAgendaDate.getMonth();
        const selD = selectedAgendaDate.getDate();
        if (selY === year && selM === month && selD === i) {
            span.classList.add("active");
        }

        span.onclick = () => {
            selectedAgendaDate = new Date(year, month, i);
            renderCalendar();
            renderActiveGcalView();
        };

        daysContainer.appendChild(span);
    }
}

// Switch Active Google Calendar View (Mês, Semana, Dia, Agenda)
export function switchGcalView(view) {
    currentGcalView = view;
    ['month', 'week', 'day', 'agenda'].forEach(v => {
        const pane = document.getElementById(`gcal-view-${v}`);
        const btn = document.getElementById(`gcal-vbtn-${v}`);
        if (pane) pane.style.display = (v === view) ? (v === 'month' ? 'flex' : 'block') : 'none';
        if (btn) btn.classList.toggle('active', v === view);
    });
    renderActiveGcalView();
}

export function gcalGoToToday() {
    currentCalendarDate = new Date();
    selectedAgendaDate = new Date();
    renderGoogleCalendarApp();
}

export function gcalNavPrev() {
    if (currentGcalView === 'month') {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    } else if (currentGcalView === 'week') {
        currentCalendarDate.setDate(currentCalendarDate.getDate() - 7);
    } else if (currentGcalView === 'day' || currentGcalView === 'agenda') {
        selectedAgendaDate.setDate(selectedAgendaDate.getDate() - 1);
    }
    renderGoogleCalendarApp();
}

export function gcalNavNext() {
    if (currentGcalView === 'month') {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    } else if (currentGcalView === 'week') {
        currentCalendarDate.setDate(currentCalendarDate.getDate() + 7);
    } else if (currentGcalView === 'day' || currentGcalView === 'agenda') {
        selectedAgendaDate.setDate(selectedAgendaDate.getDate() + 1);
    }
    renderGoogleCalendarApp();
}

export function toggleGcalLayer(layerKey, isChecked) {
    gcalLayers[layerKey] = isChecked;
    renderActiveGcalView();
}

export function gcalFilterEvents(query) {
    gcalSearchQuery = (query || '').toLowerCase().trim();
    renderActiveGcalView();
}

// Filter events by layer toggles and search text
export function getFilteredEvents() {
    const crmEvents = state.agenda.map(evt => ({
        ...evt,
        isGoogle: false,
        category: evt.category || 'visitas'
    }));

    const gcalEvents = googleCalendarState.events.map(evt => ({
        ...evt,
        isGoogle: true,
        category: 'google_calendar'
    }));

    const allEvents = [...crmEvents, ...gcalEvents];

    return allEvents.filter(evt => {
        const catKey = evt.isGoogle ? 'google_calendar' : (evt.category || 'visitas');
        if (gcalLayers[catKey] === false) return false;

        if (gcalSearchQuery) {
            const titleMatch = (evt.title || '').toLowerCase().includes(gcalSearchQuery);
            const descMatch = (evt.desc || '').toLowerCase().includes(gcalSearchQuery);
            const locMatch = (evt.location || '').toLowerCase().includes(gcalSearchQuery);
            return titleMatch || descMatch || locMatch;
        }

        return true;
    });
}

// Main View Router
export function renderActiveGcalView() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const headerTitle = document.getElementById("gcal-header-date-title");
    if (headerTitle) headerTitle.innerText = `${monthNames[month]} de ${year}`;

    if (currentGcalView === 'month') {
        renderMonthGrid();
    } else if (currentGcalView === 'week') {
        renderWeekGrid();
    } else if (currentGcalView === 'day') {
        renderDayGrid();
    } else {
        renderAgendaTimeline();
    }
}

// 1. Renders Full Month Grid (Mês)
export function renderMonthGrid() {
    const grid = document.getElementById("gcal-month-grid-body");
    if (!grid) return;
    grid.innerHTML = "";

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const events = getFilteredEvents();

    // Previous month cells
    for (let x = firstDayIndex; x > 0; x--) {
        const dayNum = prevLastDay - x + 1;
        const cell = document.createElement("div");
        cell.className = "gcal-month-cell other-month";
        cell.innerHTML = `<div class="gcal-month-cell-header"><span class="gcal-day-number">${dayNum}</span></div>`;
        grid.appendChild(cell);
    }

    // Active month cells
    for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isToday = (dateStr === todayStr);

        const cell = document.createElement("div");
        cell.className = `gcal-month-cell ${isToday ? 'is-today' : ''}`;

        const headerDiv = document.createElement("div");
        headerDiv.className = "gcal-month-cell-header";
        headerDiv.innerHTML = `<span class="gcal-day-number">${d}</span>`;
        cell.appendChild(headerDiv);

        const dayEvents = events.filter(e => e.date === dateStr);

        const chipsList = document.createElement("div");
        chipsList.className = "gcal-event-chips-list";

        dayEvents.forEach(evt => {
            const chip = document.createElement("div");
            const chipClass = evt.isGoogle ? 'chip-google' : `chip-${evt.category || 'visitas'}`;
            chip.className = `gcal-event-chip ${chipClass}`;
            
            const timeText = evt.time ? `${evt.time} ` : '';
            chip.innerHTML = `<span style="font-weight:700;">${timeText}</span><span style="overflow:hidden; text-overflow:ellipsis;">${evt.title}</span>`;

            chip.onclick = (e) => {
                e.stopPropagation();
                openGcalEventPopover(evt);
            };

            chipsList.appendChild(chip);
        });

        cell.appendChild(chipsList);

        cell.onclick = () => {
            selectedAgendaDate = new Date(year, month, d);
            const ageDateInput = document.getElementById("age-date");
            if (ageDateInput) ageDateInput.value = dateStr;
            openAddAgendaModal();
        };

        grid.appendChild(cell);
    }
}

// 2. Renders Hourly Week Grid (Semana)
export function renderWeekGrid() {
    const headerRow = document.getElementById("gcal-week-header-row");
    const gridBody = document.getElementById("gcal-week-grid-body");
    if (!headerRow || !gridBody) return;

    headerRow.innerHTML = `<div class="gcal-day-col-header" style="width:60px;">GMT-3</div>`;
    gridBody.innerHTML = "";

    const startOfWeek = new Date(currentCalendarDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const events = getFilteredEvents();

    for (let i = 0; i < 7; i++) {
        const dObj = new Date(startOfWeek);
        dObj.setDate(dObj.getDate() + i);
        const dayName = dObj.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase();
        const dateNum = dObj.getDate();

        headerRow.innerHTML += `<div class="gcal-day-col-header">${dayName} ${dateNum}</div>`;
    }

    for (let hour = 8; hour <= 20; hour++) {
        const row = document.createElement("div");
        row.className = "gcal-time-slot-row";
        const hourStr = `${String(hour).padStart(2, '0')}:00`;
        row.innerHTML = `<div class="gcal-time-label">${hourStr}</div>`;

        for (let i = 0; i < 7; i++) {
            const dObj = new Date(startOfWeek);
            dObj.setDate(dObj.getDate() + i);
            const dateStr = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}`;

            const col = document.createElement("div");
            col.style.borderRight = "1px solid var(--border-subtle, #e5e7eb)";
            col.style.padding = "2px";
            col.style.cursor = "pointer";

            const slotEvts = events.filter(e => e.date === dateStr && e.time && e.time.startsWith(String(hour).padStart(2, '0')));
            slotEvts.forEach(evt => {
                const chip = document.createElement("div");
                chip.className = `gcal-event-chip ${evt.isGoogle ? 'chip-google' : `chip-${evt.category || 'visitas'}`}`;
                chip.innerText = evt.title;
                chip.onclick = (e) => {
                    e.stopPropagation();
                    openGcalEventPopover(evt);
                };
                col.appendChild(chip);
            });

            col.onclick = () => {
                selectedAgendaDate = dObj;
                const ageDateInput = document.getElementById("age-date");
                if (ageDateInput) ageDateInput.value = dateStr;
                const ageTimeInput = document.getElementById("age-time");
                if (ageTimeInput) ageTimeInput.value = hourStr;
                openAddAgendaModal();
            };

            row.appendChild(col);
        }

        gridBody.appendChild(row);
    }
}

// 3. Renders Single Day Grid (Dia)
export function renderDayGrid() {
    const gridBody = document.getElementById("gcal-day-grid-body");
    const dayTitle = document.getElementById("gcal-day-header-title");
    if (!gridBody) return;

    gridBody.innerHTML = "";
    const y = selectedAgendaDate.getFullYear();
    const m = String(selectedAgendaDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedAgendaDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    if (dayTitle) {
        dayTitle.innerHTML = `<h3 style="margin:16px 20px 8px 20px; font-size:16px; font-weight:700;">${selectedAgendaDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>`;
    }

    const events = getFilteredEvents().filter(e => e.date === dateStr);

    for (let hour = 8; hour <= 20; hour++) {
        const hourStr = `${String(hour).padStart(2, '0')}:00`;
        const row = document.createElement("div");
        row.className = "gcal-time-slot-row";
        row.style.minHeight = "60px";

        const label = document.createElement("div");
        label.className = "gcal-time-label";
        label.innerText = hourStr;

        const content = document.createElement("div");
        content.style.padding = "4px 12px";
        content.style.display = "flex";
        content.style.flexDirection = "column";
        content.style.gap = "4px";

        const hourEvts = events.filter(e => e.time && e.time.startsWith(String(hour).padStart(2, '0')));
        hourEvts.forEach(evt => {
            const card = document.createElement("div");
            card.className = `gcal-event-chip ${evt.isGoogle ? 'chip-google' : `chip-${evt.category || 'visitas'}`}`;
            card.style.padding = "8px 12px";
            card.style.fontSize = "12px";
            card.innerHTML = `<strong style="margin-right:6px;">${evt.time}</strong> ${evt.title}`;
            card.onclick = (e) => {
                e.stopPropagation();
                openGcalEventPopover(evt);
            };
            content.appendChild(card);
        });

        row.appendChild(label);
        row.appendChild(content);
        gridBody.appendChild(row);
    }
}

// Open Google Calendar Event Popover Modal
export function openGcalEventPopover(evt) {
    const popover = document.getElementById("modal-gcal-event-popover");
    if (!popover) return;

    document.getElementById("gcal-popover-title").innerText = evt.title;

    const badge = document.getElementById("gcal-popover-category-badge");
    const header = document.getElementById("gcal-popover-header");
    if (badge && header) {
        if (evt.isGoogle) {
            badge.innerText = "Google Agenda";
            badge.style.background = "rgba(255,255,255,0.25)";
            header.style.background = "#1a73e8";
        } else {
            const catNames = {
                visitas: "Visitas & Apresentações",
                entregas: "Entregas de Carros",
                revisao: "Revisão & Estética",
                documentos: "Vistorias & Cartório"
            };
            const catColors = {
                visitas: "#3b82f6",
                entregas: "#10b981",
                revisao: "#f59e0b",
                documentos: "#8b5cf6"
            };
            badge.innerText = catNames[evt.category] || "Compromisso CRM";
            header.style.background = catColors[evt.category] || "#3b82f6";
        }
    }

    const dObj = new Date(`${evt.date}T12:00:00`);
    const dateFormatted = dObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById("gcal-popover-date").innerText = dateFormatted;
    document.getElementById("gcal-popover-time").innerText = evt.endTime ? `${evt.time} - ${evt.endTime}` : (evt.time || 'Dia inteiro');

    const meetContainer = document.getElementById("gcal-popover-meet-container");
    const meetBtn = document.getElementById("gcal-popover-meet-btn");
    if (evt.hangoutLink) {
        meetContainer.style.display = "block";
        meetBtn.href = evt.hangoutLink;
    } else {
        meetContainer.style.display = "none";
    }

    const locRow = document.getElementById("gcal-popover-location-row");
    const locText = document.getElementById("gcal-popover-location");
    if (evt.location) {
        locRow.style.display = "flex";
        locText.innerText = evt.location;
    } else {
        locRow.style.display = "none";
    }

    document.getElementById("gcal-popover-desc").innerText = evt.desc || 'Sem descrição adicional.';

    const carRow = document.getElementById("gcal-popover-car-row");
    const carText = document.getElementById("gcal-popover-car-text");
    if (!evt.isGoogle && evt.carId) {
        const car = state.estoque.find(c => c.id === evt.carId);
        if (car) {
            carRow.style.display = "flex";
            carText.innerText = `#${car.id} - ${car.model}`;
        } else {
            carRow.style.display = "none";
        }
    } else {
        carRow.style.display = "none";
    }

    const sourceBadge = document.getElementById("gcal-popover-source-badge");
    const actionsDiv = document.getElementById("gcal-popover-actions");
    if (evt.isGoogle) {
        sourceBadge.innerText = `Origem: Google Agenda (${googleCalendarState.user?.email || 'API'})`;
        actionsDiv.innerHTML = evt.htmlLink ? `
            <a href="${evt.htmlLink}" target="_blank" class="btn btn-primary btn-sm" style="background:#1a73e8; color:#fff;">
                <i data-lucide="external-link" style="width:12px; height:12px;"></i> Abrir no Google Agenda
            </a>
        ` : '';
    } else {
        sourceBadge.innerText = `Origem: AutoDrive CRM`;
        actionsDiv.innerHTML = `
            <button class="btn btn-secondary btn-sm" onclick="window.closeGcalEventPopover(); window.openEditAgendaModal(${evt.id});">
                <i data-lucide="pencil" style="width:12px; height:12px;"></i> Editar
            </button>
            <button class="btn btn-danger btn-sm" style="background:#ef4444; color:#fff;" onclick="window.closeGcalEventPopover(); window.deleteAgendaConfirm(${evt.id});">
                <i data-lucide="trash-2" style="width:12px; height:12px;"></i> Excluir
            </button>
        `;
    }

    popover.classList.add("active");
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

export function closeGcalEventPopover() {
    document.getElementById("modal-gcal-event-popover")?.classList.remove("active");
}

// Renders agenda timeline combining local CRM appointments & Google Calendar mirror events
export function renderAgendaTimeline() {
    const timeline = document.getElementById("agenda-timeline-body");
    if (!timeline) return;
    timeline.innerHTML = "";

    const y = selectedAgendaDate.getFullYear();
    const m = String(selectedAgendaDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedAgendaDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const title = document.getElementById("agenda-timeline-title");
    if (title) {
        const today = new Date();
        if (today.getFullYear() === y && today.getMonth() === selectedAgendaDate.getMonth() && today.getDate() === selectedAgendaDate.getDate()) {
            title.innerText = `Compromissos Agendados (Hoje)`;
        } else {
            title.innerText = `Compromissos Agendados (${d}/${m}/${y})`;
        }
    }

    // Filter CRM local events
    const crmEvents = state.agenda.filter(a => a.date === dateStr);
    // Filter Google Calendar events
    const gcalEvents = googleCalendarState.events.filter(g => g.date === dateStr);

    // Merge and sort by time
    const mergedEvents = [...crmEvents, ...gcalEvents].sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (mergedEvents.length === 0) {
        timeline.innerHTML = `<div style="text-align:center; padding: 30px; color: var(--text-muted); border: 1px dashed var(--border-subtle); border-radius: var(--radius-md);">Nenhum compromisso agendado para esta data.</div>`;
        return;
    }

    mergedEvents.forEach(evt => {
        const item = document.createElement("div");

        if (evt.isGoogle) {
            // Render Google Calendar event card
            item.className = `timeline-event google_calendar`;
            const meetBtn = evt.hangoutLink ? `
                <a href="${evt.hangoutLink}" target="_blank" class="btn btn-meet" style="padding:4px 10px; font-size:11px; display:inline-flex; align-items:center; gap:4px; text-decoration:none; border-radius:6px;">
                    <i data-lucide="video" style="width:12px; height:12px;"></i> Entrar no Meet
                </a>
            ` : '';

            const linkBtn = evt.htmlLink ? `
                <a href="${evt.htmlLink}" target="_blank" class="btn btn-secondary" style="padding:4px 8px; font-size:11px; text-decoration:none;" title="Abrir no Google Agenda">
                    <i data-lucide="external-link" style="width:12px; height:12px;"></i>
                </a>
            ` : '';

            const timeDisplay = evt.endTime ? `${evt.time} - ${evt.endTime}` : evt.time;

            item.innerHTML = `
                <div class="event-time" style="color:#4285f4; font-weight:700;">${timeDisplay}</div>
                <div class="event-badge-line"><span class="event-circle" style="background:#4285f4;"></span></div>
                <div class="event-content" style="border-left: 2px solid #4285f4; padding-left:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                <span style="background:rgba(66,133,244,0.15); color:#4285f4; font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                                    <i data-lucide="calendar" style="width:10px; height:10px;"></i> Google Agenda
                                </span>
                                ${evt.location ? `<span style="font-size:11px; color:var(--text-muted);"><i data-lucide="map-pin" style="width:10px; height:10px;"></i> ${evt.location}</span>` : ''}
                            </div>
                            <h4 style="margin:0 0 4px 0; color:var(--text-light); font-size:14px;">${evt.title}</h4>
                            ${evt.desc ? `<p style="margin:0; font-size:12px; color:var(--text-muted);">${evt.desc}</p>` : ''}
                        </div>
                        <div style="display:flex; gap:6px; flex-shrink:0; align-items:center;">
                            ${meetBtn}
                            ${linkBtn}
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Render local CRM event card
            const car = state.estoque.find(c => c.id === evt.carId);
            const carText = car ? `<div class="event-car"><i data-lucide="car"></i> ${car.model}</div>` : '';
            item.className = `timeline-event ${evt.category}`;
            item.innerHTML = `
                <div class="event-time">${evt.time}</div>
                <div class="event-badge-line"><span class="event-circle"></span></div>
                <div class="event-content">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <h4>${evt.title}</h4>
                            <p>${evt.desc || ''}</p>
                            ${carText}
                        </div>
                        <div style="display:flex;gap:6px;flex-shrink:0;margin-left:12px;">
                            <button class="btn btn-secondary" style="padding:4px 8px;font-size:11px" onclick="window.openEditAgendaModal(${evt.id})" title="Editar"><i data-lucide="pencil" style="width:12px;height:12px;"></i></button>
                            <button class="btn" style="padding:4px 8px;font-size:11px;background-color:rgba(239,68,68,0.15);color:var(--red-alert);border:1px solid rgba(239,68,68,0.2)" onclick="window.deleteAgendaConfirm(${evt.id})" title="Excluir"><i data-lucide="trash-2" style="width:12px;height:12px;"></i></button>
                        </div>
                    </div>
                </div>`;
        }

        timeline.appendChild(item);
    });

    populateAgendaCarSelect();
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

// Populates dropdown selects with car specs
export function populateAgendaCarSelect(targetId = 'age-car') {
    const select = document.getElementById(targetId);
    if (!select) return;

    select.innerHTML = `<option value="">Compromisso Geral (Sem veículo específico)</option>` +
        state.estoque.map(car => `<option value="${car.id}">#${car.id} - ${car.model}</option>`).join('');
}

export function openAddAgendaModal() {
    populateAgendaCarSelect('age-car');
    const modal = document.getElementById("modal-add-agenda");
    if (modal) modal.classList.add("active");
}

export function closeAddAgendaModal() {
    const modal = document.getElementById("modal-add-agenda");
    if (modal) modal.classList.remove("active");
    document.getElementById("form-add-agenda")?.reset();
}

export async function saveNewAgenda(event) {
    event.preventDefault();
    const title = document.getElementById("age-title").value.trim();
    const date = document.getElementById("age-date").value;
    const time = document.getElementById("age-time").value;
    const carIdVal = document.getElementById("age-car").value;
    const carId = carIdVal ? parseId(carIdVal) : null;
    const category = document.getElementById("age-cat").value;
    const desc = document.getElementById("age-desc").value.trim();
    const syncGcal = document.getElementById("age-sync-gcal")?.checked || false;

    const agendaData = {
        title, date, time,
        car_id: carId,
        category,
        description: desc
    };

    if (state.isCloudActive) {
        try {
            const { error } = await state.supabaseClient.from('agenda').insert([agendaData]);
            if (error) throw error;
            await fetchCloudData();
        } catch (e) {
            console.error(e);
        }
    } else {
        const newId = state.agenda.length > 0 ? Math.max(...state.agenda.map(a => a.id)) + 1 : 1;
        state.agenda.push({ id: newId, title, date, time, carId, category, desc });
        persistLocalData();
    }

    // Sync to Google Calendar if requested and token is present
    if (syncGcal && googleCalendarState.accessToken) {
        try {
            const car = state.estoque.find(c => c.id === carId);
            const fullDesc = `${desc}${car ? `\nVeículo: ${car.model}` : ''}`;
            const startIso = `${date}T${time}:00`;
            const endDate = new Date(`${date}T${time}:00`);
            endDate.setHours(endDate.getHours() + 1);
            const endIso = endDate.toISOString();

            await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleCalendarState.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: title,
                    description: fullDesc,
                    start: { dateTime: new Date(startIso).toISOString() },
                    end: { dateTime: endIso }
                })
            });
            await syncGoogleCalendarEvents();
        } catch (err) {
            console.error("Erro ao sincronizar com Google Calendar:", err);
        }
    }

    window.updateApplicationState();
    closeAddAgendaModal();
}

export function openEditAgendaModal(agendaId) {
    const evt = state.agenda.find(a => a.id === agendaId);
    if (!evt) return;
    populateAgendaCarSelect('edit-age-car');
    document.getElementById("edit-age-id").value = evt.id;
    document.getElementById("edit-age-title").value = evt.title;
    document.getElementById("edit-age-date").value = evt.date;
    document.getElementById("edit-age-time").value = evt.time;
    document.getElementById("edit-age-car").value = evt.carId || '';
    document.getElementById("edit-age-cat").value = evt.category;
    document.getElementById("edit-age-desc").value = evt.desc;
    document.getElementById("modal-edit-agenda").classList.add("active");
}

export function closeEditAgendaModal() {
    document.getElementById("modal-edit-agenda")?.classList.remove("active");
}

export async function saveEditAgenda(event) {
    event.preventDefault();
    const agendaId = parseId(document.getElementById("edit-age-id").value);
    const title = document.getElementById("edit-age-title").value.trim();
    const date = document.getElementById("edit-age-date").value;
    const time = document.getElementById("edit-age-time").value;
    const carIdVal = document.getElementById("edit-age-car").value;
    const carId = carIdVal ? parseId(carIdVal) : null;
    const category = document.getElementById("edit-age-cat").value;
    const desc = document.getElementById("edit-age-desc").value.trim();

    if (state.isCloudActive) {
        try {
            await state.supabaseClient.from('agenda').update({ title, date, time, car_id: carId, category, description: desc }).eq('id', agendaId);
            await fetchCloudData();
        } catch (e) {
            console.error(e);
        }
    } else {
        const evt = state.agenda.find(a => a.id === agendaId);
        if (evt) Object.assign(evt, { title, date, time, carId, category, desc });
        persistLocalData();
    }

    window.updateApplicationState();
    closeEditAgendaModal();
}

export async function deleteAgendaConfirm(agendaId) {
    const doDelete = async () => {
        if (state.isCloudActive) {
            try {
                await state.supabaseClient.from('agenda').delete().eq('id', agendaId);
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            }
        } else {
            state.agenda = state.agenda.filter(a => String(a.id) !== String(agendaId));
            persistLocalData();
        }
        window.updateApplicationState();
    };

    if (window.showCustomConfirm) {
        window.showCustomConfirm("Excluir Compromisso", "Excluir este compromisso da agenda? Esta ação não pode ser desfeita.", doDelete, "Excluir");
    } else if (confirm("Excluir este compromisso da agenda? Esta ação não pode ser desfeita.")) {
        await doDelete();
    }
}

// Attach all functions to window object for HTML inline handlers
window.initGoogleCalendar = initGoogleCalendar;
window.connectGoogleCalendar = connectGoogleCalendar;
window.disconnectGoogleCalendar = disconnectGoogleCalendar;
window.syncGoogleCalendarEvents = syncGoogleCalendarEvents;
window.loadDemoGoogleEvents = loadDemoGoogleEvents;
window.openGoogleCalendarConfigModal = openGoogleCalendarConfigModal;
window.closeGoogleCalendarConfigModal = closeGoogleCalendarConfigModal;
window.saveGoogleCalendarConfig = saveGoogleCalendarConfig;
window.switchGcalView = switchGcalView;
window.gcalGoToToday = gcalGoToToday;
window.gcalNavPrev = gcalNavPrev;
window.gcalNavNext = gcalNavNext;
window.toggleGcalLayer = toggleGcalLayer;
window.gcalFilterEvents = gcalFilterEvents;
window.openGcalEventPopover = openGcalEventPopover;
window.closeGcalEventPopover = closeGcalEventPopover;
window.openAddAgendaModal = openAddAgendaModal;
window.closeAddAgendaModal = closeAddAgendaModal;
window.saveNewAgenda = saveNewAgenda;
window.openEditAgendaModal = openEditAgendaModal;
window.closeEditAgendaModal = closeEditAgendaModal;
window.saveEditAgenda = saveEditAgenda;
window.deleteAgendaConfirm = deleteAgendaConfirm;

