import { state } from '../../services/state.js';
import { fetchCloudData } from '../../services/supabase.js';
import { pendingLabel } from '../../utils/pendencias.js';

let refreshStock;
let busy = false;
let editor = null;
let removal = null;
let installed = false;
let fieldRevision = 0;
let openRequest = 0;

export function renderPendingField(value, refresh) {
    fieldRevision++;
    refreshStock = refresh;
    syncSelectedOptions(value);
    const select = document.getElementById('cd-document');
    if (!installed) {
        installed = true;
        const field = document.getElementById('pending-field');
        // Editing a catalog name must never auto-save the vehicle form.
        field.addEventListener('input', event => event.stopPropagation());
        field.addEventListener('change', event => { if (event.target !== select) event.stopPropagation(); });
        document.getElementById('pending-toggle').onclick = () => {
            if (document.getElementById('pending-menu').hidden) openMenu();
            else setOpen(false);
        };
        document.addEventListener('pointerdown', event => { if (!field.contains(event.target)) setOpen(false); });
        field.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.stopPropagation(); editor = removal = null; setOpen(false); document.getElementById('pending-toggle').focus(); }
            if (event.target.id === 'pending-toggle' && event.key === 'ArrowDown') { event.preventDefault(); openMenu(); }
        });
        select.onchange = () => { document.getElementById('pending-toggle-label').textContent = pendingLabel(select.value === 'unreported' ? null : select.value, state.pendencias); };
    }
    editor = removal = null;
    setOpen(false);
}
function syncSelectedOptions(value) {
    const select = document.getElementById('cd-document');
    select.replaceChildren(new Option('Sem pendência', 'none'), new Option('Não informado', 'unreported'));
    for (const option of state.pendencias || []) select.add(new Option(option.name, option.code));
    const known = !value || value === 'none' || value === 'unreported' || (state.pendencias || []).some(option => option.code === value);
    select.dataset.unresolvedValue = known ? '' : value;
    select.value = known ? (value || 'unreported') : 'unreported';
    document.getElementById('pending-toggle-label').textContent = pendingLabel(value, state.pendencias);
}
async function openMenu() {
    editor = removal = null; draw(); setOpen(true);
    document.querySelector('#pending-menu button')?.focus();
    const request = ++openRequest, revision = fieldRevision;
    try {
        const response = await fetch('/api/crm/pendencias');
        const options = await response.json();
        if (request !== openRequest || revision !== fieldRevision || busy || editor || removal) return;
        state.pendencias = options;
        const select = document.getElementById('cd-document');
        syncSelectedOptions(select.dataset.unresolvedValue || select.value);
        refreshStock(); draw();
    } catch (error) {
        if (request === openRequest && revision === fieldRevision)
            document.getElementById('pending-menu-message').textContent = 'Não foi possível atualizar o catálogo. ' + error.message;
    }
}
function setOpen(open) {
    if (!open) openRequest++;
    document.getElementById('pending-menu').hidden = !open;
    document.getElementById('pending-toggle').setAttribute('aria-expanded', String(open));
}
function button(label, action, className = '') {
    const node = document.createElement('button');
    node.type = 'button'; node.textContent = label; node.className = className; node.disabled = busy; node.onclick = action;
    return node;
}
function choose(code) {
    const select = document.getElementById('cd-document');
    select.dataset.unresolvedValue = '';
    select.value = code;
    document.getElementById('pending-toggle-label').textContent = pendingLabel(code === 'unreported' ? null : code, state.pendencias);
    setOpen(false);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('pending-toggle').focus();
}
function draw() {
    const menu = document.getElementById('pending-menu');
    menu.replaceChildren();
    menu.append(button('Sem pendência', () => choose('none'), 'pending-choice'));
    menu.append(button('Não informado', () => choose('unreported'), 'pending-choice'));
    for (const option of state.pendencias || []) {
        const row = document.createElement('div'); row.className = 'pending-option-row'; row.dataset.code = option.code;
        if (editor?.id === option.id) row.append(editInput(option));
        else if (removal === option.id) {
            const text = document.createElement('span'); text.textContent = 'Excluir esta opção?'; row.append(text);
            row.append(button('Excluir', () => save('delete', option), 'pending-delete-confirm'), button('Cancelar', () => { removal = null; draw(); }));
        } else {
            row.append(button(option.name, () => choose(option.code), 'pending-choice'));
            const edit = button('Editar', () => startEdit(option), 'pending-edit'); edit.setAttribute('aria-label', 'Renomear ' + option.name);
            const remove = button('Excluir', () => { editor = null; removal = option.id; draw(); }, 'pending-delete'); remove.setAttribute('aria-label', 'Excluir ' + option.name);
            row.append(edit, remove);
        }
        menu.append(row);
    }
    if (editor?.id === 'new') { const row = document.createElement('div'); row.className = 'pending-option-row'; row.append(editInput()); menu.append(row); }
    else menu.append(button('+ Adicionar item', () => startEdit(), 'pending-add'));
    const message = document.createElement('div'); message.id = 'pending-menu-message'; message.setAttribute('role', 'status'); menu.append(message);
}
function startEdit(option) {
    editor = { id: option?.id || 'new', name: option?.name || '' }; removal = null; draw();
    const input = document.querySelector('#pending-menu input'); input.focus(); input.select();
}
function editInput(option) {
    const group = document.createElement('div'); group.className = 'pending-inline-editor';
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 100; input.value = editor.name;
    input.setAttribute('aria-label', option ? 'Renomear pendência' : 'Nome da nova pendência'); input.disabled = busy;
    input.oninput = () => { editor.name = input.value; };
    input.onkeydown = event => {
        if (event.key === 'Enter') { event.preventDefault(); save(option ? 'edit' : 'create', option); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); editor = null; draw(); document.getElementById('pending-toggle').focus(); }
    };
    group.append(input, button('Salvar', () => save(option ? 'edit' : 'create', option)), button('Cancelar', () => { editor = null; draw(); }));
    return group;
}
async function save(action, option) {
    if (busy) return;
    const name = editor?.name.trim();
    if (action !== 'delete' && !name) { document.getElementById('pending-menu-message').textContent = 'Informe o nome da pendência.'; return; }
    busy = true;
    document.querySelectorAll('#pending-menu button, #pending-menu input').forEach(node => node.disabled = true);
    try {
        const response = await fetch('/api/crm/pendencias' + (option ? '/' + option.id : ''), {
            method: action === 'delete' ? 'DELETE' : option ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
            ...(action === 'delete' ? {} : { body: JSON.stringify({ name }) })
        });
        const saved = action === 'delete' ? null : await response.json();
        const previous = document.getElementById('cd-document').value;
        await fetchCloudData();
        renderPendingField(previous === 'unreported' ? null : previous, refreshStock);
        refreshStock(); busy = false;
        if (action === 'create') {
            choose((saved.item || saved).code);
        } else { draw(); setOpen(true); }
    } catch (error) {
        busy = false; draw(); setOpen(true);
        document.getElementById('pending-menu-message').textContent = error.message;
    }
}
