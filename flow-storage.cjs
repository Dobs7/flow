const fs=require('node:fs'),path=require('node:path');
function createStore(folder){
 const file=path.join(folder,'flow-data.json');
 let sessionBackedUp=false;
 function validate(value){if(!value||!['tasks','habits','routine'].every(k=>Array.isArray(value[k])))throw Error('Dados Flow inválidos. Restaure um backup antes de continuar.');return value;}
 function load(){
  let raw;
  try{raw=fs.readFileSync(file,'utf8');}
  catch(error){
   if(error.code!=='ENOENT')throw error;
   const backup=path.join(folder,'backups');
   if(fs.existsSync(file+'.tmp') || (fs.existsSync(backup)&&fs.readdirSync(backup).some(name=>/^flow-.*\.json$/.test(name)))){
    throw Error('O arquivo principal está ausente, mas existem dados de recuperação. Abra a pasta dos dados pelo menu Flow.');
   }
   return null;
  }
  return validate(JSON.parse(raw.replace(/^\uFEFF/,'')));
 }
 function save(value){
  validate(value);
  const bytes=JSON.stringify(value);if(Buffer.byteLength(bytes)>20*1024*1024)throw Error('Dados muito grandes');
  fs.mkdirSync(folder,{recursive:true});
  if(fs.existsSync(file)){const backup=path.join(folder,'backups');fs.mkdirSync(backup,{recursive:true});const day=new Date().toISOString().slice(0,10),target=path.join(backup,'flow-'+day+'.json');if(!fs.existsSync(target))fs.copyFileSync(file,target);if(!sessionBackedUp){fs.copyFileSync(file,path.join(backup,'flow-session-'+Date.now()+'-'+require('node:crypto').randomUUID()+'.json'));sessionBackedUp=true;}}
  const temp=file+'.tmp';let fd;
  try{fd=fs.openSync(temp,'w');fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{if(fd!==undefined)fs.closeSync(fd);}
  fs.renameSync(temp,file);return true;
 }
 return {load,save,file};
}
module.exports={createStore};
