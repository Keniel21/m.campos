// Shared by list, grid and CSV. Dates are calendar dates, with inclusive boundaries.
export function validStockDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function stockPeriodResult(cars, period = {}, sales = []) {
    if (!period.mode || period.mode === 'none') return { cars, missing: 0, error: '' };
    const candidates = cars.filter(car => !car.trashedAt && (period.mode !== 'sale' || car.status === 'vendido'));
    if (!['sale', 'entry'].includes(period.mode) || !validStockDate(period.start) || !validStockDate(period.end))
        return { cars: [], missing: 0, error: 'Informe as datas inicial e final do período.' };
    if (period.start > period.end) return { cars: [], missing: 0, error: 'A data inicial deve ser anterior ou igual à data final.' };
    const dates = new Map();
    if (period.mode === 'sale') for (const sale of sales) {
        const id = sale.carId ?? sale.car_id;
        if (id == null) continue;
        const key = String(id);
        // Ambiguous links must not silently pick a sale depending on array order.
        dates.set(key, dates.has(key) ? null : sale.date);
    }
    let missing = 0;
    const filtered = candidates.filter(car => {
        const date = period.mode === 'sale' ? dates.get(String(car.id)) : (car.purchaseDate ?? car.purchase_date);
        if (!validStockDate(date)) { missing++; return false; }
        return date >= period.start && date <= period.end;
    });
    return { cars: filtered, missing, error: '' };
}
export function stockPeriodPreset(preset, today) {
    if (!validStockDate(today)) throw new Error('Data de referência inválida.');
    const [year, month] = today.split('-').map(Number);
    const iso = date => date.toISOString().slice(0, 10);
    if (preset === 'year') return { start: `${year}-01-01`, end: `${year}-12-31` };
    const offset = preset === 'last-month' ? -1 : 0;
    return { start: iso(new Date(Date.UTC(year, month - 1 + offset, 1))), end: iso(new Date(Date.UTC(year, month + offset, 0))) };
}
export function filterStock(cars, query = '', status = 'todos', period = {}, sales = []) {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    const effectiveStatus = period.mode === 'sale' ? 'vendido' : status;
    const base = cars.filter(car => !car.trashedAt && (effectiveStatus === 'todos' || car.status === effectiveStatus) &&
        (!search || ['model', 'year', 'plate', 'color', 'chassis'].some(key =>
            String(car[key] ?? '').toLocaleLowerCase('pt-BR').includes(search))));
    return stockPeriodResult(base, period, sales).cars;
}
