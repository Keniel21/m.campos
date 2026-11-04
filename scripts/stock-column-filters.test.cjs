const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/utils/stock-filters.js'),'utf8');
const modulePromise=import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const cars=[{id:1,status:'vendido',type:'varejo'},{id:2,status:'disponivel',type:'repasse'},{id:3,status:'disponivel',type:'varejo'}];
const cell=(car,key)=>({value:car[key],label:String(car[key])});
test('column filters combine columns with AND and choices with OR; empty selection matches none',async()=>{
 const {matchesStockColumns}=await modulePromise;
 const filters=new Map([['status',new Set(['disponivel'])],['type',new Set(['varejo'])]]);
 assert.deepEqual(cars.filter(c=>matchesStockColumns(c,filters,cell)).map(c=>c.id),[3]);
 filters.set('type',new Set(['varejo','repasse']));assert.equal(cars.filter(c=>matchesStockColumns(c,filters,cell)).length,2);
 filters.set('status',new Set());assert.equal(cars.filter(c=>matchesStockColumns(c,filters,cell)).length,0);
 filters.clear();assert.equal(cars.filter(c=>matchesStockColumns(c,filters,cell)).length,3);
});
test('choices reflect other active columns and retain temporarily excluded selections',async()=>{
 const {stockColumnOptions}=await modulePromise;
 const filters=new Map([['type',new Set(['repasse'])]]);
 assert.deepEqual(stockColumnOptions(cars,'status',filters,cell).map(x=>x.value),['disponivel']);
 filters.set('status',new Set(['vendido']));
 assert.deepEqual(stockColumnOptions(cars,'status',filters,cell).map(x=>x.value),['disponivel','vendido']);
});
