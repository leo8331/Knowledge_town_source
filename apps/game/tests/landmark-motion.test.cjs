'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const motion=require('../src/landmark-motion.js');
test('mapped paint features exist in each learning scene with bounded local water routes',()=>{
 for(const zone of ['grove','harbor','town','observatory']){
  const html=motion.markup(zone);assert.match(html,/viewBox="0 0 1536 1024" preserveAspectRatio="none"/);assert.match(html,/aria-hidden="true" focusable="false"/);assert.ok((html.match(/data-landmark="flowers"/g)||[]).length>=5);assert.match(html,/data-landmark="waterfall"/);
  assert.doesNotMatch(html,/<button|onclick|tabindex|<animate/);assert.ok(html.length<26000);
  for(const m of html.matchAll(/<path d="M([\d.]+) ([\d.]+)Q([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/g)){const n=m.slice(1).map(Number);for(let i=0;i<6;i++)assert.ok(n[i]>=0&&n[i]<=(i%2?1024:1536));}
 }
 assert.equal(motion.markup('winter'),'');assert.equal(motion.markup('unknown'),'');
});
test('wheel rotates only drawn wood and flower edges remain fixed and feathered',()=>{
 const html=motion.markup('grove');const rotor=html.split('class="landmark-wheel-turn"')[1].split('</g></g>')[0];assert.doesNotMatch(rotor,/<image/);assert.match(rotor,/rotate\(330\)/);assert.match(html,/k3="0" k4="0"/,'wood texture must stay transparent outside the rotor');assert.match(html,/clip-path="url\(#lm-front-grove\)"/);
 assert.match(html,/maskUnits="userSpaceOnUse"/);assert.match(html,/<g data-landmark="flowers" mask=/);assert.match(html,/<image class="landmark-flower"/);assert.match(html,/offset="1" stop-color="white" stop-opacity="0"/);
 const css=fs.readFileSync(path.join(__dirname,'../src/landmark-motion.css'),'utf8');assert.match(css,/stroke-dashoffset:-180/);assert.match(css,/rotate\(360deg\)/);assert.match(css,/pointer-events:none/);assert.match(css,/body.dialog-open #landmarkMotion \*,body.away-open #landmarkMotion \*\{animation-play-state:paused!important/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#landmarkMotion\{display:none/);
});
test('actual entry retains one motion layer and scene refresh neither rewrites nodes nor learning state',async()=>{
 const h=await require('../../../tests/town-harness.cjs')(new Map(),{entrySchedule:true});h.run('close()');assert.equal(h.run('typeof TownLandmarkMotion'), 'object');const before=h.run('JSON.stringify(state)');const layer=h.get('landmarkMotion');assert.ok(layer);const nodes=layer.children;h.run("TownLandmarkMotion.render(state.zone,document.getElementById('world'))");assert.equal(layer.children,nodes);assert.equal(h.run('JSON.stringify(state)'),before);
 for(const zone of ['harbor','town','observatory','grove']){h.run(`TownLandmarkMotion.render('${zone}',document.getElementById('world'))`);assert.equal(layer.dataset.zone,zone);assert.equal((layer.innerHTML.match(/class="landmark-motion"/g)||[]).length,1);assert.equal(h.get('world').children.filter(n=>n.id==='landmarkMotion').length,1);}
 assert.equal(h.run('JSON.stringify(state)'),before);
});
