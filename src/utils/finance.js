const cents = value => {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? Math.round(number * 100) : 0;
};
const vehicleId = record => String(record.carId ?? record.car_id ?? '');
function dated(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

// Cash movements use their own dates; vehicle profit uses all its recorded costs.
export function summarizeFinance(cars, sales, expenses, start, end) {
    const inPeriod = value => { const date = dated(value); return date !== null && date >= start && date <= end; };
    const purchaseDate = car => car.purchaseDate || car.purchase_date;
    const purchases = cars.filter(car => inPeriod(purchaseDate(car)));
    const periodSales = sales.filter(sale => inPeriod(sale.date));
    const periodExpenses = expenses.filter(expense => inPeriod(expense.date));
    const carsById = new Map(cars.map(car => [String(car.id), car]));
    const costsByVehicle = new Map();
    for (const expense of expenses) {
        const id = vehicleId(expense);
        if (id) costsByVehicle.set(id, (costsByVehicle.get(id) || 0) + cents(expense.val));
    }
    const revenue = periodSales.reduce((sum, sale) => sum + cents(sale.sellPrice ?? sale.sell_price), 0);
    const acquisitions = purchases.reduce((sum, car) => sum + cents(car.buyPrice ?? car.buy_price), 0);
    const operatingExpenses = periodExpenses.reduce((sum, expense) => sum + cents(expense.val), 0);
    let salesProfit = 0, salesWithoutVehicle = 0;
    for (const sale of periodSales) {
        const id = vehicleId(sale), car = carsById.get(id);
        if (!car) { salesWithoutVehicle++; continue; }
        salesProfit += cents(sale.sellPrice ?? sale.sell_price) - cents(car.buyPrice ?? car.buy_price) - (costsByVehicle.get(id) || 0);
    }
    return {
        revenue: revenue / 100, acquisitions: acquisitions / 100,
        operatingExpenses: operatingExpenses / 100,
        cashBalance: (revenue - acquisitions - operatingExpenses) / 100,
        salesProfit: salesProfit / 100, periodExpenses,
        purchasesWithoutDate: cars.filter(car => cents(car.buyPrice ?? car.buy_price) !== 0 && !dated(purchaseDate(car))).length,
        salesWithoutVehicle
    };
}
