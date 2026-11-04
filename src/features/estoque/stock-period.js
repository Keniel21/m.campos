import { stockPeriodPreset, validStockDate } from '../../utils/stock.js';
const bindings = new WeakMap();
export function readStockPeriod(doc = document) {
    return { mode: doc.getElementById('stock-period-mode')?.value || 'none', start: doc.getElementById('stock-period-start')?.value || '', end: doc.getElementById('stock-period-end')?.value || '' };
}
export function bindStockPeriod(onChange, today, doc = document) {
    const mode = doc.getElementById('stock-period-mode');
    if (!mode || bindings.has(mode)) return;
    const start = doc.getElementById('stock-period-start'), end = doc.getElementById('stock-period-end');
    const status = doc.getElementById('filter-estoque-status');
    const range = doc.getElementById('stock-period-range');
    const clear = doc.getElementById('stock-period-clear');
    let previousStatus = status.value, previousMode = mode.value;
    bindings.set(mode, true);
    const referenceDate = () => {
        const provided = today();
        if (validStockDate(provided)) return provided;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    };
    const preset = name => {
        const dates = stockPeriodPreset(name, referenceDate());
        start.value = dates.start; end.value = dates.end;
    };
    const sync = () => {
        const active = mode.value !== 'none';
        range.hidden = clear.hidden = !active;
        if (mode.value === 'sale') {
            if (previousMode !== 'sale') previousStatus = status.value;
            status.value = 'vendido'; status.disabled = true;
        } else {
            if (previousMode === 'sale') status.value = previousStatus;
            status.disabled = false;
        }
        status.title = mode.value === 'sale' ? 'A data da venda considera somente veículos vendidos.' : '';
        previousMode = mode.value;
    };
    mode.onchange = () => {
        if (mode.value !== 'none' && (!start.value || !end.value)) preset('month');
        sync(); onChange();
    };
    start.onchange = end.onchange = onChange;
    doc.querySelectorAll('[data-stock-period-preset]').forEach(button => {
        button.onclick = () => { preset(button.dataset.stockPeriodPreset); onChange(); };
    });
    clear.onclick = () => { mode.value = 'none'; start.value = end.value = ''; sync(); onChange(); };
    sync();
}
export function showStockPeriodResult(result, doc = document) {
    const note = doc.getElementById('stock-period-note');
    if (!note) return;
    const mode = readStockPeriod(doc).mode;
    note.classList.toggle('is-error', Boolean(result.error));
    if (mode === 'none') { note.textContent = ''; note.hidden = true; return; }
    note.hidden = false;
    note.textContent = result.error || (mode === 'sale'
        ? 'Somente vendidos, pela data registrada na venda. Datas inicial e final incluídas.'
        : 'Pela data de compra / entrada, conforme a situação selecionada. Datas inicial e final incluídas.');
    if (result.missing) note.textContent += ` ${result.missing} veículo(s) da busca atual sem data válida${mode === 'sale' ? ' de venda ou com vínculo de venda inconsistente' : ' de entrada'} ficaram fora do período.`;
}
