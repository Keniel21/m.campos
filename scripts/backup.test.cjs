const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const lib=require('./backup-lib.cjs');
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mcampos-backup-test-'));t.after(()=>fs.rmSync(root,{recursive:true}));
 fs.mkdirSync(path.join(root,'storage/documents'),{recursive:true});
 const bytes=Buffer.from('%PDF-1.4 test');const hash=lib.digest(bytes);
 fs.writeFileSync(path.join(root,'storage/documents',hash),bytes);fs.writeFileSync(path.join(root,'database.dump'),'fake dump for integrity unit test');
 const manifest={format:1,database:{database:'mcampos',documents:[{sha256:hash,size:bytes.length}]},files:lib.inventory(root)};
 function save(){const bytes=Buffer.from(JSON.stringify(manifest));fs.writeFileSync(path.join(root,'manifest.json'),bytes);fs.writeFileSync(path.join(root,'COMPLETE'),lib.digest(bytes));}
 save();return {root,hash,manifest,save};
}
test('backup verification detects damaged documents and incomplete copies',t=>{
 const {root,hash}=fixture(t);assert.equal(lib.verify(root).database.documents.length,1);
 fs.writeFileSync(path.join(root,'storage/documents',hash),'damaged');assert.throws(()=>lib.verify(root),/integrity mismatch/);
 fs.unlinkSync(path.join(root,'COMPLETE'));assert.throws(()=>lib.verify(root));
});
test('verification rejects additional files and path traversal',t=>{
 const {root}=fixture(t);fs.writeFileSync(path.join(root,'unexpected.txt'),'not part of the manifest');assert.throws(()=>lib.verify(root),/Unexpected/);
 for(const value of ['../secret','/etc/passwd','C:\\secret','storage/../../secret'])assert.throws(()=>lib.inside(root,value));
});
test('restore refuses production or the source database before any connection',async()=>{
 await assert.rejects(lib.ensureEmptyTarget({database:'mcampos'},{},{database:'mcampos'}),/separate/);
 await assert.rejects(lib.ensureEmptyTarget({database:'neondb'},{},{database:'mcampos'}),/separate/);
});
test('document backup refuses configuration files and corrupt immutable blobs',t=>{
 const {root,hash}=fixture(t);const source=path.join(root,'storage/documents');
 fs.writeFileSync(path.join(source,'.env'),'fake private config');
 assert.throws(()=>lib.copyDocuments(source,path.join(root,'copy')),/Unexpected/);
 assert.equal(fs.existsSync(path.join(root,'copy')),false);
 fs.unlinkSync(path.join(source,'.env'));fs.writeFileSync(path.join(source,hash),'damaged');
 assert.throws(()=>lib.copyDocuments(source,path.join(root,'copy')),/integrity mismatch/);
});
