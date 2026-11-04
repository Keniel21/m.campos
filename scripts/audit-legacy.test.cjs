const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { audit } = require('./audit-legacy.cjs');
function fixture(t, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcampos-audit-'));
  t.after(() => fs.rmSync(dir, { recursive: true }));
  for (const [name, rows] of Object.entries(files)) fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(rows));
  return dir;
}
test('preserves duplicate sale history while reporting it, without exposing personal data', t => {
  const dir = fixture(t, { estoque: [{id:1}], vendas:[{id:1,carId:1,client:'PRIVATE'},{id:2,car_id:1}], despesas:[{id:1,carId:1,val:12}] });
  const result = audit(dir);
  assert.equal(result.ok, true);
  assert.equal(result.counts.vendas, 2);
  assert.ok(result.warnings.some(w => w.includes('venda historica')));
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
});
test('blocks duplicate IDs, orphan references and sales without vehicles', t => {
  const dir = fixture(t, { estoque:[{id:1},{id:1}], vendas:[{id:1,carId:99},{id:2}] });
  const result = audit(dir);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.includes('id duplicado')));
  assert.ok(result.errors.some(e => e.includes('2 vinculos')));
});
test('blocks absent inventory and malformed JSON', t => {
  const dir = fixture(t, {});
  fs.writeFileSync(path.join(dir, 'vendas.json'), '{');
  assert.equal(audit(dir).ok, false);
});
