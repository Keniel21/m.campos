const lib=require('./backup-lib.cjs');
try {
 const options=lib.args(process.argv.slice(2));if(!options.backup)throw Error('Informe --backup com a pasta extraida.');
 const manifest=lib.verify(require('node:path').resolve(options.backup));
 console.log(JSON.stringify({status:'verified',createdAt:manifest.createdAt,modules:manifest.database.modules,documents:manifest.database.documents.length,files:manifest.files.length}));
}catch(error){console.error(error.message);process.exitCode=1;}
