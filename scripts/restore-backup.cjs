const fs=require('node:fs');const path=require('node:path');const lib=require('./backup-lib.cjs');
async function restore(options={}) {
 if(!options.backup||!options['target-config'])throw Error('Informe --backup e --target-config');
 const source=path.resolve(options.backup);const manifest=lib.verify(source);
 const connection=lib.config(options['target-config']);const pg=lib.tools(options['pg-bin']);
 await lib.ensureEmptyTarget(connection,pg,manifest.database);
 const parent=path.resolve(options['restore-root']||path.join(lib.ROOT,'backups'));fs.mkdirSync(parent,{recursive:true});
 const destination=path.join(parent,'restore-'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z$/,'Z'));fs.mkdirSync(destination);
 lib.copyTree(path.join(source,'storage'),path.join(destination,'storage'));
 // Every file is verified before the first write to the empty target database.
 for(const file of manifest.files.filter(f=>f.path.startsWith('storage/'))) {
  const bytes=fs.readFileSync(lib.inside(destination,file.path));if(lib.digest(bytes)!==file.sha256)throw Error('Restored file integrity mismatch');
 }
 await lib.run(pg.restore,['--no-password','--no-owner','--no-acl','--single-transaction','--exit-on-error','--dbname',connection.database,path.join(source,'database.dump')],lib.pgEnvironment(connection));
 const actual=await lib.metadata(connection,pg);
 if(JSON.stringify(actual.tables)!==JSON.stringify(manifest.database.tables)||JSON.stringify(actual.modules)!==JSON.stringify(manifest.database.modules))throw Error('Restored database rows do not match the snapshot');
 const sequenceCheck=await lib.sql(connection,pg,"SELECT (SELECT last_value FROM public.crm_public_id_seq)>=(SELECT COALESCE(max(public_id),0) FROM public.crm_records) AND (SELECT last_value FROM public.app_users_id_seq)>=(SELECT COALESCE(max(id),0) FROM public.app_users)");
 if(sequenceCheck!=='t')throw Error('Restored sequence is behind the saved identifiers');
 const result={status:'restored-and-verified',database:actual.database,folder:destination,modules:actual.modules,documents:actual.documents.length,tables:actual.tables};
 fs.writeFileSync(path.join(destination,'restore-report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));return result;
}
module.exports={restore};
if(require.main===module)restore(lib.args(process.argv.slice(2))).catch(e=>{console.error(e.message);process.exitCode=1;});
