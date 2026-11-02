import { matchesStockColumns, stockColumnOptions } from '../../utils/stock-filters.js';

const filters = new Map();
const titles = { model: 'Veículo', document_status: 'Pendência', days: 'Tempo no pátio', type: 'Tipo', status: 'Status' };
let cars = [], cell, change, sort, installed = false, menu;
export function applyInventoryColumnFilters(base) { return cell ? base.filter(car => matchesStockColumns(car, filters, cell)) : base; }
export function filterInventoryColumns(base, valueOf, onChange, onSort) {
    cars = base; cell = valueOf; change = onChange; sort = onSort;
    if (!installed) {
        installed = true;
        document.querySelectorAll('[data-stock-filter]').forEach(button => button.addEventListener('click', event => {
            event.stopPropagation(); open(button.dataset.stockFilter, button);
        }));
        document.getElementById('clear-stock-column-filters').onclick = () => { filters.clear(); close(); change(); };
        document.addEventListener('pointerdown', event => { if (menu && !menu.contains(event.target) && !event.target.closest('[data-stock-filter]')) close(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu) { const column = menu.dataset.column; close(); document.querySelector(`[data-stock-filter="${column}"]`)?.focus(); } });
        window.addEventListener('resize', close);
        document.addEventListener('scroll', event => { if (menu && !menu.contains(event.target)) close(); }, true);
    }
    document.querySelectorAll('[data-stock-filter]').forEach(button => {
        const active = filters.has(button.dataset.stockFilter);
        button.classList.toggle('is-filtered', active);
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-expanded', String(menu?.dataset.column === button.dataset.stockFilter));
        button.setAttribute('aria-label', `Filtrar ${titles[button.dataset.stockFilter]}${active ? ' (filtro ativo)' : ''}`);
    });
    const clear = document.getElementById('clear-stock-column-filters');
    clear.hidden = filters.size === 0;
    clear.textContent = `Limpar filtros de coluna (${filters.size})`;
    return cars.filter(car => matchesStockColumns(car, filters, cell));
}
function close() { if (menu) document.querySelector(`[data-stock-filter="${menu.dataset.column}"]`)?.setAttribute('aria-expanded', 'false'); menu?.remove(); menu = null; }
function button(text, action) { const node = document.createElement('button'); node.type = 'button'; node.textContent = text; node.onclick = action; return node; }
function open(column, anchor) {
    if (menu?.dataset.column === column) { close(); return; }
    close();
    const options = stockColumnOptions(cars, column, filters, cell);
    let selected = new Set(filters.get(column) || options.map(item => item.value));
    menu = document.createElement('div'); menu.className = 'stock-filter-menu'; menu.dataset.column = column;
    menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', `Filtrar ${titles[column]}`);
    const heading = document.createElement('strong'); heading.textContent = titles[column];
    const ordering = document.createElement('div'); ordering.className = 'stock-filter-actions';
    ordering.append(button('Crescente ↑', () => { close(); sort(column, 'asc'); }), button('Decrescente ↓', () => { close(); sort(column, 'desc'); }));
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'Buscar nesta coluna…'; search.setAttribute('aria-label', 'Buscar valores da coluna');
    const selection = document.createElement('div'); selection.className = 'stock-filter-actions';
    const list = document.createElement('div'); list.className = 'stock-filter-values';
    const visible = () => options.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(search.value.toLocaleLowerCase('pt-BR')));
    const draw = () => {
        list.replaceChildren();
        for (const item of visible()) {
            const label = document.createElement('label'), check = document.createElement('input'), text = document.createElement('span');
            check.type = 'checkbox'; check.value = item.value; check.checked = selected.has(item.value);
            check.onchange = () => { if (check.checked) selected.add(item.value); else selected.delete(item.value); };
            text.textContent = item.label; label.append(check, text); list.append(label);
        }
        if (!list.childElementCount) list.textContent = 'Nenhum valor encontrado.';
    };
    selection.append(button('Selecionar resultados', () => { visible().forEach(item => selected.add(item.value)); draw(); }), button('Desmarcar resultados', () => { visible().forEach(item => selected.delete(item.value)); draw(); }));
    search.oninput = draw;
    const footer = document.createElement('div'); footer.className = 'stock-filter-actions';
    footer.append(button('Limpar coluna', () => { filters.delete(column); close(); change(); }), button('Cancelar', close), button('Aplicar', () => {
        if (options.length && options.every(item => selected.has(item.value))) filters.delete(column);
        else filters.set(column, selected);
        close(); change();
    }));
    menu.append(heading, ordering, search, selection, list, footer); document.body.append(menu); draw();
    anchor.setAttribute('aria-expanded', 'true');
    const rect = anchor.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - menu.offsetHeight - 8)) + 'px';
    search.focus();
}
