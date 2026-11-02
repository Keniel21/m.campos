const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const {S3Client,HeadObjectCommand,GetObjectCommand,PutObjectCommand}=require('@aws-sdk/client-s3');
const lib=require('../../scripts/backup-lib.cjs');
function settings(file,branch) {
 const values={};
 for(const line of fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)) {
  if(!line.trim()||line.trimStart().startsWith('#'))continue;
  const index=line.indexOf('=');if(index<1)throw Error('Invalid private storage configuration');
  const key=line.slice(0,index);if(Object.hasOwn(values,key))throw Error('Duplicate storage setting');values[key]=line.slice(index+1);
 }
 for(const key of ['AWS_ENDPOINT_URL_S3','AWS_REGION','AWS_ACCESS_KEY_ID','AWS_SECRET_ACCESS_KEY','STORAGE_BUCKET'])if(!values[key])throw Error('Missing '+key);
 const url=new URL(values.AWS_ENDPOINT_URL_S3);
 if(!/^br-[a-z0-9-]+$/.test(branch||'')||url.protocol!=='https:'||url.username||url.password||url.search||url.port||url.pathname!=='/'||url.hostname!==branch+'.storage.c-13.us-east-1.aws.neon.tech')throw Error('Expected the approved Virginia test branch endpoint');
 if(values.STORAGE_BUCKET!=='documentos'||values.AWS_REGION!=='us-east-1')throw Error('Unexpected storage bucket or region');
 return values;
}
function client(values) {
 return new S3Client({endpoint:values.AWS_ENDPOINT_URL_S3,region:values.AWS_REGION,forcePathStyle:true,maxAttempts:3,
  requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',
  credentials:{accessKeyId:values.AWS_ACCESS_KEY_ID,secretAccessKey:values.AWS_SECRET_ACCESS_KEY}});
}
function mediaType(bytes) {
 if(bytes.subarray(0,5).toString('ascii')==='%PDF-')return 'application/pdf';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 throw Error('Unsupported document signature');
}
async function bytes(s3,bucket,key) {
 const response=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));
 return Buffer.from(await response.Body.transformToByteArray());
}
async function migrate(options) {
 const source=path.resolve(options.backup);const manifest=lib.verify(source);
 const values=settings(options.config,options.branch);const s3=client(values);const bucket=values.STORAGE_BUCKET;
 const unique=new Map(manifest.database.documents.map(doc=>[doc.sha256,doc]));
 let uploaded=0,reused=0,verified=0,cursor=0,totalBytes=0;
 const documents=[...unique.values()];
 const destination=options['backup-destination']?path.resolve(options['backup-destination']):null;
 if(destination&&fs.existsSync(destination))throw Error('Independent backup destination already exists');
 if(destination)fs.mkdirSync(path.join(destination,'storage/documents'),{recursive:true});
 try {
  await Promise.all(Array.from({length:3},async()=>{
   while(cursor<documents.length) {
    const doc=documents[cursor++];const local=fs.readFileSync(lib.inside(source,'storage/documents/'+doc.sha256));
    assert.equal(lib.digest(local),doc.sha256);assert.equal(local.length,doc.size);const mime=mediaType(local);
    let exists=true;
    try {await s3.send(new HeadObjectCommand({Bucket:bucket,Key:doc.sha256}));}
    catch(error){if(error.$metadata?.httpStatusCode===404)exists=false;else throw error;}
    if(!exists){await s3.send(new PutObjectCommand({Bucket:bucket,Key:doc.sha256,Body:local,ContentType:mime,CacheControl:'private, no-store',Metadata:{sha256:doc.sha256}}));uploaded++;}else reused++;
    const downloaded=await bytes(s3,bucket,doc.sha256);
    assert.equal(downloaded.length,doc.size);assert.equal(lib.digest(downloaded),doc.sha256);totalBytes+=downloaded.length;verified++;
    if(destination)fs.writeFileSync(path.join(destination,'storage/documents',doc.sha256),downloaded,{flag:'wx'});
    if(verified%50===0)console.log(JSON.stringify({verified,total:documents.length}));
   }
  }));
  // Existing objects must also reject unauthenticated reads and listings.
  for(const suffix of [bucket+'/'+documents[0].sha256,bucket+'?list-type=2']) {
   const response=await fetch(values.AWS_ENDPOINT_URL_S3+'/'+suffix,{redirect:'error',signal:AbortSignal.timeout(15000)});
   assert.equal(response.status,403,'Anonymous storage request was not denied');await response.body?.cancel();
  }
  if(destination) {
   fs.copyFileSync(path.join(source,'database.dump'),path.join(destination,'database.dump'));
   const saved={format:1,createdAt:new Date().toISOString(),applicationRevision:manifest.applicationRevision,database:manifest.database,pgDumpVersion:manifest.pgDumpVersion,source:'Neon private Object Storage verified downloads + matching PostgreSQL snapshot',files:lib.inventory(destination)};
   const buffer=Buffer.from(JSON.stringify(saved,null,2));fs.writeFileSync(path.join(destination,'manifest.json'),buffer);fs.writeFileSync(path.join(destination,'COMPLETE'),lib.digest(buffer)+'\n');lib.verify(destination);
  }
  const result={status:'migrated-and-verified',branch:options.branch,bucket,documentRecords:manifest.database.documents.length,uniqueFiles:documents.length,uploaded,reused,verified,bytes:totalBytes,anonymousRead:'denied',anonymousList:'denied',independentBackup:destination};
  if(options.report)fs.writeFileSync(options.report,JSON.stringify(result,null,2));console.log(JSON.stringify(result));return result;
 } finally {s3.destroy();}
}
module.exports={settings,client,bytes,mediaType,migrate};
if(require.main===module)migrate(lib.args(process.argv.slice(2))).catch(error=>{console.error('Storage migration stopped: '+error.name+' (HTTP '+(error.$metadata?.httpStatusCode||'n/a')+'). No source files were removed.');process.exitCode=1});
