export function matchesStockColumns(car, filters, cell, except) {
    return [...filters].every(([column, selected]) => column === except || selected.has(cell(car, column).value));
}
export function stockColumnOptions(cars, column, filters, cell) {
    const available = cars.filter(car => matchesStockColumns(car, filters, cell, column));
    const values = new Map(available.map(car => { const item = cell(car, column); return [item.value, item]; }));
    // Keep selected values visible even when another filter temporarily excludes them.
    for (const car of cars) {
        const item = cell(car, column);
        if (filters.get(column)?.has(item.value)) values.set(item.value, item);
    }
    return [...values.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { numeric: true }));
}
