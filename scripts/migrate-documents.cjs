const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_BYTES = 20 * 1024 * 1024;
const SOURCE_HOST = 'xjmyijeblktwncpivywh.supabase.co';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function mediaType(bytes) {
  if (bytes.subarray(0,5).toString() === '%PDF-') return 'application/pdf';
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  throw new Error('UNSUPPORTED_FILE_SIGNATURE');
}
function sourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== SOURCE_HOST || url.port || url.username || url.password ||
      !url.pathname.startsWith('/storage/v1/object/public/documentos/')) throw new Error('UNEXPECTED_SOURCE');
  return url.href;
}
async function download(url) {
  const response = await fetch(sourceUrl(url), {redirect:'error',signal:AbortSignal.timeout(60000)});
  if (!response.ok) throw new Error(`SOURCE_HTTP_${response.status}`);
  const expected = response.headers.get('content-length');
  if (expected && Number(expected) > MAX_BYTES) throw new Error('FILE_TOO_LARGE');
  let total = 0; const chunks=[];
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > MAX_BYTES) { await response.body.cancel().catch(()=>{}); throw new Error('FILE_TOO_LARGE'); }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (!bytes.length || (expected && total !== Number(expected))) throw new Error('INCOMPLETE_DOWNLOAD');
  return {bytes,sha256:hash(bytes),size:bytes.length,mediaType:mediaType(bytes)};
}
async function migrate({baseUrl='http://127.0.0.1:18080',directory=path.resolve(__dirname,'../storage'),link=false}={}) {
  const base = new URL(baseUrl);
  if (!['127.0.0.1','localhost'].includes(base.hostname) || base.protocol!=='http:') throw new Error('LOCAL_BACKEND_REQUIRED');
  const blobs=path.join(directory,'documents'); fs.mkdirSync(blobs,{recursive:true});
  const journal=path.join(directory,'document-migration.json');
  const manifest=fs.existsSync(journal)?JSON.parse(fs.readFileSync(journal,'utf8')):{version:1,records:{}};
  const save=()=>{ fs.writeFileSync(journal+'.tmp',JSON.stringify(manifest,null,2)); fs.renameSync(journal+'.tmp',journal); };
  const response=await fetch(new URL('/api/desktop/crm/documentos',base));
  if (!response.ok) throw new Error(`LOCAL_HTTP_${response.status}`);
  const docs=await response.json();
  let session, cookie;
  if (link) {
    const response=await fetch(new URL('/api/desktop/session',base));
    if(!response.ok)throw new Error('LOCAL_SESSION_FAILED');
    session=await response.json(); cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  }
  const summary={total:docs.length,copied:0,linked:0,failed:0,bytes:0};
  let cursor=0;
  async function worker() {
    while(cursor<docs.length) {
      const doc=docs[cursor++];
      let entry=manifest.records[doc.id];
      try {
        const original=entry?.sourceUrl || doc.legacyFileUrl || doc.fileUrl || doc.file_url;
        sourceUrl(original);
        let valid=false;
        if(entry?.sha256 && /^[a-f0-9]{64}$/.test(entry.sha256)) {
          const local=path.join(blobs,entry.sha256);
          valid=fs.existsSync(local) && hash(fs.readFileSync(local))===entry.sha256;
        }
        if(!valid) {
          let result;
          for(let attempt=0;attempt<3;attempt++) {
            try { result=await download(original); break; }
            catch(error) { if(attempt===2)throw error; }
          }
          const destination=path.join(blobs,result.sha256);
          if(!fs.existsSync(destination)) { fs.writeFileSync(destination+'.part',result.bytes); fs.renameSync(destination+'.part',destination); }
          if(hash(fs.readFileSync(destination))!==result.sha256) throw new Error('LOCAL_HASH_MISMATCH');
          entry={id:doc.id,sourceUrl:original,sha256:result.sha256,size:result.size,mediaType:result.mediaType,copiedAt:new Date().toISOString()};
          manifest.records[doc.id]=entry; save();
        }
        summary.copied++; summary.bytes+=entry.size;
        if(link) {
          const response=await fetch(new URL(`/api/desktop/documents/${doc.id}/local-copy`,base),{
            method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,[session.header]:session.token},
            body:JSON.stringify({sourceUrl:entry.sourceUrl,sha256:entry.sha256,size:entry.size,mediaType:entry.mediaType})
          });
          if(!response.ok)throw new Error(`LINK_HTTP_${response.status}`);
          const file=await fetch(new URL(`/api/desktop/documents/${doc.id}/content`,base));
          if(!file.ok || hash(Buffer.from(await file.arrayBuffer()))!==entry.sha256)throw new Error('SERVED_HASH_MISMATCH');
          entry.linkedAt=new Date().toISOString(); summary.linked++; save();
        }
        delete entry.error;
      } catch(error) {
        summary.failed++;
        manifest.records[doc.id]={...(entry||{id:doc.id}),error:error.message}; save();
      }
      if((summary.copied+summary.failed)%25===0)console.log(JSON.stringify(summary));
    }
  }
  await Promise.all(Array.from({length:4},worker)); save();
  console.log(JSON.stringify(summary));
  return summary;
}
module.exports={hash,mediaType,sourceUrl,download,migrate};
if(require.main===module)migrate({link:process.argv.includes('--link')}).then(r=>{process.exitCode=r.failed?1:0;}).catch(e=>{console.error(e.message);process.exitCode=1;});
