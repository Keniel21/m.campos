const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
async function fixture(handler){
 const calls=[];const active=new Set(['active']);const overlay={classList:{add:x=>active.add(x),remove:x=>active.delete(x)}};
 const nodes={'login-overlay':overlay,'login-email':{value:'operator@example.com'},'login-password':{value:'dummy-password'},'login-error-message':{style:{},textContent:''},'btn-web-logout':{style:{}}};
 const button={disabled:false};let reloads=0,renders=0;
 const window={fetch:async(input,options={})=>{const url=String(input);calls.push({url,options});return handler(url,options);},updateApplicationState:()=>renders++,initCharts:()=>{}};
 const location={origin:'https://app.example',href:'https://app.example/',reload:()=>reloads++};
 const context=vm.createContext({window,document:{getElementById:id=>nodes[id],querySelector:()=>button},location,URL,URLSearchParams,Headers,console,fetch:(...args)=>window.fetch(...args)});
 const state={};const module=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,'../src/services/supabase.js'),'utf8'),{context});
 await module.link(()=>new vm.SyntheticModule(['state'],function(){this.setExport('state',state)},{context}));await module.evaluate();module.namespace.initSupabase();
 return {api:module.namespace,nodes,calls,state,active,button,get reloads(){return reloads},get renders(){return renders}};
}
const session=authenticated=>({mode:'web',authenticated,userName:'operator@example.com',header:'X-CSRF-TOKEN',token:authenticated?'after-login':'before-login'});
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
test('anonymous startup shows the original login without requesting private data',async()=>{
 const f=await fixture(()=>response(session(false)));assert.equal(await f.api.checkActiveSession(),false);assert.equal(f.calls.length,1);assert.equal(f.renders,0);assert.ok(f.active.has('active'));assert.equal(f.state.sessionUser,null);
});
test('successful login refreshes CSRF, loads records and logout uses the new token',async()=>{
 let authenticated=false;
 const f=await fixture((url,options)=>{
  if(url.endsWith('/session'))return response(session(authenticated));
  if(url.endsWith('/login')){assert.equal(options.headers['X-CSRF-TOKEN'],'before-login');assert.equal(options.body.get('password'),'dummy-password');authenticated=true;return response(null,204);}
  if(url.endsWith('/logout')){assert.equal(options.headers['X-CSRF-TOKEN'],'after-login');authenticated=false;return response(null,204);}
  assert.ok(authenticated);return response({estoque:[{id:1}],documentos:[],serverDate:'2026-11-02'});
 });
 await f.api.handleLogin({preventDefault(){}});assert.equal(f.state.estoque.length,1);assert.equal(f.renders,1);assert.ok(!f.active.has('active'));assert.equal(f.nodes['login-password'].value,'');assert.equal(f.nodes['btn-web-logout'].style.display,'inline-flex');assert.equal(f.button.disabled,false);
 await f.api.handleLogout();assert.equal(f.reloads,1);
});
test('wrong credentials leave the login form active and never load records',async()=>{
 const f=await fixture(url=>url.endsWith('/session')?response(session(false)):response({},401));await f.api.handleLogin({preventDefault(){}});assert.match(f.nodes['login-error-message'].textContent,/E-mail ou senha/);assert.equal(f.renders,0);assert.ok(f.active.has('active'));assert.ok(f.calls.every(c=>!c.url.endsWith('/crm/data')));assert.equal(f.button.disabled,false);
});
test('an expired session reloads the page to discard rendered private forms',async()=>{
 let expire=false;const f=await fixture(url=>url.endsWith('/session')?response(session(true)):expire?response({},401):response({estoque:[]}));await f.api.checkActiveSession();expire=true;
 await assert.rejects(f.api.fetchCloudData(),/sessão expirou/);assert.equal(f.reloads,1);
});
