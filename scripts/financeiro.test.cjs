const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const api=import('data:text/javascript;base64,'+fs.readFileSync(require('node:path').join(__dirname,'../src/utils/finance.js')).toString('base64'));
const range=(y,m)=>[new Date(y,m-1,1),new Date(y,m,0,23,59,59,999)];
const car={id:1,buyPrice:50000,purchaseDate:'2026-10-15',status:'disponivel'};
const sale={car_id:'1',sellPrice:65000,date:'2026-11-02',profit:999999};
const expenses=[{carId:1,val:1200,date:'2026-10-16'},{car_id:'1',val:800,date:'2026-10-17'}];
test('an unsold purchase and preparation reduce cash in their own month without creating sales profit',async()=>{
 const {summarizeFinance:s}=await api;const r=s([car],[],expenses,...range(2026,10));assert.equal(r.acquisitions,50000);assert.equal(r.cashBalance,-52000);assert.equal(r.salesProfit,0);
});
test('a later sale does not repeat the acquisition and its profit includes prior-month vehicle expenses',async()=>{
 const {summarizeFinance:s}=await api;const r=s([{...car,status:'vendido'}],[sale],expenses,...range(2026,11));assert.equal(r.revenue,65000);assert.equal(r.acquisitions,0);assert.equal(r.operatingExpenses,0);assert.equal(r.cashBalance,65000);assert.equal(r.salesProfit,13000);
 const all=s([car],[sale],expenses,new Date(2026,0,1),new Date(2026,11,31));assert.equal(all.cashBalance,13000);assert.equal(all.salesProfit,13000);
});
test('general expenses affect period cash, not the direct profit of an individual vehicle',async()=>{
 const {summarizeFinance:s}=await api;const r=s([car],[sale],[...expenses,{val:100,date:'2026-11-02'}],...range(2026,11));assert.equal(r.cashBalance,64900);assert.equal(r.salesProfit,13000);
});
test('missing or invalid purchase dates are reported instead of silently assigned to a sale month',async()=>{
 const {summarizeFinance:s}=await api;const r=s([{...car,purchaseDate:null},{id:2,buy_price:200,purchase_date:'2026-02-31'}],[],[],...range(2026,11));assert.equal(r.acquisitions,0);assert.equal(r.purchasesWithoutDate,2);
});
test('legacy field names, period boundaries, cents and missing vehicles are handled explicitly',async()=>{
 const {summarizeFinance:s}=await api;const r=s([{id:1,buy_price:'0.30',purchase_date:'2026-11-01'}],[{carId:1,sell_price:'0.60',date:'2026-11-30'},{carId:999,sellPrice:100,date:'2026-12-01'}],[{carId:'1',val:'0.10',date:'2026-11-01'},{carId:'1',val:'0.20',date:'2026-11-30'}],...range(2026,11));assert.equal(r.cashBalance,0);assert.equal(r.salesProfit,0);assert.equal(r.purchasesWithoutDate,0);
 const missing=s([], [{carId:999,sellPrice:100,date:'2026-11-01'}],[],...range(2026,11));assert.equal(missing.revenue,100);assert.equal(missing.salesProfit,0);assert.equal(missing.salesWithoutVehicle,1);
});
