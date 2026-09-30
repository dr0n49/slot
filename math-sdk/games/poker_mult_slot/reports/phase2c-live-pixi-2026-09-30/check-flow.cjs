// Browser evidence against the actual React app. Local RGS routes are mock responses.
const fs=require('fs'),path=require('path');
const runtime='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const root=__dirname,base=process.env.MUERTA_TEST_URL||'http://127.0.0.1:5182';
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
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=await browser.version();
  for(const [label,viewport,params,reduced]of [['desktop',{width:1440,height:900},'',false],['portrait',{width:390,height:844},'',false],['mobile-lite',{width:390,height:844},'&device=mobile',false],['reduced',{width:390,height:844},'',true],['turbo',{width:1440,height:900},'',false]]){
    const o=await open(browser,label,viewport,'&renderer=pixi'+params,reduced),p=o.page;await ready(o);if(label==='turbo')await p.getByRole('button',{name:'Turbo',exact:true}).click();
    const stop=['desktop','portrait'].includes(label)?await record(p,label):null;
    for(const [kind,seed]of [['one-hand',1],['four-hand',6],['skip-four-hand',6]]){
      await p.evaluate(async s=>(await import('/src/game/engine.ts')).reseed(s),seed);await reset(p);await p.getByRole('button',{name:'Spin',exact:true}).click();
      await p.waitForFunction(()=>__events.some(e=>e.event==='landing_settled'));
      if(kind.startsWith('skip')){await p.waitForFunction(()=>!!document.querySelector('.godot-board .cursor-pointer'));await p.keyboard.press('Space')}
      else await p.waitForTimeout(220);
      await p.screenshot({path:root+'/'+label+'-'+kind+'-count.png'});await idle(p);
      const d=await snapshot(p);checkRound(d);report.runs.push({label:label+'-'+kind,...d});console.log(label,kind,d.metrics,d.labels.length);
    }
    if(stop)await stop();if(o.requests.some(u=>u.includes('/godot-slot/')))throw Error('Pixi route loaded Godot');await o.context.close();
  }
  for(const reject of [false,true]){
    const o=await open(browser,'wallet-'+reject,{width:390,height:844},'&renderer=pixi&sessionID=local-proof&rgs_url='+encodeURIComponent(base+'/mock-rgs')),p=o.page;
    await p.route('**/mock-rgs/wallet/**',async route=>{const req=route.request(),endpoint=req.url().split('/').at(-1);report.wallet.push({reject,endpoint,frame:req.frame().url(),body:req.postDataJSON(),at:Date.now()});
      let body={balance:{amount:1000000000,currency:'USD'}};if(endpoint==='authenticate')body.config={defaultBetLevel:1000000,betLevels:[1000000]};
      if(endpoint==='play'){await new Promise(r=>setTimeout(r,1200));if(reject){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{status:'ERR_IPB'}})});return}body={balance:{amount:999000000,currency:'USD'},round:{betID:'local-proof',amount:1000000,payout:1000000,active:true,mode:'base',state:[{type:'win',winX:1}]}}}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});await ready(o);await reset(p);const before=await p.locator('[data-renderer="pixi"]').getAttribute('data-cards');
    const cd=await o.context.newCDPSession(p),frames=[];cd.on('Page.screencastFrame',e=>{cd.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});frames.push({t:e.metadata.timestamp,data:e.data})});await cd.send('Page.startScreencast',{format:'jpeg',quality:90,everyNthFrame:1});await p.waitForTimeout(180);
    const rect=await p.locator('[data-renderer="pixi"] canvas').boundingBox(),origin=await p.evaluate(()=>performance.timeOrigin);await p.getByRole('button',{name:'Spin',exact:true}).click();const press=await p.evaluate(()=>__press);await p.waitForTimeout(750);
    const waiting=await p.evaluate(()=>({events:__events,hud:__hud,state:JSON.parse(document.querySelector('[data-renderer="pixi"]').dataset.landing)}));if(waiting.state.hasTarget||waiting.hud.length||waiting.events.some(e=>['target_received','landing_collision','landing_settled'].includes(e.event)))throw Error('guessed wallet-wait result');
    await p.keyboard.press('Space');await p.waitForTimeout(100);if(await p.evaluate(()=>__events.some(e=>e.event==='landing_settled')))throw Error('target-free skip settled');
    await p.waitForFunction(reject?()=>__events.some(e=>e.event==='travel_rollback'):()=>__events.some(e=>e.event==='landing_settled'),{timeout:30000});await cd.send('Page.stopScreencast');await cd.detach();
    const crop={left:Math.round(rect.x+rect.width*.07),top:Math.round(rect.y+rect.height*.22),width:Math.floor(rect.width*.85),height:Math.floor(rect.height*.56)},raw=f=>sharp(Buffer.from(f.data,'base64')).extract(crop).raw().toBuffer();const baseline=frames.filter(f=>f.t*1000-origin<press).at(-1),b=await raw(baseline);let changed=null;
    for(const f of frames){const ms=f.t*1000-origin-press;if(ms<0)continue;const a=await raw(f);let pixels=0;for(let i=0;i<a.length;i+=3)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>45)pixels++;if(pixels>2000){changed={ms,pixels};break}}
    const after=await p.locator('[data-renderer="pixi"]').getAttribute('data-cards');if(reject&&before!==after)throw Error('wallet rejection rollback mismatch');if(!reject)await idle(p);
    const d=await snapshot(p);if(!reject)checkRound(d);report.runs.push({label:'wallet-'+(reject?'reject':'accepted'),delayMs:1200,firstChangedRaster:changed,latencyGatePassed:!!changed&&changed.ms<=50,waiting,exactRollback:reject?before===after:null,...d});await p.screenshot({path:root+'/wallet-'+reject+'.png'});console.log('wallet',reject,changed);await o.context.close();
  }
  const fallback=await open(browser,'fallback',{width:390,height:844},'&renderer=pixi');await fallback.page.route('**/src/components/PixiSlot.tsx*',route=>route.abort());await ready(fallback);report.fallback={frames:fallback.page.frames().map(f=>f.url()),ready:await fallback.page.locator('iframe').count()===1};if(!report.fallback.ready)throw Error('Pixi chunk failure did not fall back');await fallback.context.close();
  const def=await open(browser,'default',{width:390,height:844});await ready(def);report.default={godot:await def.page.locator('iframe').count()===1,pixiLoaded:def.requests.some(u=>u.includes('/components/PixiSlot'))};if(!report.default.godot||report.default.pixiLoaded)throw Error('default renderer changed');await def.context.close();await browser.close();
  report.status='flow-verified-full-parity-pending';fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.log({runs:report.runs.length,wallet:report.wallet.map(w=>w.endpoint),errors:report.errors,default:report.default,fallback:report.fallback});
})().catch(e=>{report.fatal=String(e);fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.error(e);process.exit(1)});
