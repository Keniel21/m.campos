// Shared by the inventory views and CSV export so both show the same vehicles.
export function filterStock(cars, query = '', status = 'todos') {
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return cars.filter(car => (status === 'todos' || car.status === status) &&
        (!search || ['model', 'year', 'plate', 'color', 'chassis'].some(key =>
            String(car[key] ?? '').toLocaleLowerCase('pt-BR').includes(search))));
}
