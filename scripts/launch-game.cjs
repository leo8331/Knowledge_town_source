'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),DEFAULT_PORT=8782;
const {gameIdentity}=require('../apps/server/identity.cjs');
function portNumber(value){const n=Number(value);if(!Number.isInteger(n)||n<1024||n>65535)throw Error('Port must be an integer from 1024 to 65535.');return n;}
async function probe(port){
 try{const response=await fetch('http://127.0.0.1:'+port+'/api/game-info',{signal:AbortSignal.timeout(1500),redirect:'error'});
  if(!response.ok)return 'other';const actual=await response.json(),expected=gameIdentity();
  return actual.app===expected.app&&actual.projectId===expected.projectId&&actual.buildId===expected.buildId?'game':'other';
 }catch(error){if(error.cause?.code==='ECONNREFUSED')return 'free';if(['TimeoutError','AbortError','SyntaxError'].includes(error.name))return 'other';throw error;}
}
async function ensureGameServer({port=DEFAULT_PORT,startServer}={}){
 port=portNumber(port);const status=await probe(port);
 if(status==='other')throw Error('Port '+port+' is occupied by another app or an older game build. Restart the server for this project, then try again. Do not close unrelated Node programs. The launcher keeps this port to preserve your browser save.');
 if(status==='game')return {port,url:'http://127.0.0.1:'+port+'/',reused:true};
 const child=(startServer||(()=>{
  const folder=path.join(root,'artifacts/runtime');fs.mkdirSync(folder,{recursive:true});const log=fs.openSync(path.join(folder,'launcher.log'),'a');
  try{const process=cp.spawn(global.process.execPath,[path.join(root,'server.cjs')],{cwd:root,env:{...global.process.env,PORT:String(port)},detached:true,windowsHide:true,stdio:['ignore',log,log]});process.unref();return process;}finally{fs.closeSync(log);}
 }))();let launchError;child?.on?.('error',error=>{launchError=error;});
 for(let i=0;i<32;i++){if(launchError)throw launchError;await new Promise(resolve=>setTimeout(resolve,250));const next=await probe(port);if(next==='game')return {port,url:'http://127.0.0.1:'+port+'/',reused:false};if(next==='other')throw Error('The fixed game port was taken before startup. No other process was stopped.');}
 throw Error('Game startup timed out. See artifacts/runtime/launcher.log.');
}
async function main(args=process.argv.slice(2)){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22 or newer is required.');
 const at=args.indexOf('--port'),port=at<0?DEFAULT_PORT:portNumber(args[at+1]),result=await ensureGameServer({port});console.log((result.reused?'Game already running: ':'Game started: ')+result.url);
 if(!args.includes('--no-open')){
  if(process.platform!=='win32')throw Error('Open '+result.url+' in your browser. Automatic opening is supported on Windows.');
  const target=args.includes('--game')?result.url:result.url;
  const browser=cp.spawn('rundll32.exe',['url.dll,FileProtocolHandler',target],{windowsHide:true,stdio:'ignore'});await new Promise((resolve,reject)=>{browser.once('error',reject);browser.once('close',code=>code===0?resolve():reject(Error('Open '+target+' in your browser.')));});
 }
 return result;
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={portNumber,probe,ensureGameServer,main,DEFAULT_PORT};
