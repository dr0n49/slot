// Browser proofs and geometry checks for review items 8 / 9, outside production.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const deps = '/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const { chromium } = require(deps+'playwright');
const sharp = require(deps+'sharp');
const root = __dirname, out = root+'/review-1c', qa = out+'/qa';
const base = 'http://127.0.0.1:5192/reports/phase3-art-direction/';
let liveBrowser;
fs.mkdirSync(qa, { recursive: true });
async function pixels(file, region) {
  let s=sharp(file); if(region)s=s.extract(region);
  const {data,info}=await s.removeAlpha().raw().toBuffer({resolveWithObject:true});
  let y=0,lin=0;const histogram=Array(256).fill(0);const e=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
  for(let i=0;i<data.length;i+=info.channels){const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255,l=.2126*r+.7152*g+.0722*b;y+=l;lin+=.2126*e(r)+.7152*e(g)+.0722*e(b);histogram[Math.round(l*255)]++}
  const n=info.width*info.height;let count=0,p95=0;for(;p95<255;p95++){count+=histogram[p95];if(count>=n*.95)break}return {mean:y/n*255,linear:lin/n,p95};
}
async function main(){
 const browser=liveBrowser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const checks=[], backgrounds=[];
 const proofs=[['ofrenda-detail',600,954],['logo-A',900,420],['logo-B',900,420],['stake-A-3x4',1200,1600],['stake-A-9x16',1080,1920]];
 for(const p of ['desktop','portrait']){
   const [w,h]=p==='desktop'?[1920,1080]:[390,844];
   for(const v of ['A','B'])for(const st of ['win','fs'])proofs.push([`context-${v}-${p}-${st}`,w,h]);
   proofs.push([`background-${p}`,w,h]);
 }
 for(const [name,width,height]of proofs){
   await page.setViewportSize({width,height});await page.goto(base+`review-1c/${name}.svg`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   // Capture a repeatable final frame, without changing the actual preview animation.
   await page.evaluate(()=>{const s=document.createElementNS('http://www.w3.org/2000/svg','style');s.textContent='*{animation-play-state:paused!important}';document.documentElement.append(s)});
   await page.screenshot({path:qa+'/'+name+'.png'});
   if(name.startsWith('context-')){
     const geometry=await page.evaluate(()=>({
       labels:[...document.querySelectorAll('.hand-label')].map(g=>{const t=[...g.querySelectorAll('text')];return t.map(e=>{const b=e.getBBox();return {text:e.textContent,y:b.y,h:b.height,stroke:parseFloat(getComputedStyle(e).strokeWidth)||0}})}),
       candleAnimations:[...document.querySelectorAll('[data-static-candle], [data-static-candle] *')].filter(e=>getComputedStyle(e).animationName!=='none').length,
       ofrenda:document.querySelectorAll('[data-ofrenda]').length,
       flags:document.querySelectorAll('[data-flat-flag]').length,
       logo:document.querySelector('[data-logo]')?.getAttribute('data-logo')||null,
       cards:[...document.querySelectorAll('[data-card-index]')].map(e=>({rank:e.getAttribute('data-rank'),suit:e.getAttribute('data-suit'),golden:e.getAttribute('data-golden')==='true'})),
       texts:[...document.querySelectorAll('text')].map(e=>e.textContent),
     }));
     const [,v,profile,state]=name.split('-'),d=JSON.parse(fs.readFileSync(root+`/review-1b/current-${profile}-${state}.json`));
     assert.deepEqual(geometry.cards,d.cards.map(c=>({rank:String(c.rank||''),suit:String(c.suit||''),golden:!!c.golden})),name+': exact real 25-card outcome');
     assert(geometry.texts.includes(profile==='portrait'?(state==='fs'?'TOTAL WIN ':'WIN ')+d.amount:d.amount),name+': settled final HUD win');
     assert.equal(geometry.candleAnimations,0,name+': static candles');assert.equal(geometry.ofrenda,1,name+': ofrenda');
     for(const [i,ts] of geometry.labels.entries()){assert.equal(ts.length,2);const [title,cash]=ts;assert.equal(cash.text,d.target.lines[i].win_x.toFixed(2),name+': same real line win');const gap=cash.y-cash.stroke/2-(title.y+title.h+title.stroke/2);assert(gap>=2,name+': title and amount must be separate');checks.push({name,title:title.text,amount:cash.text,gap});}
     checks.push({name,staticCandles:true,flags:geometry.flags,ofrenda:geometry.ofrenda});
   }
 }
 for(const profile of ['desktop','portrait']){
   const mobile=profile==='portrait';const image=qa+`/background-${profile}.png`;
   const clean=await pixels(image),current=await pixels(root+`/review-1b/current-background-${profile}.png`);
   const boardRegion=mobile?{left:21,top:123,width:348,height:478}:{left:652,top:53,width:616,height:849};
   // Same comparison regions used at the 1b gate, rather than selecting a new dark patch.
   const surroundingRegion=mobile?{left:0,top:42,width:390,height:38}:{left:480,top:270,width:110,height:450};
   const boardMean=await pixels(qa+`/context-A-${profile}-win.png`,boardRegion),surround=await pixels(image,surroundingRegion);
   assert(clean.mean>=current.mean,'Background must not be darker than current game');
   assert(boardMean.p95>clean.p95,'Board remains the strongest light mass');
   backgrounds.push({profile,...clean,current:current.mean,contrast:(boardMean.linear+.05)/(surround.linear+.05),boardP95:boardMean.p95,boardP95AboveScene:true,boardRegion,surroundingRegion,stakeThreshold:null});
 }
 const stake=[];for(const format of ['3x4','9x16'])stake.push({format,...await pixels(qa+`/stake-A-${format}.png`),stakeThreshold:null});
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'index.html',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('[data-item]').count(),2,'Only review items 8 / 9');
 await page.locator('[data-profile="portrait"]').click();await page.locator('#context').evaluate(e=>e.decode());
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Review page fits 390 px');
 await page.locator('[data-item="9"]').click();await page.locator('[data-logo="B"]').click();await page.locator('#context').evaluate(e=>e.decode());
 assert((await page.locator('#context').getAttribute('src')).includes('context-B-portrait-win'),'Logo selection');
 await page.screenshot({path:qa+'/review-page-portrait.png',fullPage:true});
 await page.locator('[data-mode="reduced"]').click();await page.locator('#context').evaluate(e=>e.decode());
 const rm = await page.evaluate(async()=>{const src=document.getElementById('context').src;return (await (await fetch(src)).text()).includes('class="reduced"')});assert(rm,'Reduced mode preview');
 await page.goto(base+'review-1c/context-A-portrait-win.svg',{waitUntil:'networkidle'});await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.flag-sway, .petal-drift').evaluateAll(es=>es.filter(e=>getComputedStyle(e).animationName!=='none').length),0,'OS reduced motion');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(base+'review-1c/context-A-portrait-win-lite.svg',{waitUntil:'networkidle'});
 const liteVisible=await page.locator('.petal-drift').evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').length);assert.equal(liteVisible,2,'Lite petals');
 const result={scope:'8 / 9 only; renderer and wallet unchanged',backgrounds,stake,checks,reviewOnlyTwoItems:true,mobilePageFits:true,osReducedMotion:true,litePetals:liteVisible,fixtureFinalWins:{base:1,fsCumulative:3},generatedAt:new Date().toISOString()};
 fs.writeFileSync(out+'/verification.json',JSON.stringify(result,null,2)+'\n');
 await browser.close();liveBrowser=null;console.log(JSON.stringify({backgrounds,geometryChecks:checks.length,mobilePageFits:true,reducedMotion:true,litePetals:liteVisible},null,2));
}
main().catch(async e=>{console.error(e);await liveBrowser?.close();process.exitCode=1});
