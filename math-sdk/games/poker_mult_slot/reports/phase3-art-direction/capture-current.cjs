const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=process.env.MUERTA_URL||'http://127.0.0.1:5186', out=__dirname;
fs.mkdirSync(out+'/screenshots',{recursive:true});
async function snapshot(p,label,state){
  const data=await p.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,text:e.innerText,font:s.fontFamily,fontSize:s.fontSize}};
    const host=document.querySelector('[data-renderer="pixi"]');
    return {viewport:{w:innerWidth,h:innerHeight},cards:JSON.parse(host.dataset.cards),landing:JSON.parse(host.dataset.landing||'null'),events:window.__events,body:document.body.innerText,boxes:Object.fromEntries(['.reel-frame','.slot-game','.game-title','.side-panel-right','.bottom-hud','.hud-inner','.hud-stat','.hud-win','.hud-bet','.hud-spin','.hud-spin-btn','.hud-tools','.hud-bonus-btn','.hud-turbo','.hud-autoplay','.bank-cloud','.bonus-banner'].map(q=>[q,[...document.querySelectorAll(q)].map(box)]))};
  });
  fs.writeFileSync(out+'/screenshots/current-'+label+'-'+state+'.json',JSON.stringify(data,null,2));
  await p.screenshot({path:out+'/screenshots/current-'+label+'-'+state+'.png'});
  console.log('captured',label,state);
}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const [label,viewport]of [['desktop',{width:1920,height:1080}],['portrait',{width:390,height:844}]]){
    const ctx=await browser.newContext({viewport,deviceScaleFactor:1});
    await ctx.addInitScript(()=>{window.__events=[];document.addEventListener('pixi-landing',e=>window.__events.push(e.detail))});
    const p=await ctx.newPage();p.on('pageerror',e=>console.error('pageerror',e));
    await p.goto(base+'/?renderer=pixi&forcebase=1x');await p.waitForLoadState('networkidle');
    await p.locator('.boot-splash.is-ready').waitFor({timeout:60000});await p.getByRole('button',{name:'Enter game',exact:true}).click();await p.waitForTimeout(200);
    console.log((await p.locator('button').allTextContents()).join('|'));
    await snapshot(p,label,'idle');
    await p.evaluate(async()=>{(await import('/src/game/engine.ts')).reseed(17)});
    await p.getByRole('button',{name:'Spin',exact:true}).click();
    await p.waitForFunction(()=>window.__events.some(e=>e.event==='landing_settled'),{timeout:30000});
    await p.waitForTimeout(160);await snapshot(p,label,'win');
    await p.waitForTimeout(1000);
    await p.evaluate(async()=>{(await import('/src/game/engine.ts')).reseed(17);window.__events=[]});
    await p.locator('.hud-bonus-btn').click();await p.locator('.bonus-buy-tile').nth(1).click();await p.locator('.confirm-btn-confirm').click();
    await p.locator('.cele-overlay-dim').waitFor({timeout:30000});await p.locator('.cele-overlay-dim').click();
    await p.waitForFunction(()=>{const fs=window.__events.filter(e=>e.event==='target_received'&&e.freeSpin);return fs.some(e=>window.__events.some(s=>s.event==='landing_settled'&&s.rev===e.rev))},{timeout:30000});
    await p.waitForTimeout(200);await snapshot(p,label,'fs');
    await ctx.close();
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
