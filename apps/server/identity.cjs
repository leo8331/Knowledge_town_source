'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const projectRoot=path.resolve(__dirname,'../..');
function gameIdentity(root=projectRoot){
 const hash=crypto.createHash('sha256'),project=fs.realpathSync(root),files=[];
 function visit(folder){for(const item of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  const file=path.join(folder,item.name),relative=path.relative(root,file).replaceAll('\\','/');
  // Runtime data and private, hot-read configuration do not change loaded server code.
  if(item.name.startsWith('.')||relative==='dist/knowledge/library'||relative==='dist/generated-scenes')continue;
  if(item.isDirectory())visit(file);else files.push(file);
 }}
 visit(path.join(root,'dist'));visit(path.join(root,'apps/server'));
 for(const file of files){hash.update(path.relative(root,file).replaceAll('\\','/'));hash.update('\0');hash.update(fs.readFileSync(file));hash.update('\0');}
 return {app:'knowledge-town-local-v1',projectId:crypto.createHash('sha256').update(process.platform==='win32'?project.toLowerCase():project).digest('hex'),buildId:hash.digest('hex')};
}
module.exports={gameIdentity};
