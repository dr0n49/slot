// Browser evidence against the actual React app. Local RGS routes are mock responses.
const fs=require('fs'),path=require('path');
const runtime='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const root="/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase2f-presentation-2026-09-30",base=process.env.MUERTA_TEST_URL||'http://127.0.0.1:5182';
const report=JSON.parse(fs.readFileSync(root+"/verification.json"));report.nice=[];
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
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});for(const [label,viewport]of [['desktop',{width:1440,height:900}],['portrait',{width:390,height:844}]]){const o=await open(browser,label,viewport,'&renderer=pixi'),p=o.page;await ready(o);const fixture=await p.evaluate(async()=>{const e=await import('/src/game/engine.ts');for(let seed=1;seed<50000;seed++){e.reseed(seed);const r=e.playRound();if(!r.bonusKind&&r.base.spinWinX>=20&&r.base.spinWinX<=50){e.reseed(seed);return{seed,x:r.base.spinWinX}}}throw Error('no NICE fixture')});await p.evaluate(()=>{window.__nice=[];let last='';function tick(){const e=document.querySelector('.bigwin-overlay'),sig=e?e.dataset.tier+'|'+e.querySelector('.cele-splat')?.innerText:'closed';if(sig!==last){__nice.push({t:performance.now(),sig});last=sig}requestAnimationFrame(tick)}requestAnimationFrame(tick)});const stop=await record(p,label+'-nice');await reset(p);await p.getByRole('button',{name:'Spin',exact:true}).click();await p.locator('.bigwin-overlay').waitFor({timeout:30000});await p.waitForTimeout(800);await p.screenshot({path:root+'/'+label+'-nice.png'});await idle(p);await stop();const d=await snapshot(p);checkRound(d);const steps=await p.evaluate(()=>__nice),first=steps.find(e=>e.sig.startsWith('nice|')),end=steps.filter(e=>e.sig==='closed'&&e.t>first.t).at(-1);report.nice.push({label,fixture,durationMs:end.t-first.t,steps,...d});console.log(label,fixture,end.t-first.t);await o.context.close()}await browser.close();fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2))})().catch(e=>{report.fatal=String(e);fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.error(e);process.exit(1)});