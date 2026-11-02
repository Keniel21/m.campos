const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/utils/pendencias.js'),'utf8');
test('pending labels preserve legacy meaning and safely display user-created names',async()=>{
 const {pendingLabel,escapePending}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.equal(pendingLabel('none'),'Sem pendência');
 assert.equal(pendingLabel('sim'),'Documento na loja (anterior)');
 assert.equal(pendingLabel(null),'Não informado');
 assert.equal(pendingLabel('pending:1',[{code:'pending:1',name:'Transferência'}]),'Transferência');
 assert.equal(pendingLabel('pending:missing'),'Pendência não identificada');
 assert.equal(escapePending('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
