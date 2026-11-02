const {test}=require('node:test');
const assert=require('node:assert/strict');
const {sourceUrl,mediaType,hash,download}=require('./migrate-documents.cjs');
const source='https://xjmyijeblktwncpivywh.supabase.co/storage/v1/object/public/documentos/teste.pdf';
test('restricts migration downloads to the original storage bucket',()=>{
 assert.equal(sourceUrl(source),source);
 for(const url of ['http://localhost/private','https://example.com/document.pdf',source.replace('/documentos/','/another/'),source.replace('https://','https://user:password@')])
  assert.throws(()=>sourceUrl(url));
});
test('verifies bytes and rejects incomplete or disguised downloads',async t=>{
 const bytes=Buffer.from('%PDF-1.4\n%%EOF\n');
 assert.equal(mediaType(bytes),'application/pdf');
 assert.equal(hash(bytes).length,64);
 const mocked=t.mock.method(global,'fetch',async()=>new Response(bytes,{headers:{'Content-Length':String(bytes.length)}}));
 const copied=await download(source);
 assert.equal(copied.sha256,hash(bytes)); assert.equal(copied.size,bytes.length);
 mocked.mock.mockImplementation(async()=>new Response(bytes,{headers:{'Content-Length':String(bytes.length+1)}}));
 await assert.rejects(download(source),/INCOMPLETE_DOWNLOAD/);
 mocked.mock.mockImplementation(async()=>new Response('<html>error</html>',{headers:{'Content-Type':'application/pdf'}}));
 await assert.rejects(download(source),/UNSUPPORTED_FILE_SIGNATURE/);
 mocked.mock.mockImplementation(async()=>new Response('missing',{status:404}));
 await assert.rejects(download(source),/SOURCE_HTTP_404/);
});
