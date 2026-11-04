const fs = require('node:fs');
const path = require('node:path');
const modules = ['estoque', 'clientes', 'leads', 'despesas', 'agenda', 'documentos', 'company_cnpjs', 'vendas'];
function audit(directory) {
  const data = {}, counts = {}, errors = [], warnings = [];
  for (const module of modules) {
    const file = path.join(directory, `${module}.json`);
    if (!fs.existsSync(file)) {
      data[module] = [];
      warnings.push(`${module}: arquivo ausente; nada sera importado.`);
      continue;
    }
    try {
      const rows = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
      if (!Array.isArray(rows)) throw new Error();
      const seen = new Set();
      for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row) || row.id == null || !String(row.id).trim()) {
          errors.push(`${module}: registro sem id ou formato invalido.`); continue;
        }
        const id = String(row.id);
        if (seen.has(id)) errors.push(`${module}: id duplicado dentro do arquivo.`);
        seen.add(id);
      }
      data[module] = rows; counts[module] = rows.length;
    } catch { errors.push(`${module}: JSON invalido; esperado um array.`); data[module] = []; }
  }
  if (!counts.estoque) errors.push('estoque: arquivo vazio ou ausente; importacao bloqueada.');
  const vehicles = new Set(data.estoque.filter(Boolean).map(r => String(r.id)));
  for (const module of ['vendas','despesas','documentos','leads','agenda']) {
    let orphans = 0;
    for (const row of data[module].filter(Boolean)) {
      const id = module === 'leads' ? row.interestCarId : row.carId ?? row.car_id;
      if (id != null && String(id).trim() && !vehicles.has(String(id))) orphans++;
      else if (module === 'vendas' && (id == null || !String(id).trim())) orphans++;
    }
    if (orphans) {
      const message = `${module}: ${orphans} vinculos de veiculo ausentes ou inexistentes.`;
      (['leads', 'agenda'].includes(module) ? warnings : errors).push(message);
    }
  }
  const sales = new Map();
  for (const row of data.vendas.filter(Boolean)) {
    const id = String(row.carId ?? row.car_id);
    sales.set(id, (sales.get(id) || 0) + 1);
  }
  const duplicates = [...sales.values()].filter(n => n > 1).length;
  if (duplicates) warnings.push(`vendas: ${duplicates} veiculos com mais de uma venda historica; preservar e revisar, sem apagar automaticamente.`);
  const missingDescriptions = data.despesas.filter(r => r && !r.desc && !r.description).length;
  if (missingDescriptions) warnings.push(`despesas: ${missingDescriptions} sem descricao; campos originais serao preservados.`);
  return { counts, errors, warnings, ok: !errors.length };
}
module.exports = { audit };
if (require.main === module) {
  const directory = process.argv[2];
  if (!directory || !fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    console.error('Informe uma pasta de JSONs existente.'); process.exitCode = 1;
  } else {
    const result = audit(directory);
    // Aggregate counts only: never print clients, documents, plates or file URLs.
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
  }
}
