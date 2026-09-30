// Browser evidence against the actual React app. Local RGS routes are mock responses.
const fs=require('fs'),path=require('path');
const runtime='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const root="/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase2h-reward-closure-2026-09-30",base=process.env.MUERTA_TEST_URL||'http://127.0.0.1:5182';
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

async function watchTotal(p){await p.evaluate(async()=>{
  window.__totalTrace=[];window.__locks=0;const {audio}=await import('/src/game/audio.ts'),lock=audio.playChipLock;audio.playChipLock=()=>{__locks++;lock()};
  let prev='';function tick(){const el=document.querySelector('.total-scrim'),sig=el?el.dataset.resolved+'|'+el.querySelector('.total-win-amount').innerText:'closed';if(sig!==prev){__totalTrace.push({t:performance.now(),sig});prev=sig}requestAnimationFrame(tick)}requestAnimationFrame(tick);
})}
async function geometry(p){return p.evaluate(()=>{
  const hint=document.querySelector('.total-win-cta'),win=document.querySelector('.stage-win .hud-win-copy'),hud=document.querySelector('.hud-bar'),board=document.querySelector('.playfield-board');
  return {hint:hint.getBoundingClientRect().toJSON(),win:win?.getBoundingClientRect().toJSON(),hud:hud.getBoundingClientRect().toJSON(),board:board.getBoundingClientRect().toJSON(),align:getComputedStyle(hint).textAlign};
})}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=await browser.version();
  for(const [label,viewport,turbo]of [['desktop',{width:1440,height:900},false],['portrait',{width:390,height:844},true]]){
    const o=await open(browser,label,viewport,'&renderer=pixi'+(turbo?'&device=mobile':'')+'&sessionID=total-proof&rgs_url='+encodeURIComponent(base+'/mock-rgs')),p=o.page;
    await mockWallet(p,label,100,25);await ready(o);await observeBonus(p);await watchTotal(p);if(turbo)await p.getByRole('button',{name:'Turbo',exact:true}).click();
    await p.getByRole('button',{name:'BONUS',exact:true}).click();await p.locator('.bonus-buy-tile').nth(0).click();await p.locator('.confirm-btn-confirm').click();await p.locator('.cele-overlay-dim').waitFor({timeout:30000});await p.locator('.cele-overlay-dim').click();
    while(!await p.locator('.total-scrim').count()){if(await p.locator('.bigwin-overlay').count()){await p.keyboard.press('Space');await p.waitForTimeout(450)}else await p.waitForTimeout(40)}
    const stop=await record(p,label);
    if(label==='portrait'){await p.waitForTimeout(160);await p.keyboard.press('Space');await p.waitForFunction(()=>document.querySelector('.total-scrim').dataset.resolved==='1');if(await p.locator('.total-win-amount').innerText()!=='100.00')throw Error('skip did not show exact final total');await p.keyboard.press('Space');if(!await p.locator('.total-scrim').count())throw Error('early second Space cut the hold')}
    else{await p.waitForFunction(()=>document.querySelector('.total-scrim').dataset.resolved==='1');await p.locator('.total-scrim').click();if(!await p.locator('.total-scrim').count())throw Error('natural final hold cut short')}
    await p.waitForTimeout(420);await p.screenshot({path:root+'/'+label+'-total-final.png'});const rects=await geometry(p);if(label==='portrait'&&(rects.hint.bottom>rects.win.top-7||rects.hint.bottom>rects.hud.top-7||rects.align!=='center'))throw Error('hint overlaps WIN/HUD or is not centered');
    await p.locator('.total-scrim').click();await idle(p);await stop();const data=await p.evaluate(()=>({trace:__totalTrace,locks:__locks,events:__events,painted:__painted}));checkBoards(data.painted);if(data.locks!==1)throw Error('duplicate/missing total lock');const first=data.trace.find(x=>x.sig.startsWith('0|')),final=data.trace.find(x=>x.sig==='1|100.00'),closed=data.trace.filter(x=>x.sig==='closed'&&x.t>final.t).at(-1);if(label==='desktop'&&(final.t-first.t<1550||final.t-first.t>1680))throw Error('total count is not 1600 ms');if(closed.t-final.t<350)throw Error('resolved hold under 350');
    if(report.wallet.filter(w=>w.label===label&&w.endpoint==='play').length!==1)throw Error('summary input sent paid spin');report.runs.push({label,kind:'real bought BONUS through complete feature',countMs:final.t-first?.t,resolvedHoldMs:closed.t-final.t,rects,...data});console.log(label,{countMs:final.t-first?.t,holdMs:closed.t-final.t,locks:data.locks});await o.context.close();
  }
  for(const [label,reduced,action]of [['reduced',true,'none'],['resize-social',false,'resize'],['background',false,'background']]){
    const o=await open(browser,label,{width:390,height:844},'&renderer=pixi&device=mobile&social=true&lang=uk',reduced),p=o.page;await ready(o);await watchTotal(p);
    await p.evaluate(async()=>{const src=await fetch('/src/components/BonusCompleteOverlay.tsx').then(r=>r.text()),main=await fetch('/src/main.tsx').then(r=>r.text()),ru=src.match(/from "([^"]*deps\/react\.js[^"]*)"/)[1],du=main.match(/from "([^"]*react-dom_client[^"]*)"/)[1];const [react,dom,total,i18n]=await Promise.all([import(ru),import(du),import('/src/components/BonusCompleteOverlay.tsx'),import('/src/i18n/index.ts')]);const el=document.createElement('div');document.body.appendChild(el);const root=(dom.default??dom).createRoot(el);window.__continued=0;root.render((react.default??react).createElement(total.BonusCompleteOverlay,{amount:123.45,copy:i18n.buildCopy('uk',true),onContinue:()=>{__continued++;root.unmount();el.remove()}}))});await p.locator('.total-scrim').waitFor();
    if(action==='resize')await p.setViewportSize({width:391,height:844});if(action==='background')await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForFunction(()=>document.querySelector('.total-scrim').dataset.resolved==='1');if(await p.locator('.total-win-amount').innerText()!=='123.45')throw Error('interruption final amount');await p.keyboard.press('Space');if(!await p.locator('.total-scrim').count())throw Error('interruption cut hold');await p.waitForTimeout(420);await p.screenshot({path:root+'/'+label+'-final.png'});await p.keyboard.press('Space');await p.waitForFunction(()=>__continued===1);const data=await p.evaluate(()=>({trace:__totalTrace,locks:__locks,continued:__continued,events:__events}));if(data.locks!==1||data.events.some(e=>e.event==='target_received'))throw Error('interruption duplicate lock/paid spin');report.runs.push({label,kind:'isolated production summary component interruption audition',...data});console.log(label,data.locks);await o.context.close();
  }
  await browser.close();if(report.errors.length||report.failedAssets.length)throw Error('browser errors');fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));
})().catch(e=>{report.fatal=String(e);fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));console.error(e);process.exit(1)});
