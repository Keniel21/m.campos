const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {settings,mediaType}=require('./migrate.cjs');
test('storage configuration refuses credentials sent to another branch or non-TLS endpoint',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcampos-storage-config-'));t.after(()=>fs.rmSync(dir,{recursive:true}));
 const file=path.join(dir,'config');const branch='br-test-example';
 const save=url=>fs.writeFileSync(file,`AWS_ENDPOINT_URL_S3=${url}\nAWS_REGION=us-east-1\nAWS_ACCESS_KEY_ID=dummy\nAWS_SECRET_ACCESS_KEY=dummy\nSTORAGE_BUCKET=documentos\n`);
 save('https://br-test-example.storage.c-13.us-east-1.aws.neon.tech');assert.equal(settings(file,branch).STORAGE_BUCKET,'documentos');
 for(const url of ['http://br-test-example.storage.c-13.us-east-1.aws.neon.tech','https://attacker.example','https://br-other-branch.storage.c-13.us-east-1.aws.neon.tech','https://user:password@br-test-example.storage.c-13.us-east-1.aws.neon.tech']){save(url);assert.throws(()=>settings(file,branch));}
});
test('uploaded documents require PDF or JPEG signatures',()=>{
 assert.equal(mediaType(Buffer.from('%PDF-1.4\n')),'application/pdf');assert.equal(mediaType(Buffer.from([255,216,255])),'image/jpeg');assert.throws(()=>mediaType(Buffer.from('<html>untrusted</html>')));
});
