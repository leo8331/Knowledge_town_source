'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../dist/custom-game.html'),'utf8');
const code=html.slice(html.indexOf('function layoutPins(){'),html.indexOf('\nlayoutPins();'));
test('clustered generated regions remain independently clickable on narrow and desktop maps',()=>{
 for(const width of [280,360,590,800,1180]){
  const pins=Array.from({length:12},()=>({style:{}}));const sceneEl={clientWidth:width,clientHeight:760,style:{},querySelectorAll:()=>pins};const tasks=pins.map((_,i)=>({x:20+i%3,y:40+i%2}));
  const context=vm.createContext({sceneEl,tasks,Math,Number});vm.runInContext(code+';layoutPins();',context);
  const diameter=width<600?42:74;
  const rects=pins.map(p=>({x:parseFloat(p.style.left)*width/100,y:parseFloat(p.style.top)*sceneEl.clientHeight/100}));
  for(let i=0;i<rects.length;i++){assert.ok(rects[i].x>diameter/2&&rects[i].x<width-diameter/2);for(let j=0;j<i;j++)assert.ok(Math.abs(rects[i].x-rects[j].x)>diameter||Math.abs(rects[i].y-rects[j].y)>diameter,'overlapping task pins at '+width);}
 }
});
