// ==========================================================================
// AUTO DRIVE CRM - AUTO AGENTE (LLM CO-PILOT WITH GEMINI 3.7 FLASH)
// ==========================================================================

import { state } from '../../services/state.js';
import { formatCurrency, parseCurrencyBR, parseId } from '../../utils/helpers.js';
import { persistLocalData, fetchCloudData } from '../../services/supabase.js';

export let autoAgenteHistory = [];
export let isAutoAgenteOpen = false;
export let isVoiceListening = false;
let speechRecognitionInstance = null;

// Initialize Auto Agente
export function initAutoAgente() {
    // Load persisted chat history if exists
    try {
        const saved = localStorage.getItem('autodrive_autoagente_history');
        if (saved) {
            autoAgenteHistory = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Erro ao carregar histórico do Auto Agente:', e);
        autoAgenteHistory = [];
    }

    // Keyboard shortcut: Ctrl + Space or Alt + A to toggle Auto Agente
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.code === 'Space') || (e.altKey && (e.key === 'a' || e.key === 'A'))) {
            e.preventDefault();
            toggleAutoAgente();
        } else if (e.key === 'Escape' && isAutoAgenteOpen) {
            closeAutoAgente();
        }
    });

    renderAutoAgenteMessages();
}

// Build concise real-time CRM context for the LLM
export function buildCrmContext() {
    const todayStr = new Date().toISOString().split('T')[0];

    const estoqueAtivo = (state.estoque || []).filter(c => c.status !== 'vendido');
    const estoqueResumo = estoqueAtivo.map(c => {
        const daysInStock = c.purchaseDate ? Math.max(0, Math.floor((new Date() - new Date(c.purchaseDate)) / (1000 * 60 * 60 * 24))) : 0;
        return {
            id: c.id,
            modelo: c.model,
            ano: c.year,
            placa: c.plate || 'N/A',
            km: c.km || 0,
            precoCompra: c.buyPrice || 0,
            precoVenda: c.sellPrice || 0,
            status: c.status,
            diasPatio: daysInStock
        };
    });

    const leadsAtivos = (state.leads || []).map(l => ({
        id: l.id,
        nome: l.name,
        telefone: l.phone,
        status: l.status,
        origem: l.origin,
        carroInteresseId: l.interestCarId,
        proximaAcao: l.nextAction || ''
    }));

    const compromissos = (state.agenda || []).map(a => ({
        id: a.id,
        titulo: a.title,
        data: a.date,
        hora: a.time,
        categoria: a.category,
        veiculoId: a.carId,
        descricao: a.desc || a.description || ''
    }));

    const vendasResumo = (state.vendas || []).slice(0, 15).map(v => ({
        id: v.id,
        cliente: v.client,
        carroId: v.carId,
        valorVenda: v.sellPrice,
        lucro: v.profit,
        data: v.date
    }));

    const cnpjs = (state.companyCnpjs || []).map(c => ({
        id: c.id,
        razaoSocial: c.name,
        cnpj: c.cnpj,
        inscricaoEstadual: c.ie || '',
        padrao: !!c.isDefault
    }));

    return {
        dataHoje: todayStr,
        totalCarrosPatio: estoqueAtivo.length,
        totalLeads: (state.leads || []).length,
        totalVendas: (state.vendas || []).length,
        totalCnpjsCadastrados: cnpjs.length,
        cnpjsCadastrados: cnpjs,
        estoque: estoqueResumo,
        leads: leadsAtivos,
        agenda: compromissos,
        vendasRecentes: vendasResumo
    };
}

// Toggle drawer / modal
export function toggleAutoAgente() {
    if (isAutoAgenteOpen) {
        closeAutoAgente();
    } else {
        openAutoAgente();
    }
}

