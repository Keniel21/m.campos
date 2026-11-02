const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('desktop session without email renders the existing operator panel',async()=>{
 const panel={innerHTML:''};
 const state={sessionUser:{id:'adm-master-session',role:'admin'},leads:[],estoque:[],vendas:[],despesas:[],agenda:[]};
 const context=vm.createContext({window:{},document:{getElementById:id=>id==='autoagent-panel-container'?panel:null},Date,console});
 const dashboard=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,'../src/features/dashboard/dashboard.js'),'utf8'),{context});
 await dashboard.link(async specifier=>{
  const values=specifier.includes('state.js')?{state}:specifier.includes('configuracoes')?
   {getFilteredDates:()=>({start:new Date(),end:new Date()}),getPeriodLabel:()=>'',switchTab:()=>{}}:
   {formatCurrency:()=>'',calcDaysInStock:()=>0};
  return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value)},{context});
 });
 await dashboard.evaluate();
 assert.doesNotThrow(()=>dashboard.namespace.renderAutoAgentPanel());
 assert.match(panel.innerHTML,/Operador/);
});
