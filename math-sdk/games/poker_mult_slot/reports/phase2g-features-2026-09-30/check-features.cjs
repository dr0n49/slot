// Browser evidence against the actual React app. Local RGS routes are mock responses.
const fs=require('fs'),path=require('path');
const runtime='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const root="/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase2g-features-2026-09-30",base=process.env.MUERTA_TEST_URL||'http://127.0.0.1:5182';
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

async function observeBonus(p){await p.evaluate(async()=>{
  const {LINES}=await import('/src/game/engine.ts');window.__painted=[];window.__bonus=[];
  document.addEventListener('pixi-landing',e=>{if(e.detail.event==='landing_settled'){
    const host=document.querySelector('[data-renderer="pixi"]'),target=__events.filter(e=>e.event==='target_received'&&e.rev===Number(host.dataset.settledRev)).at(-1),actual=JSON.parse(host.dataset.cards);
    __painted.push({t:performance.now(),rev:e.detail.rev,equal:JSON.stringify(actual)===JSON.stringify(target.cards),jokerMultiplier:target.cards.some((c,i)=>c.golden&&target.multipliers[i]>0),jokerLine:target.lines.some(l=>LINES[l.id].some(i=>target.cards[i].golden)),target});
  }});
  let prev='';function tick(){const bank=document.querySelector('.bank-cloud-value')?.innerText,total=document.querySelector('.hud-win-total .hud-win-amount')?.innerText,spins=document.querySelector('.spins-remaining')?.innerText,summary=document.querySelector('.total-win-amount')?.innerText;
    const sig=JSON.stringify({bank,total,spins,summary});if(sig!==prev){__bonus.push({t:performance.now(),bank,total,spins,summary});prev=sig}requestAnimationFrame(tick)}requestAnimationFrame(tick);
})}
async function mockWallet(p,label,payout,cost){await p.route('**/mock-rgs/wallet/**',async route=>{
  const req=route.request(),endpoint=req.url().split('/').at(-1);report.wallet.push({label,endpoint,frame:req.frame().url(),body:req.postDataJSON(),at:Date.now()});
  let body={balance:{amount:Math.round((1000-cost+payout)*1e6),currency:'USD'}};
  if(endpoint==='authenticate')body={balance:{amount:1000e6,currency:'USD'},config:{defaultBetLevel:1e6,betLevels:[1e6]}};
  if(endpoint==='play'){await new Promise(r=>setTimeout(r,1200));body={balance:{amount:Math.round((1000-cost)*1e6),currency:'USD'},round:{betID:label,amount:1e6,payout:Math.round(payout*1e6),active:true,mode:req.postDataJSON().mode,state:[{type:'win',winX:payout}]}}}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
})}
function checkBoards(boards){if(!boards.length||boards.some(p=>!p.equal||p.jokerMultiplier||p.jokerLine))throw Error('painted board/Joker contract')}
async function finishBonus(p){const start=Date.now();let skipped=0;while(Date.now()-start<120000){if(await p.locator('.total-scrim').count())break;
  const big=p.locator('.bigwin-overlay');if(await big.count()){await p.keyboard.press('Space');skipped++;await p.waitForTimeout(500)}else await p.waitForTimeout(80)}
  await p.locator('.total-scrim').waitFor({timeout:10000});await p.waitForTimeout(1900);return skipped;
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=await browser.version();
  for(const [kind,index,cost,payout,label,viewport,turbo]of [['bonus',0,25,100,'desktop',{width:1440,height:900},false],['job',1,35,120,'portrait',{width:390,height:844},true],['flush',2,190,500,'mobile-lite',{width:390,height:844},true]]){
    const o=await open(browser,label,viewport,'&renderer=pixi'+(label==='mobile-lite'?'&device=mobile':'')+'&sessionID=feature-proof&rgs_url='+encodeURIComponent(base+'/mock-rgs')),p=o.page;
    await mockWallet(p,kind,payout,cost);await ready(o);await observeBonus(p);if(turbo)await p.getByRole('button',{name:'Turbo',exact:true}).click();await reset(p);
    const stop=['desktop','portrait'].includes(label)?await record(p,label):null;await p.getByRole('button',{name:'BONUS',exact:true}).click();await p.locator('.bonus-buy-tile').nth(index).click();await p.locator('.confirm-btn-confirm').click();
    await p.locator('.cele-overlay-dim').waitFor({timeout:30000});const trigger=await p.evaluate(()=>__events.find(e=>e.event==='target_received'));if(trigger.cards.filter(c=>c.golden).length!==index+3)throw Error('trigger Joker count');await p.screenshot({path:root+'/'+kind+'-trigger.png'});await p.locator('.cele-overlay-dim').click();
    const skipped=await finishBonus(p);await p.screenshot({path:root+'/'+kind+'-total.png'});const data=await p.evaluate(()=>({events:__events,painted:__painted,bonus:__bonus,frames:__frames,summary:document.querySelector('.total-win-amount')?.innerText,balance:document.querySelector('.hud-meter-value')?.innerText}));fs.writeFileSync(root+'/'+kind+'-raw.json',JSON.stringify(data,null,2));checkBoards(data.painted);
    if(data.bonus.find(b=>b.bank)?.bank!=='×3')throw Error('FS does not open with bank ×3');if(Number(data.summary.replace(/[^0-9.-]/g,''))!==payout)throw Error('booked summary mismatch');
    const fsTargets=data.events.filter(e=>e.event==='target_received').length-1;if(fsTargets<10)throw Error('incomplete FS');const totals=data.bonus.filter(b=>b.total!=null).map(b=>Number(b.total.replace(/[^0-9.-]/g,'')));if(totals.some((v,i)=>i&&v<totals[i-1]))throw Error('cumulative FS total decreased');
    const wallet=report.wallet.filter(w=>w.label===kind);if(wallet.filter(w=>w.endpoint==='play').length!==1||wallet.filter(w=>w.endpoint==='end-round').length!==1||wallet.some(w=>w.frame.includes('/godot-slot/')))throw Error('wallet owner/duplicate play');if(wallet.find(w=>w.endpoint==='play').body.mode!==['bonus','bonus_job','bonus_flush'][index])throw Error('buy mode mismatch');
    await p.locator('.total-scrim').click();await idle(p);if(stop)await stop();report.runs.push({label:'buy-'+kind,mode:wallet.find(w=>w.endpoint==='play').body.mode,cost,payout,fsTargets,skipped,...data});fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.log('completed',kind,{fsTargets,skipped,summary:data.summary});await o.context.close();
  }
  for(const [kind,index,cost,mode]of [['job',0,5,'ante_job'],['flush',1,15,'ante_flush']]){
    const o=await open(browser,'ante-'+kind,{width:390,height:844},'&renderer=pixi&sessionID=feature-proof&rgs_url='+encodeURIComponent(base+'/mock-rgs')),p=o.page;await mockWallet(p,'ante-'+kind,1,cost);await ready(o);await observeBonus(p);await p.getByRole('button',{name:'BONUS',exact:true}).click();await p.locator('.ante-candy-btn').nth(index).click();await p.locator('.confirm-btn-confirm').click();await reset(p);await p.getByRole('button',{name:'Spin',exact:true}).click();await idle(p);const data=await p.evaluate(()=>({events:__events,painted:__painted,stake:document.querySelector('.hud-stake .hud-meter-value')?.innerText}));checkBoards(data.painted);const wallet=report.wallet.filter(w=>w.label==='ante-'+kind);if(wallet.find(w=>w.endpoint==='play')?.body.mode!==mode||Number(data.stake)!==cost)throw Error('ante mode/stake mismatch');report.runs.push({label:'ante-'+kind,...data});console.log('ante',kind,data.stake);await o.context.close();
  }
  const o=await open(browser,'coverage-social',{width:390,height:844},'&renderer=pixi&device=mobile&social=true'),p=o.page;await ready(o);await observeBonus(p);await p.getByRole('button',{name:'Turbo',exact:true}).click();
  const seeds=await p.evaluate(async()=>{const e=await import('/src/game/engine.ts'),chosen=[];for(let seed=1;chosen.length<30;seed++){e.reseed(seed);const r=e.playRound();if(!r.bonusKind&&r.base.spinWinX<20)chosen.push(seed)}return chosen});const identities=new Set();
  for(const seed of seeds){await p.evaluate(async s=>(await import('/src/game/engine.ts')).reseed(s),seed);await p.getByRole('button',{name:'Spin',exact:true}).click();await idle(p);const cards=await p.evaluate(()=>JSON.parse(document.querySelector('[data-renderer="pixi"]').dataset.cards));cards.forEach(c=>identities.add(c.golden?'JOKER':c.rank+c.suit))}
  const boards=await p.evaluate(()=>__painted);checkBoards(boards);const ordinary=[...identities].filter(id=>id!=='JOKER');if(ordinary.length!==52)throw Error('not all 52 identities covered');report.coverage={identities:[...identities].sort(),rounds:seeds.length,seeds,boards};
  await p.getByRole('button',{name:'AUTO',exact:true}).click();report.autoPanel=await p.locator('body').innerText();await p.screenshot({path:root+'/social-autoplay-panel.png'});console.log('all 52 covered; autoplay panel opened');await o.context.close();
  const a=await open(browser,'autoplay',{width:390,height:844},'&renderer=pixi&device=mobile&social=true&sessionID=feature-proof&rgs_url='+encodeURIComponent(base+'/mock-rgs')),ap=a.page;await mockWallet(ap,'autoplay',1,1);await ready(a);await observeBonus(ap);await ap.getByRole('button',{name:'Turbo',exact:true}).click();
  const startAuto=async()=>{await ap.getByRole('button',{name:'AUTO',exact:true}).click();await ap.getByRole('button',{name:'10',exact:true}).click();await ap.locator('.confirm-btn-confirm').click();await ap.getByRole('button',{name:'Stop autoplay',exact:true}).waitFor()};
  await startAuto();await ap.getByRole('button',{name:'Spin',exact:true}).waitFor({timeout:90000});await idle(ap);let plays=report.wallet.filter(w=>w.label==='autoplay'&&w.endpoint==='play');if(plays.length!==10)throw Error('autoplay did not play exactly 10 rounds');checkBoards(await ap.evaluate(()=>__painted));
  await startAuto();while(report.wallet.filter(w=>w.label==='autoplay'&&w.endpoint==='play').length<13)await ap.waitForTimeout(50);await ap.getByRole('button',{name:'Stop autoplay',exact:true}).click();await idle(ap);await ap.waitForTimeout(1800);plays=report.wallet.filter(w=>w.label==='autoplay'&&w.endpoint==='play');if(plays.length!==13)throw Error('stop autoplay sent another round');const painted=await ap.evaluate(()=>__painted);checkBoards(painted);if(painted.length!==13)throw Error('autoplay stop did not resolve the in-flight round');report.autoplay={complete:10,stoppedDuring:3,totalPlays:plays.length,painted};await ap.screenshot({path:root+'/autoplay-stopped.png'});console.log('autoplay completed 10; stop resolved third round without another play');await a.context.close();
  await browser.close();fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));
})().catch(e=>{report.fatal=String(e);fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.error(e);process.exit(1)});
