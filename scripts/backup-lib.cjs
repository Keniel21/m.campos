const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const tls=require('node:tls');
const {spawn}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function args(argv) {
 const result={};
 for(let i=0;i<argv.length;i+=2){if(!/^--[a-z-]+$/.test(argv[i])||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('Expected --option value');result[argv[i].slice(2)]=argv[i+1];}
 return result;
}
function inside(root,relative) {
 if(typeof relative!=='string'||!relative||relative.includes('\\')||path.isAbsolute(relative))throw Error('Unsafe backup path');
 const resolved=path.resolve(root,relative); const rel=path.relative(path.resolve(root),resolved);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('Unsafe backup path');
 return resolved;
}
function config(file) {
 const values={};
 for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)) {
  if(!line.trim()||line.trimStart().startsWith('#'))continue;
  const index=line.indexOf('=');if(index<0)throw Error('Invalid private configuration');
  const key=line.slice(0,index).trim();if(Object.hasOwn(values,key))throw Error('Duplicate private configuration key');values[key]=line.slice(index+1);
 }
 for(const key of ['DB_URL','DB_USER','DB_PASSWORD'])if(!values[key])throw Error('Missing '+key);
 const url=new URL(values.DB_URL.replace(/^jdbc:/,''));
 if(url.protocol!=='postgresql:'||url.username||url.password||url.hostname.includes('-pooler'))throw Error('Use a direct PostgreSQL URL without embedded credentials');
 if(url.search)throw Error('Use DB_URL without TLS parameters; verification is enforced by the backup tool');
 return {values,host:url.hostname,port:url.port||'5432',database:decodeURIComponent(url.pathname.slice(1))};
}
function pgEnvironment(connection) {
 const ca=path.join(os.tmpdir(),'mcampos-postgresql-ca.pem');
 fs.writeFileSync(ca,tls.rootCertificates.join('\n')+'\n');
 const env={...process.env,PGHOST:connection.host,PGPORT:connection.port,PGDATABASE:connection.database,
  PGUSER:connection.values.DB_USER,PGPASSWORD:connection.values.DB_PASSWORD,PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,
  PGTZ:'UTC',PGCONNECT_TIMEOUT:'20',PGAPPNAME:'mcampos-backup',PGOPTIONS:'-c timezone=UTC'};
 delete env.PGSERVICE; delete env.PGSERVICEFILE;
 return env;
}
function tools(directory) {
 directory=directory||process.env.PG_BIN;
 if(!directory)throw Error('Informe --pg-bin com a pasta dos utilitarios PostgreSQL 18.');
 const executable=name=>{const file=path.resolve(directory,name+(process.platform==='win32'?'.exe':''));if(!fs.existsSync(file))throw Error('Utilitario ausente: '+name);return file;};
 return {dump:executable('pg_dump'),restore:executable('pg_restore'),psql:executable('psql')};
}
function run(executable,argv,env) {
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,argv,{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  child.on('error',()=>reject(Error('Unable to start PostgreSQL utility')));
  child.on('close',code=>code===0?resolve(stdout):reject(Error(path.basename(executable)+' failed: '+stderr.trim())));
 });
}
const identifier=s=>'"'+s.replaceAll('"','""')+'"';
async function sql(connection,pg,query,snapshot) {
 const prefix=snapshot?`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET TRANSACTION SNAPSHOT '${snapshot}'; `:'';
 return (await run(pg.psql,['-X','-q','-t','-A','--no-password','--set','ON_ERROR_STOP=1','--command',prefix+query+(snapshot?'; COMMIT;':'')],pgEnvironment(connection))).trim();
}
async function snapshot(connection,pg) {
 const child=spawn(pg.psql,['-X','-q','-t','-A','--no-password','--set','ON_ERROR_STOP=1'],{env:pgEnvironment(connection),windowsHide:true,stdio:['pipe','pipe','pipe']});
 let output='',stderr='',settled=false;
 const id=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(Error('Snapshot timeout'));},30000);
  child.on('error',()=>{clearTimeout(timer);reject(Error('Unable to start snapshot session'));});
  child.stderr.on('data',b=>stderr+=b);
  child.stdout.on('data',b=>{output+=b;const match=output.match(/SNAPSHOT:([0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+)/);if(match&&!settled){settled=true;clearTimeout(timer);resolve(match[1]);}});
  child.on('close',()=>{if(!settled){clearTimeout(timer);reject(Error('Snapshot failed: '+stderr.trim()));}});
  child.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT 'SNAPSHOT:' || pg_export_snapshot();\n");
 });
 return {id,close:()=>new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('close',resolve);child.stdin.end('ROLLBACK;\n\\q\n');})};
}
async function metadata(connection,pg,snapshotId) {
 const base=JSON.parse(await sql(connection,pg,"SELECT jsonb_build_object('database',current_database(),'serverVersionNum',current_setting('server_version_num')::int,'tables',(SELECT COALESCE(jsonb_agg(tablename ORDER BY tablename),'[]'::jsonb) FROM pg_tables WHERE schemaname='public'))",snapshotId));
 const tables={};
 for(const table of base.tables) {
  tables[table]=JSON.parse(await sql(connection,pg,`SELECT jsonb_build_object('rows',count(*),'sha256',encode(sha256(convert_to(COALESCE(string_agg(row_value::text,E'\\n' ORDER BY row_value::text),''),'UTF8')),'hex')) FROM (SELECT to_jsonb(t) AS row_value FROM public.${identifier(table)} t) q`,snapshotId));
 }
 const modules=JSON.parse(await sql(connection,pg,"SELECT COALESCE(jsonb_object_agg(module,total),'{}'::jsonb) FROM (SELECT module,count(*) AS total FROM public.crm_records GROUP BY module) q",snapshotId));
 const documents=JSON.parse(await sql(connection,pg,"SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'sha256',payload->>'storageHash','size',(payload->>'storageSize')::bigint) ORDER BY id),'[]'::jsonb) FROM public.crm_records WHERE module='documentos'",snapshotId));
 if(documents.some(d=>!d.sha256))throw Error('Some documents have no local copy; complete the document migration before backup');
 return {database:base.database,serverVersionNum:base.serverVersionNum,tables,modules,documents};
}
function copyTree(source,destination) {
 fs.mkdirSync(destination,{recursive:true});
 for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
  if(entry.isSymbolicLink())throw Error('Symlinks are not accepted in document storage');
  if(/\.(part|tmp)$/.test(entry.name))continue;
  const from=path.join(source,entry.name),to=path.join(destination,entry.name);
  if(entry.isDirectory())copyTree(from,to);else if(entry.isFile())fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);
 }
}
function copyDocuments(source,destination) {
 const entries=fs.readdirSync(source,{withFileTypes:true});
 for(const entry of entries) {
  if(/\.(part|tmp)$/.test(entry.name))continue;
  if(!entry.isFile()||entry.isSymbolicLink()||!/^[a-f0-9]{64}$/.test(entry.name))throw Error('Unexpected content in documents folder; backup refused');
 }
 fs.mkdirSync(destination,{recursive:true});
 for(const entry of entries) {
  if(/\.(part|tmp)$/.test(entry.name))continue;
  const bytes=fs.readFileSync(path.join(source,entry.name));
  if(digest(bytes)!==entry.name)throw Error('Document storage integrity mismatch');
  fs.writeFileSync(path.join(destination,entry.name),bytes,{flag:'wx'});
 }
}
function inventory(root,current=root) {
 const files=[];
 for(const entry of fs.readdirSync(current,{withFileTypes:true})) {
  if(entry.isSymbolicLink())throw Error('Symlinks are not accepted in a backup');
  const file=path.join(current,entry.name);
  if(entry.isDirectory())files.push(...inventory(root,file));
  else if(entry.isFile()){const bytes=fs.readFileSync(file);files.push({path:path.relative(root,file).split(path.sep).join('/'),size:bytes.length,sha256:digest(bytes)});}
 }
 return files.sort((a,b)=>a.path.localeCompare(b.path));
}
function verify(root) {
 const bytes=fs.readFileSync(path.join(root,'manifest.json'));
 if(fs.readFileSync(path.join(root,'COMPLETE'),'utf8').trim()!==digest(bytes))throw Error('Backup incomplete or manifest changed');
 const manifest=JSON.parse(bytes);
 if(manifest.format!==1||!Array.isArray(manifest.files))throw Error('Unsupported backup format');
 const files=new Map();
 const actual=inventory(root).map(f=>f.path).filter(name=>!['manifest.json','COMPLETE'].includes(name));
 const expected=manifest.files.map(f=>f.path);
 if(actual.length!==expected.length||actual.some(name=>!expected.includes(name)))throw Error('Unexpected or missing files in backup');
 for(const file of manifest.files) {
  if(files.has(file.path))throw Error('Duplicate file in backup manifest');
  const target=inside(root,file.path);
  if(!fs.lstatSync(target).isFile()||fs.lstatSync(target).isSymbolicLink())throw Error('Invalid backup file');
  const bytes=fs.readFileSync(target);
  if(bytes.length!==file.size||digest(bytes)!==file.sha256)throw Error('Backup integrity mismatch: '+file.path);
  files.set(file.path,file);
 }
 if(!files.has('database.dump'))throw Error('Database dump missing');
 for(const doc of manifest.database.documents) {
  if(!/^[a-f0-9]{64}$/.test(doc.sha256))throw Error('Invalid document hash in snapshot');
  const file=files.get('storage/documents/'+doc.sha256);
  if(!file||file.sha256!==doc.sha256||file.size!==doc.size)throw Error('Document missing from the matching backup');
 }
 return manifest;
}
async function ensureEmptyTarget(connection,pg,source) {
 if(!/^mcampos_restore_[a-z0-9_]+$/.test(connection.database)||connection.database===source.database)throw Error('Restoration is restricted to a separate mcampos_restore_* database');
 const count=await sql(connection,pg,"SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema')+(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')");
 if(Number(count)!==0)throw Error('Restore target is not empty; no objects were removed or overwritten');
}
module.exports={ROOT,args,inside,config,pgEnvironment,tools,run,sql,snapshot,metadata,copyTree,copyDocuments,inventory,verify,ensureEmptyTarget,digest};
