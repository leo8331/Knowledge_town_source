/* Sound for the town: a quiet ambient bed and short effects, all synthesized with Web Audio.
   No audio files, no network. Off until the player turns it on (browsers also require a click first).
   The preference lives in its own localStorage key, so saves, backups and old saves are untouched. */
'use strict';
const TownSound=(()=>{
 const KEY='knowledge-town-sound-v1';
 const DEFAULT={on:false,music:0.7,sfx:0.8};
 let prefs=load(),ctx=null,master=null,musicGain=null,sfxGain=null,ambient=null,started=false;
 function load(){try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&typeof v==='object')return {on:v.on===true,music:clamp(v.music,DEFAULT.music),sfx:clamp(v.sfx,DEFAULT.sfx)};}catch{}return {...DEFAULT};}
 function clamp(v,d){return Number.isFinite(v)?Math.min(1,Math.max(0,v)):d;}
 function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}}
 const reduced=()=>{try{return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}};
 const supported=()=>typeof AudioContext!=='undefined'||typeof webkitAudioContext!=='undefined';
 function ensure(){
  if(!supported())return false;
  if(!ctx){
   const C=typeof AudioContext!=='undefined'?AudioContext:webkitAudioContext;
   ctx=new C();master=ctx.createGain();master.gain.value=0.9;master.connect(ctx.destination);
   ctx.onstatechange=()=>paintStatus();
   try{const b=ctx.createBuffer(1,1,22050),src=ctx.createBufferSource();src.buffer=b;src.connect(ctx.destination);src.start(0);}catch{}
   musicGain=ctx.createGain();sfxGain=ctx.createGain();musicGain.connect(master);sfxGain.connect(master);
   apply();
  }
  if(ctx.state==='suspended')ctx.resume?.();
  return true;
 }
 function apply(){if(!ctx)return;const t=ctx.currentTime;musicGain.gain.setTargetAtTime(prefs.on?prefs.music*0.9:0,t,0.4);sfxGain.gain.setTargetAtTime(prefs.on?prefs.sfx*0.7:0,t,0.05);}
 // ---- background music: a small gentle tune that loops, different mood per place ----
 // Everything sits above ~400 Hz on purpose: laptop speakers cannot reproduce low pads.
 const SCALES={major:[0,2,4,7,9],minor:[0,3,5,7,10]};
 const CHORDS={major:[[0,4,7],[-3,0,4],[-7,-3,0],[-5,-1,2]],minor:[[0,3,7],[-4,0,3],[3,7,10],[-2,2,5]]};
 const MOODS={grove:{root:261.63,mode:'major',bpm:76},harbor:{root:293.66,mode:'major',bpm:84},town:{root:246.94,mode:'major',bpm:80},observatory:{root:220,mode:'minor',bpm:64},seaside:{root:277.18,mode:'major',bpm:72},winter:{root:233.08,mode:'minor',bpm:68}};
 const BEATS_PER_BAR=4,BARS_PER_CHORD=2;
 const hz=(root,semi)=>root*Math.pow(2,semi/12);
 function lcg(seed){let a=seed>>>0;return()=>{a=(Math.imul(a,1664525)+1013904223)>>>0;return a/4294967296;};}
 function hashZone(z,n){let h=2166136261;for(const c of String(z)+'|'+n){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function voice(c,dest,f,t,len,peak,type,attack){
  const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=f;
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(peak,0.0002),t+attack);g.gain.exponentialRampToValueAtTime(0.0001,t+len);
  o.connect(g);g.connect(dest);o.start(t);o.stop(t+len+0.05);
 }
 // A soft bell: the note plus a quieter octave above, fast attack, long decay.
 function bell(c,dest,f,t,peak,len=1.7){voice(c,dest,f,t,len,peak,'sine',0.012);voice(c,dest,f*2,t,len*0.55,peak*0.28,'sine',0.008);}
 // Schedules one loop of the tune into `dest` starting at time t0; returns the loop length in seconds.
 function compose(c,dest,t0,zone,loopIndex=0){
  const m=MOODS[zone]||MOODS.grove,rand=lcg(hashZone(zone,loopIndex%2)),beat=60/m.bpm,scale=SCALES[m.mode],prog=CHORDS[m.mode];
  const barLen=beat*BEATS_PER_BAR,chordLen=barLen*BARS_PER_CHORD,total=chordLen*prog.length;
  // pad: each chord as three soft triangle voices plus an octave-up copy, so it is audible on small speakers
  prog.forEach((triad,k)=>{
   const start=t0+k*chordLen;
   triad.forEach(semi=>{
    const f=hz(m.root,semi)*2;
    voice(c,dest,f,start,chordLen+1.2,0.16,'triangle',0.9);
    voice(c,dest,f*2,start,chordLen+1.2,0.07,'sine',1.2);
   });
  });
  // melody: random walk over a pentatonic pool, leaning on chord tones at the start of each bar
  const pool=[];for(const oct of [1,2])scale.forEach(sv=>pool.push({semi:sv+12*oct,cls:sv}));
  let idx=Math.floor(pool.length/2);
  const nearestChordTone=(from,triad)=>{const cls=new Set(triad.map(x=>((x%12)+12)%12));let best=from,d=99;pool.forEach((n,i)=>{if(cls.has(n.cls)&&Math.abs(i-from)<d){d=Math.abs(i-from);best=i;}});return best;};
  const beats=prog.length*BARS_PER_CHORD*BEATS_PER_BAR;
  for(let b=0;b<beats;b++){
   const bar=Math.floor(b/BEATS_PER_BAR),chord=prog[Math.floor(bar/BARS_PER_CHORD)],onBar=b%BEATS_PER_BAR===0;
   const play=onBar||rand()<0.62;
   if(play){
    idx=onBar?nearestChordTone(idx,chord):Math.max(0,Math.min(pool.length-1,idx+[-2,-1,-1,0,1,1,2][Math.floor(rand()*7)]));
    const vel=onBar?0.5:0.3+rand()*0.2;
    bell(c,dest,hz(m.root,pool[idx].semi)*2,t0+b*beat,vel*0.8);
   }
   if(rand()<0.22){idx=Math.max(0,Math.min(pool.length-1,idx+(rand()<0.5?-1:1)));bell(c,dest,hz(m.root,pool[idx].semi)*2,t0+b*beat+beat/2,0.2,1.2);}
  }
  return total;
 }
 function startAmbient(zone){
  if(!ensure()||!prefs.on)return;
  stopAmbient();
  const me={zone,buses:[],timer:null,next:ctx.currentTime+0.15,loop:0};ambient=me;
  const run=()=>{
   if(ambient!==me||!ctx)return;
   const bus=ctx.createGain();bus.gain.value=me.loop===0?0.0001:1;bus.connect(musicGain);
   if(me.loop===0)bus.gain.linearRampToValueAtTime(1,me.next+1.5);
   const len=compose(ctx,bus,me.next,zone,me.loop);
   me.buses.push({bus,end:me.next+len+3});me.loop++;
   const wait=Math.max(500,(me.next+len-ctx.currentTime-2.5)*1000);me.next+=len;
   // forget loops that have fully played
   me.buses=me.buses.filter(x=>{if(x.end<ctx.currentTime){try{x.bus.disconnect();}catch{}return false;}return true;});
   me.timer=setTimeout(run,wait);
  };
  run();
 }
 function stopAmbient(){
  if(!ambient||!ctx)return;
  const me=ambient,t=ctx.currentTime;ambient=null;clearTimeout(me.timer);
  for(const {bus} of me.buses){try{bus.gain.cancelScheduledValues(t);bus.gain.setTargetAtTime(0,t,0.15);}catch{}}
  setTimeout(()=>me.buses.forEach(x=>{try{x.bus.disconnect();}catch{}}),1500);
 }
 // ---- effects ----
 function tone(freq,start,dur,{type='sine',gain=0.5,glide=0}={}){
  const t=ctx.currentTime+start,o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t);if(glide)o.frequency.exponentialRampToValueAtTime(freq*glide,t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(sfxGain);o.start(t);o.stop(t+dur+0.05);
 }
 const SFX={
  tap:()=>tone(660,0,0.09,{gain:0.4}),
  soft:()=>{tone(300,0,0.22,{type:'triangle',gain:0.3,glide:0.8});},
  good:()=>{tone(523.25,0,0.12);tone(659.25,0.09,0.16);},
  drawer:()=>{tone(180,0,0.18,{type:'triangle',gain:0.3,glide:0.7});tone(240,0.12,0.12,{type:'triangle',gain:0.2});},
  key:()=>{[1318.5,1568,1976].forEach((f,i)=>tone(f,i*0.07,0.2,{gain:0.22}));},
  chest:()=>{tone(130,0,0.2,{type:'triangle',gain:0.4});tone(98,0.08,0.3,{type:'triangle',gain:0.35});tone(880,0.2,0.2,{gain:0.2});},
  unlock:()=>{[523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(f,i*0.1,0.3,{gain:0.3}));},
  win:()=>{[523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>tone(f,i*0.09,0.4,{gain:0.3}));tone(261.63,0,0.9,{type:'triangle',gain:0.2});},
  seed:()=>{tone(880,0,0.12,{gain:0.35,glide:1.4});tone(1174.7,0.08,0.16,{gain:0.3});},
  step:()=>tone(500,0,0.08,{type:'triangle',gain:0.3})
 };
 function play(name){
  try{if(!prefs.on||!ensure())return;(SFX[name]||SFX.tap)();}catch{}
 }
 function set(patch){
  prefs={...prefs,...patch};prefs.music=clamp(prefs.music,DEFAULT.music);prefs.sfx=clamp(prefs.sfx,DEFAULT.sfx);persist();
  if(prefs.on){if(ensure()){apply();if(!ambient)startAmbient(currentZone());}}else{apply();stopAmbient();}
  refresh();
 }
 const currentZone=()=>{try{return document.body.classList.contains('away-open')&&typeof activeAwayScene==='string'&&activeAwayScene?activeAwayScene:(typeof state==='object'&&state.zone)||'default';}catch{return 'default';}};
 function onZoneChange(){if(!prefs.on||!ctx)return;const z=currentZone();if(ambient&&ambient.zone===z)return;startAmbient(z);}
 function toggle(){set({on:!prefs.on});return prefs.on;}
 // ---- what the player needs to know when nothing is heard ----
 function statusInfo(){
  if(!supported())return {ok:false,zh:'这个浏览器不支持网页声音，请换用较新的 Chrome 或 Edge。',en:'This browser does not support web audio. Please use a current Chrome or Edge.'};
  if(!prefs.on)return {ok:false,zh:'声音目前是关闭的。勾选上面的“开启声音”，或直接点“试听”。',en:'Sound is off. Tick “Turn sound on” above, or press Listen.'};
  if(!ctx)return {ok:false,zh:'声音引擎还没启动。点一下“试听”。',en:'The audio engine has not started yet. Press Listen.'};
  if(ctx.state!=='running')return {ok:false,zh:'浏览器把声音暂停了（状态：'+ctx.state+'）。点一下“试听”把它唤醒。',en:'The browser paused audio (state: '+ctx.state+'). Press Listen to wake it.'};
  return {ok:true,zh:'声音引擎正在运行。如果仍然听不到：看看浏览器标签页上有没有被静音的小喇叭图标，再检查系统音量，以及耳机/音箱有没有选对。',en:'The audio engine is running. If you still hear nothing, check for a muted speaker icon on the browser tab, the system volume, and that the right headphones or speakers are selected.'};
 }
 function paintStatus(){
  if(typeof document==='undefined')return;
  const el=document.getElementById('soundStatus');if(!el)return;
  const i=statusInfo();el.innerHTML=TownKit.t(i.zh,i.en);el.classList.toggle('ok',i.ok);
 }
 function listen(){
  if(!prefs.on)set({on:true});else{ensure();apply();if(!ambient)startAmbient(currentZone());}
  const box=document.getElementById('soundOn');if(box)box.checked=true;
  play('win');setTimeout(paintStatus,350);
 }
 // ---- header control ----
 function label(on){const zh=on?'声音：开':'声音：关',en=on?'Sound: on':'Sound: off';return TownKit.plain(zh,en);}
 function refresh(){
  const b=typeof document!=='undefined'?document.getElementById('soundToggle'):null;if(!b)return;
  b.textContent=TownKit.lang()==='en'?(prefs.on?'Sound: on':'Sound: off'):(prefs.on?'声音：开':'声音：关');
  b.setAttribute('aria-pressed',String(prefs.on));b.setAttribute('aria-label',label(prefs.on));b.title=label(prefs.on);
  b.classList.toggle('on',prefs.on);
 }
 function panel(){
  const old=document.getElementById('soundPanel');if(old){old.remove();return;}
  const p=document.createElement('div');p.id='soundPanel';p.className='sound-panel';p.setAttribute('data-locale-fixed','true');
  const T=TownKit;
  p.innerHTML=`<strong>${T.t('声音','Sound')}</strong><label class="sound-row"><input type="checkbox" id="soundOn" ${prefs.on?'checked':''}> ${T.t('开启声音','Turn sound on')}</label><label class="sound-row">${T.t('背景音乐','Music')}<input type="range" id="soundMusic" min="0" max="100" value="${Math.round(prefs.music*100)}" aria-label="${T.safe(T.plain('背景音乐音量','Music volume'))}"></label><label class="sound-row">${T.t('点击音效','Effects')}<input type="range" id="soundSfx" min="0" max="100" value="${Math.round(prefs.sfx*100)}" aria-label="${T.safe(T.plain('音效音量','Effects volume'))}"></label><button id="soundTest" class="primary">${T.t('试听','Listen')}</button><p id="soundStatus" class="sound-status" role="status"></p><small>${T.t('全部由浏览器现场合成，不下载文件。默认关闭。','Everything is synthesized in your browser. No files are downloaded. Off by default.')}</small>`;
  document.body.appendChild(p);
  document.getElementById('soundOn').onchange=e=>set({on:e.target.checked});
  document.getElementById('soundMusic').oninput=e=>{prefs.music=clamp(+e.target.value/100,DEFAULT.music);persist();apply();};
  document.getElementById('soundSfx').oninput=e=>{prefs.sfx=clamp(+e.target.value/100,DEFAULT.sfx);persist();apply();};
  document.getElementById('soundSfx').onchange=()=>play('good');
  document.getElementById('soundTest').onclick=listen;
  paintStatus();
 }
 function install(){
  if(typeof document==='undefined')return;
  wireClicks();
  const nav=document.querySelector?.('header nav');if(!nav||document.getElementById('soundToggle'))return;
  const b=document.createElement('button');b.id='soundToggle';b.setAttribute('data-locale-fixed','true');b.onclick=()=>{if(!supported()){toast(TownKit.plain('这个浏览器不支持声音。','This browser does not support audio.'));return;}panel();};
  nav.appendChild(b);refresh();
  if(prefs.on){
   // Browsers only start audio after a click. Wait for the first one, then resume where the player left off.
   const resume=()=>{document.removeEventListener('pointerdown',resume);document.removeEventListener('keydown',resume);if(prefs.on&&!started){started=true;if(ensure()){apply();startAmbient(currentZone());}}};
   document.addEventListener('pointerdown',resume);document.addEventListener('keydown',resume);
  }
 }
// Every button gives a soft click so the world answers you. Panels that play their own cue mark themselves.
 let wired=false;
 function wireClicks(){
  if(wired||typeof document==='undefined')return;wired=true;
  document.addEventListener('click',e=>{
   if(!prefs.on)return;
   try{ensure();if(ctx&&ctx.state==='running'&&!ambient)startAmbient(currentZone());}catch{}
   const t=e.target;if(!t||typeof t.closest!=='function')return;
   const b=t.closest('button');if(!b||b.id==='soundToggle'||b.closest('#soundPanel'))return;
   if(b.closest('.escape-row,.escape-opts,.escape-slots,.escape-tiles'))return;
   if(b.classList.contains('study-fruit')||b.dataset.studyFruit)return play('seed');
   if(b.classList.contains('escape-prop'))return play('step');
   play('tap');
  },true);
 }
 const enabled=()=>prefs.on;
 return {play,toggle,set,panel,install,refresh,onZoneChange,enabled,status:statusInfo,compose,moods:()=>Object.keys(MOODS),prefs:()=>({...prefs}),stopAmbient,reduced};
})();
if(typeof module==='object')module.exports=TownSound;