export function openAutoAgente(prefillPrompt = '') {
    isAutoAgenteOpen = true;
    const drawer = document.getElementById('auto-agente-drawer');
    const fab = document.getElementById('auto-agente-fab');

    if (drawer) {
        drawer.classList.add('active');
    }
    if (fab) {
        fab.classList.add('active');
    }

    const input = document.getElementById('auto-agente-input');
    if (input) {
        if (prefillPrompt) {
            input.value = prefillPrompt;
        }
        setTimeout(() => input.focus(), 150);
    }

    // Scroll chat to bottom
    scrollChatToBottom();
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

export function closeAutoAgente() {
    isAutoAgenteOpen = false;
    const drawer = document.getElementById('auto-agente-drawer');
    const fab = document.getElementById('auto-agente-fab');

    if (drawer) {
        drawer.classList.remove('active');
    }
    if (fab) {
        fab.classList.remove('active');
    }
}

export function clearAutoAgenteHistory() {
    autoAgenteHistory = [];
    localStorage.removeItem('autodrive_autoagente_history');
    renderAutoAgenteMessages();
}

// Render conversation history
export function renderAutoAgenteMessages() {
    const container = document.getElementById('auto-agente-chat-body');
    if (!container) return;

    if (autoAgenteHistory.length === 0) {
        container.innerHTML = `
            <div class="auto-agente-welcome">
                <div class="auto-agente-welcome-icon">
                    <i data-lucide="sparkles"></i>
                </div>
                <h3>Olá! Eu sou o Auto Agente</h3>
                <p>Seu co-piloto de inteligência artificial com <strong>Google Gemini AI</strong>. Posso analisar dados da loja e executar ações em tempo real a partir de comandos em linguagem natural.</p>
                
                <div class="auto-agente-suggestions-title">Sugestões de comandos rápidos:</div>
                <div class="auto-agente-chips-grid">
                    <button class="auto-agente-chip" onclick="window.sendQuickPrompt('Quantos carros estão parados há mais de 45 dias no pátio?')">
                        <i data-lucide="clock"></i> Carros parados > 45 dias
                    </button>
                    <button class="auto-agente-chip" onclick="window.sendQuickPrompt('Cadastra o lead Marcos Silva, tel (11) 98888-5555, interessado no Corolla')">
                        <i data-lucide="user-plus"></i> Cadastrar novo Lead
                    </button>
                    <button class="auto-agente-chip" onclick="window.sendQuickPrompt('Agendar um test-drive amanhã às 15:00 para o lead Rodrigo')">
                        <i data-lucide="calendar-plus"></i> Agendar Test-Drive
                    </button>
                    <button class="auto-agente-chip" onclick="window.sendQuickPrompt('Lançar despesa de R$ 380 de higienização no Compass')">
                        <i data-lucide="receipt"></i> Lançar Custo de Preparação
                    </button>
                    <button class="auto-agente-chip" onclick="window.sendQuickPrompt('Qual é o valor total investido no estoque e lucro das vendas?')">
                        <i data-lucide="pie-chart"></i> Relatório de Vendas e Estoque
                    </button>
                    <button class="auto-agente-chip" onclick="window.sendQuickPrompt('Criar mensagem de WhatsApp para apresentar o Corolla ao cliente')">
                        <i data-lucide="message-square"></i> Criar Texto de WhatsApp
                    </button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        return;
    }

    let html = '';
    autoAgenteHistory.forEach((msg, idx) => {
        const isUser = msg.role === 'user';
        html += `
            <div class="auto-agente-msg ${isUser ? 'user' : 'model'}">
                <div class="auto-agente-msg-avatar">
                    <i data-lucide="${isUser ? 'user' : 'sparkles'}"></i>
                </div>
                <div class="auto-agente-msg-content">
                    <div class="auto-agente-msg-bubble">
                        ${formatMessageText(msg.text)}
                    </div>
                    ${msg.actionCards ? renderActionCards(msg.actionCards) : ''}
                    <div class="auto-agente-msg-time">${msg.time || ''}</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    scrollChatToBottom();
}

function formatMessageText(text = '') {
    if (!text) return '';
    // Basic markdown parsing: bold, lists, code blocks, line breaks
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');
    return formatted;
}

function renderActionCards(cards) {
    if (!cards || !cards.length) return '';
    return `
        <div class="auto-agente-actions-container">
            ${cards.map(c => `
                <div class="auto-agente-action-card ${c.type || 'success'}">
                    <div class="action-card-icon">
                        <i data-lucide="${c.icon || 'check-circle-2'}"></i>
                    </div>
                    <div class="action-card-info">
                        <strong>${c.title}</strong>
                        <span>${c.subtitle || ''}</span>
                    </div>
                    ${c.buttonText ? `
                        <button class="btn btn-sm btn-secondary" onclick="${c.buttonAction}">
                            ${c.buttonText}
                        </button>
                    ` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function scrollChatToBottom() {
    const container = document.getElementById('auto-agente-chat-body');
    if (container) {
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}

// Quick prompt sender
export function sendQuickPrompt(promptText) {
    const input = document.getElementById('auto-agente-input');
    if (input) {
        input.value = promptText;
        sendAutoAgenteMessage();
    }
}

// Send user message to LLM server endpoint
export async function sendAutoAgenteMessage() {
    const input = document.getElementById('auto-agente-input');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Push user message
    autoAgenteHistory.push({
        role: 'user',
        text: message,
        time: nowTime
    });

    renderAutoAgenteMessages();

    // Show typing / processing indicator
    const chatBody = document.getElementById('auto-agente-chat-body');
    const typingId = `typing-indicator-${Date.now()}`;
    if (chatBody) {
        const typingEl = document.createElement('div');
        typingEl.id = typingId;
        typingEl.className = 'auto-agente-msg model typing';
        typingEl.innerHTML = `
            <div class="auto-agente-msg-avatar">
                <i data-lucide="sparkles"></i>
            </div>
            <div class="auto-agente-msg-content">
                <div class="auto-agente-typing-dots">
                    <span></span><span></span><span></span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">Processando com Gemini AI...</div>
            </div>
        `;
        chatBody.appendChild(typingEl);
        scrollChatToBottom();
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    try {
        const crmContext = buildCrmContext();
        const response = await fetch('/api/auto-agente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                conversationHistory: autoAgenteHistory.slice(-10),
                crmContext: crmContext
            })
        });

        const data = await response.json();

        // Remove typing indicator
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        if (data.error) {
            autoAgenteHistory.push({
                role: 'model',
                text: `⚠️ **Atenção:** ${data.error}`,
                time: nowTime
            });
            saveHistory();
            renderAutoAgenteMessages();
            return;
        }

        const executedActionCards = [];

        // Execute function calls if returned by Gemini
        if (data.functionCalls && data.functionCalls.length > 0) {
            for (const fc of data.functionCalls) {
                const actionCard = await executeToolAction(fc.name, fc.args);
                if (actionCard) {
                    executedActionCards.push(actionCard);
                }
            }
        }

        autoAgenteHistory.push({
            role: 'model',
            text: data.text || (executedActionCards.length > 0 ? 'Ação executada com sucesso!' : 'Comando processado.'),
            actionCards: executedActionCards.length > 0 ? executedActionCards : null,
            time: nowTime
        });

        saveHistory();
        renderAutoAgenteMessages();

    } catch (err) {
        console.error('Erro na requisição do Auto Agente:', err);
        const typingEl = document.getElementById(typingId);
        if (typingEl) typingEl.remove();

        autoAgenteHistory.push({
            role: 'model',
            text: `❌ Desculpe, ocorreu uma instabilidade ao se comunicar com o servidor: ${err.message}`,
            time: nowTime
        });
        saveHistory();
        renderAutoAgenteMessages();
    }
}

function saveHistory() {
    try {
        localStorage.setItem('autodrive_autoagente_history', JSON.stringify(autoAgenteHistory.slice(-30)));
    } catch (e) {
        console.error(e);
    }
}

// --------------------------------------------------------------------------
// TOOL / FUNCTION CALLING EXECUTORS
// --------------------------------------------------------------------------

async function executeToolAction(name, args) {
    console.log(`[Auto Agente] Executando Tool: ${name}`, args);

    if (name === 'create_lead') {
        let matchedCarId = null;
        if (args.interestCar) {
            const foundCar = state.estoque.find(c => 
                c.model.toLowerCase().includes(args.interestCar.toLowerCase()) ||
                (c.plate && c.plate.toLowerCase().includes(args.interestCar.toLowerCase()))
            );
            if (foundCar) matchedCarId = foundCar.id;
        }

        const leadData = {
            name: args.name,
            phone: args.phone || '',
            interest_car_id: matchedCarId,
            origin: args.channel || 'Auto Agente AI',
            status: 'novo lead',
            next_action: args.notes || 'Criado via Auto Agente',
            last_contact_days: 0
        };

        let newLeadId = null;

        if (state.isCloudActive && state.supabaseClient) {
            try {
                const { data, error } = await state.supabaseClient.from('leads').insert([leadData]).select();
                if (!error && data && data[0]) {
                    newLeadId = data[0].id;
                    await state.supabaseClient.from('interactions').insert([{
                        lead_id: newLeadId,
                        date: 'Hoje',
                        text: `Lead cadastrado pelo Auto Agente AI. ${args.notes ? `Nota: ${args.notes}` : ''}`
                    }]);
                }
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            }
        } else {
            newLeadId = state.leads.length > 0 ? Math.max(...state.leads.map(l => l.id)) + 1 : 1;
            state.leads.push({
                id: newLeadId,
                name: args.name,
                phone: args.phone || '',
                interestCarId: matchedCarId,
                origin: args.channel || 'Auto Agente AI',
                status: 'novo lead',
                lastContactDays: 0,
                nextAction: args.notes || 'Criado via Auto Agente',
                interactions: [{
                    date: 'Hoje',
                    text: `Lead cadastrado pelo Auto Agente AI. ${args.notes ? `Nota: ${args.notes}` : ''}`
                }]
            });
            persistLocalData();
        }

        window.updateApplicationState();

        return {
            title: `Lead Cadastrado: ${args.name}`,
            subtitle: `${args.phone ? `WhatsApp: ${args.phone} • ` : ''}${args.interestCar ? `Interesse: ${args.interestCar}` : 'Pátio Geral'}`,
            icon: 'user-check',
            type: 'success',
            buttonText: 'Ver no Funil',
            buttonAction: `window.switchTab('leads'); ${newLeadId ? `window.openLeadTimeline(${newLeadId});` : ''} window.closeAutoAgente();`
        };
    }

    if (name === 'create_appointment') {
        let matchedCarId = null;
        if (args.carModel) {
            const foundCar = state.estoque.find(c => 
                c.model.toLowerCase().includes(args.carModel.toLowerCase()) ||
                (c.plate && c.plate.toLowerCase().includes(args.carModel.toLowerCase()))
            );
            if (foundCar) matchedCarId = foundCar.id;
        }

        const formattedDate = args.date || new Date().toISOString().split('T')[0];
        const formattedTime = args.time || '10:00';

        const appointmentData = {
            title: args.title || 'Compromisso com Cliente',
            date: formattedDate,
            time: formattedTime,
            car_id: matchedCarId,
            category: args.type || 'Test-Drive',
            description: `${args.clientName ? `Cliente: ${args.clientName} ` : ''}${args.clientPhone ? `(${args.clientPhone}) ` : ''}${args.notes || ''}`.trim()
        };

        if (state.isCloudActive && state.supabaseClient) {
            try {
                await state.supabaseClient.from('agenda').insert([appointmentData]);
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            }
        } else {
            const newId = state.agenda.length > 0 ? Math.max(...state.agenda.map(a => a.id)) + 1 : 1;
            state.agenda.push({
                id: newId,
                title: appointmentData.title,
                date: formattedDate,
                time: formattedTime,
                carId: matchedCarId,
                category: appointmentData.category,
                desc: appointmentData.description
            });
            persistLocalData();
        }

        window.updateApplicationState();

        return {
            title: `Compromisso Agendado: ${args.title}`,
            subtitle: `Data: ${formattedDate.split('-').reverse().join('/')} às ${formattedTime} • ${args.clientName || 'Cliente'}`,
            icon: 'calendar-check-2',
            type: 'success',
            buttonText: 'Abrir Agenda',
            buttonAction: `window.switchTab('agenda'); window.closeAutoAgente();`
        };
    }

    if (name === 'add_expense') {
        let matchedCarId = null;
        if (args.carModel && args.carModel.toLowerCase() !== 'geral') {
            const foundCar = state.estoque.find(c => 
                c.model.toLowerCase().includes(args.carModel.toLowerCase()) ||
                (c.plate && c.plate.toLowerCase().includes(args.carModel.toLowerCase()))
            );
            if (foundCar) matchedCarId = foundCar.id;
        }

        const date = args.date || new Date().toISOString().split('T')[0];
        const val = parseFloat(args.amount) || 0;
        const desc = args.description || 'Despesa Lançada pelo Auto Agente';
        const category = args.category || 'Operacional';

        const newId = state.despesas.length > 0 ? Math.max(...state.despesas.map(d => Number(d.id) || 0)) + 1 : 1;
        state.despesas.push({ id: newId, desc, carId: matchedCarId, date, val, category });
        persistLocalData();

        if (state.isCloudActive && state.supabaseClient) {
            try {
                await state.supabaseClient.from('despesas').insert([{
                    description: desc,
                    car_id: matchedCarId,
                    date,
                    val,
                    category
                }]);
                await fetchCloudData();
            } catch (e) {
                console.error(e);
            }
        }

        window.updateApplicationState();

        return {
            title: `Despesa Lançada: ${formatCurrency(val)}`,
            subtitle: `${desc} ${matchedCarId ? `• Veículo #${matchedCarId}` : '• Geral'} (${category})`,
            icon: 'receipt',
            type: 'success',
            buttonText: 'Ver Financeiro',
            buttonAction: `window.switchTab('financeiro'); window.closeAutoAgente();`
        };
    }

    if (name === 'update_car_status') {
        const foundCar = state.estoque.find(c => 
            c.model.toLowerCase().includes(args.carModel.toLowerCase()) ||
            (c.plate && c.plate.toLowerCase().includes(args.carModel.toLowerCase())) ||
            String(c.id) === String(args.carModel)
        );

        if (foundCar) {
            foundCar.status = args.status;
            if (state.isCloudActive && state.supabaseClient) {
                try {
                    await state.supabaseClient.from('estoque').update({ status: args.status }).eq('id', foundCar.id);
                    await fetchCloudData();
                } catch (e) {
                    console.error(e);
                }
            } else {
                persistLocalData();
            }

            window.updateApplicationState();

            return {
                title: `Status Atualizado: ${foundCar.model}`,
                subtitle: `Novo status: ${args.status.toUpperCase()} ${args.notes ? `• ${args.notes}` : ''}`,
                icon: 'car',
                type: 'success',
                buttonText: 'Ver Estoque',
                buttonAction: `window.switchTab('estoque'); window.closeAutoAgente();`
            };
        }
    }

    if (name === 'add_lead_interaction') {
        const lead = state.leads.find(l => 
            l.name.toLowerCase().includes(args.leadName.toLowerCase()) ||
            String(l.id) === String(args.leadName)
        );

        if (lead) {
            if (!lead.interactions) lead.interactions = [];
            lead.interactions.unshift({
                date: 'Hoje',
                text: args.note
            });

            if (state.isCloudActive && state.supabaseClient) {
                try {
                    await state.supabaseClient.from('interactions').insert([{
                        lead_id: lead.id,
                        date: 'Hoje',
                        text: args.note
                    }]);
                    await fetchCloudData();
                } catch (e) {
                    console.error(e);
                }
            } else {
                persistLocalData();
            }

            window.updateApplicationState();

            return {
                title: `Anotação no Lead: ${lead.name}`,
                subtitle: `"${args.note}"`,
                icon: 'message-square',
                type: 'success',
                buttonText: 'Abrir Lead',
                buttonAction: `window.switchTab('leads'); window.openLeadTimeline(${lead.id}); window.closeAutoAgente();`
            };
        }
    }

    if (name === 'navigate_to') {
        if (window.switchTab && args.tab) {
            window.switchTab(args.tab);
        }
        if (args.detailId && window.openCarDetails) {
            window.openCarDetails(args.detailId);
        }
        return {
            title: `Navegando para: ${args.tab.toUpperCase()}`,
            subtitle: `Tela aberta no painel principal`,
            icon: 'arrow-up-right',
            type: 'info',
            buttonText: 'Fechar Agente',
            buttonAction: `window.closeAutoAgente();`
        };
    }

    return null;
}

// --------------------------------------------------------------------------
// SPEECH TO TEXT (VOICE INPUT)
// --------------------------------------------------------------------------

export function toggleVoiceInput() {
    const micBtn = document.getElementById('auto-agente-mic-btn');
    const input = document.getElementById('auto-agente-input');

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Seu navegador não suporta reconhecimento de voz. Por favor, utilize o Google Chrome ou Microsoft Edge.');
        return;
    }

    if (isVoiceListening) {
        if (speechRecognitionInstance) {
            speechRecognitionInstance.stop();
        }
        isVoiceListening = false;
        if (micBtn) micBtn.classList.remove('listening');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecognitionInstance = new SpeechRecognition();
    speechRecognitionInstance.lang = 'pt-BR';
    speechRecognitionInstance.continuous = false;
    speechRecognitionInstance.interimResults = true;

    speechRecognitionInstance.onstart = () => {
        isVoiceListening = true;
        if (micBtn) micBtn.classList.add('listening');
    };

    speechRecognitionInstance.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        if (input) {
            input.value = transcript;
        }
    };

    speechRecognitionInstance.onerror = (event) => {
        console.error('Speech recognition error', event);
        isVoiceListening = false;
        if (micBtn) micBtn.classList.remove('listening');
    };

    speechRecognitionInstance.onend = () => {
        isVoiceListening = false;
        if (micBtn) micBtn.classList.remove('listening');
        if (input && input.value.trim().length > 2) {
            sendAutoAgenteMessage();
        }
    };

    speechRecognitionInstance.start();
}

// Bind to window for HTML handlers
window.toggleAutoAgente = toggleAutoAgente;
window.openAutoAgente = openAutoAgente;
window.closeAutoAgente = closeAutoAgente;
window.sendAutoAgenteMessage = sendAutoAgenteMessage;
window.sendQuickPrompt = sendQuickPrompt;
window.clearAutoAgenteHistory = clearAutoAgenteHistory;
window.toggleVoiceInput = toggleVoiceInput;
