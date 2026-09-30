// Browser evidence against the actual React app. Local RGS routes are mock responses.
const fs=require('fs'),path=require('path');
const runtime='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const root="/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase2i-anticipation-colour-2026-09-30",base=process.env.MUERTA_TEST_URL||'http://127.0.0.1:5182';
const report={runs:[],wallet:[],errors:[],failedAssets:[]};
const init=()=>{
  window.__events=[];window.__hud=[];window.__frames=[];window.__press=0;window.__played=[];
  document.addEventListener('pixi-landing',e=>__events.push(e.detail));
  document.addEventListener('click',e=>{if(e.target.closest?.('[aria-label="Spin"]'))__press=performance.now()},true);
  let last=performance.now();function tick(t){__frames.push(t-last);last=t;
    const el=[...document.querySelectorAll('.win-plaque-count')].find(e=>e.getBoundingClientRect().width>0);
    if(el&&getComputedStyle(el).opacity>.9)__hud.push({t:performance.now(),text:el.innerText});requestAnimationFrame(tick)}requestAnimationFrame(tick);
  const raw=new WeakMap(),decoded=new WeakMap(),ab=Response.prototype.arrayBuffer,decode=AudioContext.prototype.decodeAudioData,start=AudioBufferSourceNode.prototype.start;
  Response.prototype.arrayBuffer=function(){return ab.call(this).then(b=>{raw.set(b,this.url);return b})};
  AudioContext.prototype.decodeAudioData=function(...args){return decode.apply(this,args).then(b=>{decoded.set(b,raw.get(args[0]));return b})};
  AudioBufferSourceNode.prototype.start=function(...args){__played.push({file:(decoded.get(this.buffer)||'').split('/').pop(),t:performance.now()});return start.apply(this,args)};
};
async function open(browser,label,viewport,params='',reduced=false){
  const context=await browser.newContext({viewport,reducedMotion:reduced?'reduce':'no-preference'});await context.addInitScript(init);
  const page=await context.newPage();const requests=[];page.on('request',r=>requests.push(r.url()));
  page.on('pageerror',e=>report.errors.push({label,error:String(e)}));
  page.on('response',r=>{if(r.status()>=400&&!r.url().includes('/mock-rgs/'))report.failedAssets.push({label,status:r.status(),url:r.url()})});
  return{page,context,label,requests,params};
}
async function ready(o){await o.page.goto(base+'/?sfxlog=1'+o.params);await o.page.locator('.boot-splash.is-ready').waitFor({timeout:60000});await o.page.getByRole('button',{name:'Enter game',exact:true}).click();await o.page.waitForTimeout(250)}
const idle=p=>p.waitForFunction(()=>!document.querySelector('[aria-label="Spin"]').disabled,{timeout:45000});
async function snapshot(p){return p.evaluate(()=>({press:__press,finished:performance.now(),events:__events,hud:__hud,frames:__frames,played:__played,cards:JSON.parse(document.querySelector('[data-renderer="pixi"]').dataset.cards),labels:[...document.querySelectorAll('.win-line-label')].map(e=>e.innerText)}))}
function checkRound(d,snap=false){const target=d.events.find(e=>e.event==='target_received'),settled=d.events.filter(e=>e.event==='landing_settled'),collisions=d.events.filter(e=>e.event==='landing_collision');
  if(!target||settled.length!==1||JSON.stringify(target.cards)!==JSON.stringify(d.cards))throw Error('real target/painted board mismatch');
  if(!snap&&(collisions.length!==5||collisions.some(e=>e.offset!==0)))throw Error('collision count/offset');
  if(d.hud.some(h=>h.t>=d.press&&h.t<settled[0].t))throw Error('HUD before actual settle');
  const f=d.frames.filter(v=>v>0&&v<250).sort((a,b)=>a-b);d.metrics={fps:f.length/f.reduce((a,b)=>a+b,0)*1000,p95Ms:f[Math.ceil(f.length*.95)-1],acceptedToIdleMs:d.finished-d.press};
}
async function record(p,label){const cd=await p.context().newCDPSession(p),dir=root+'/'+label+'-frames';fs.mkdirSync(dir,{recursive:true});const frames=[];let last=0;
  cd.on('Page.screencastFrame',e=>{cd.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});if(e.metadata.timestamp-last<.045)return;last=e.metadata.timestamp;const file=String(frames.length).padStart(5,'0')+'.jpg';fs.writeFileSync(dir+'/'+file,Buffer.from(e.data,'base64'));frames.push({file,t:last})});await cd.send('Page.startScreencast',{format:'jpeg',quality:85,everyNthFrame:1});
  return async()=>{await cd.send('Page.stopScreencast');await cd.detach();fs.writeFileSync(dir+'/frames.json',JSON.stringify(frames))};
}
async function reset(p){await p.evaluate(()=>{__events=[];__hud=[];__frames=[];__played=[]})}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),o=await open(browser,'colour-audit',{width:390,height:844},'&renderer=pixi'),p=o.page;await ready(o);
  await p.evaluate(async()=>{
    const src=await fetch('/src/components/PixiSlot.tsx').then(r=>r.text()),url=[...src.matchAll(/from "([^"]+)"/g)].map(m=>m[1]).find(u=>u.includes('pixi'));window.__pixi=await import(url);window.__changes=[];window.__frameLog=[];
    const descriptor=Object.getOwnPropertyDescriptor(__pixi.Container.prototype,'filters');Object.defineProperty(__pixi.Container.prototype,'filters',{...descriptor,set(value){const card=this.parent,reel=card?.parent;if(card&&reel&&value?.[0])__changes.push({t:performance.now(),active:true,column:Math.round((reel.x-40)/146),joker:this.children.some(c=>c.text==='JOKER'),parentFiltered:!!card.filters,matrix:Array.from(value[0].matrix)});else if(card&&reel&&this.filters?.length)__changes.push({t:performance.now(),active:false,column:Math.round((reel.x-40)/146)});descriptor.set.call(this,value)}});
    let last=performance.now();function tick(t){__frameLog.push({t,dt:t-last});last=t;requestAnimationFrame(tick)}requestAnimationFrame(tick);
    (await import('/src/game/engine.ts')).reseed(86);
  });await reset(p);await p.getByRole('button',{name:'Spin',exact:true}).click();await idle(p);
  const data=await p.evaluate(()=>({changes:__changes,frames:__frameLog,events:__events})),on=data.changes.filter(x=>x.active),off=data.changes.filter(x=>!x.active);fs.writeFileSync(root+'/filter-trace.json',JSON.stringify(data,null,2));if(!on.length||on.some(x=>x.joker||x.parentFiltered)||on.length!==off.length)throw Error('filter applies to Joker/plate or does not restore');
  const pixels=await p.evaluate(async matrix=>{
    const {Application,Graphics,ColorMatrixFilter}=__pixi,app=new Application();await app.init({width:120,height:20,resolution:1,backgroundAlpha:0,preference:'webgl',antialias:false});const filter=new ColorMatrixFilter();filter.matrix=matrix;
    const colours=[0xff0000,0x00ff00,0x0000ff,0xe5d7b3,0x5a1520,0x11100f],g=new Graphics();colours.forEach((color,i)=>g.rect(i*20,0,20,20).fill(color));g.filters=[filter];app.stage.addChild(g);app.render();const {pixels,width}=app.renderer.extract.pixels({target:app.stage}),out=colours.map((colour,i)=>({source:[colour>>16&255,colour>>8&255,colour&255],actual:Array.from(pixels.slice((10*width+i*20+10)*4,(10*width+i*20+10)*4+4))}));app.destroy(true,{children:true});filter.destroy();return out;
  },on[0].matrix);
  for(const patch of pixels){const luma=patch.source[0]*.299+patch.source[1]*.587+patch.source[2]*.114;patch.expected=patch.source.map(c=>Math.round(c*.42+luma*.55*.58));if(patch.actual[3]!==255||patch.expected.some((v,i)=>Math.abs(v-patch.actual[i])>2))throw Error('GPU colour differs from Godot formula')}
  const begin=data.events.find(e=>e.event==='travel_begin').t,end=data.events.find(e=>e.event==='landing_settled').t,f=data.frames.filter(f=>f.t-f.dt>=begin&&f.t<=end).map(f=>f.dt).sort((a,b)=>a-b);const result={filterAssignments:on.length,restorations:off.length,neverJoker:true,neverMultiplierParent:true,pixels,fps:f.length/f.reduce((a,b)=>a+b,0)*1000,p95:f[Math.ceil(f.length*.95)-1],maxFrameMs:Math.max(...f),errors:report.errors,failedAssets:report.failedAssets,trace:data.changes};if(report.errors.length||report.failedAssets.length)throw Error('browser error');fs.writeFileSync(root+'/colour-audit.json',JSON.stringify(result,null,2));console.log(result);await o.context.close();await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
