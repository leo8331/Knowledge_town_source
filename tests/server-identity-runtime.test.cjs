'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {gameIdentity}=require('../apps/server/identity.cjs');
test('saved question banks, generated images and private hot-read config do not invalidate loaded server identity',t=>{
 const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'town-identity-'));
 t.after(()=>{if(path.dirname(root)!==parent||!path.basename(root).startsWith('town-identity-'))throw Error('Unsafe fixture cleanup');fs.rmSync(root,{recursive:true,force:true});});
 for(const d of ['dist/knowledge/library','dist/generated-scenes','apps/server'])fs.mkdirSync(path.join(root,d),{recursive:true});
 fs.writeFileSync(path.join(root,'dist/index.html'),'runtime');fs.writeFileSync(path.join(root,'apps/server/index.cjs'),'server1');fs.writeFileSync(path.join(root,'dist/knowledge/server.cjs'),'knowledge1');
 const initial=gameIdentity(root);
 for(const file of ['dist/knowledge/.model-config.json','dist/knowledge/.search-config.json','dist/knowledge/library/test.json','dist/generated-scenes/test.png']){fs.writeFileSync(path.join(root,file),'local-data');assert.deepEqual(gameIdentity(root),initial,file);}
 fs.writeFileSync(path.join(root,'dist/knowledge/server.cjs'),'knowledge2');assert.notEqual(gameIdentity(root).buildId,initial.buildId,'question service code is runtime code');
 fs.writeFileSync(path.join(root,'dist/knowledge/server.cjs'),'knowledge1');fs.writeFileSync(path.join(root,'apps/server/index.cjs'),'server2');assert.notEqual(gameIdentity(root).buildId,initial.buildId,'loaded main server code must change identity');
});
