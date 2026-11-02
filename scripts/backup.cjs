const fs=require('node:fs');const path=require('node:path');const lib=require('./backup-lib.cjs');
async function backup(options={}) {
 const connection=lib.config(options.config||path.join(lib.ROOT,'.env.neon.maintenance'));
 const pg=lib.tools(options['pg-bin']);
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z');
 const parent=path.resolve(options.destination||path.join(lib.ROOT,'backups'));fs.mkdirSync(parent,{recursive:true});
 const folder=path.join(parent,'mcampos-'+stamp);fs.mkdirSync(folder);
 const holder=await lib.snapshot(connection,pg);
 try {
  const metadata=await lib.metadata(connection,pg,holder.id);
  const version=await lib.run(pg.dump,['--version'],process.env);
  if(Number(version.match(/(\d+)\./)?.[1])<Math.floor(metadata.serverVersionNum/10000))throw Error('pg_dump is older than the PostgreSQL server');
  await lib.run(pg.dump,['--no-password','--format=custom','--no-owner','--no-acl','--snapshot',holder.id,'--file',path.join(folder,'database.dump')],lib.pgEnvironment(connection));
  const documentRoot=connection.values.DOCUMENT_DIRECTORY?path.resolve(lib.ROOT,connection.values.DOCUMENT_DIRECTORY):path.join(lib.ROOT,'storage/documents');
  lib.copyDocuments(documentRoot,path.join(folder,'storage/documents'));
  const journal=path.join(path.dirname(documentRoot),'document-migration.json');
  if(fs.existsSync(journal))fs.copyFileSync(journal,path.join(folder,'storage/document-migration.json'));
  const manifest={format:1,createdAt:new Date().toISOString(),applicationRevision:options.revision||'unspecified',database:metadata,pgDumpVersion:version.trim(),files:lib.inventory(folder)};
  const bytes=Buffer.from(JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(folder,'manifest.json'),bytes);
  fs.writeFileSync(path.join(folder,'COMPLETE'),lib.digest(bytes)+'\n');
  lib.verify(folder);
  console.log(JSON.stringify({status:'verified',folder,modules:metadata.modules,documents:metadata.documents.length,files:manifest.files.length}));
  return folder;
 } finally { await holder.close(); }
}
module.exports={backup};
if(require.main===module)backup(lib.args(process.argv.slice(2))).catch(e=>{console.error(e.message);process.exitCode=1;});
