// Review proofs only: no wallet calls and no production code imports.
const fs=require('node:fs'),assert=require('node:assert/strict');
const deps='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(deps+'playwright'),sharp=require(deps+'sharp');
const {oldU,newU}=require('./review-ui-1d.cjs');
const root=__dirname,out=root+'/review-1d',qa=out+'/qa',base='http://127.0.0.1:5192/reports/phase3-art-direction/';
const manifest=JSON.parse(fs.readFileSync(out+'/manifest.json')),assets=JSON.parse(fs.readFileSync(out+'/asset-manifest.json'));
fs.mkdirSync(qa,{recursive:true});let liveBrowser;
async function pixels(file,region){let s=sharp(file);if(region)s=s.extract(region);const {data,info}=await s.removeAlpha().raw().toBuffer({resolveWithObject:true});
 let sum=0,sq=0,linear=0;const hist=Array(256).fill(0),e=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 for(let i=0;i<data.length;i+=info.channels){const r=data[i],g=data[i+1],b=data[i+2],y=.2126*r+.7152*g+.0722*b;sum+=y;sq+=y*y;linear+=.2126*e(r/255)+.7152*e(g/255)+.0722*e(b/255);hist[Math.round(y)]++}
 const n=info.width*info.height,mean=sum/n;let count=0,p95=0;for(;p95<255;p95++){count+=hist[p95];if(count>=n*.95)break}return {mean,linear:linear/n,p95,rms:Math.sqrt(Math.max(0,sq/n-mean*mean)),pixels:n};}
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
async function proof(page,file,w,h){await page.setViewportSize({width:w,height:h});await page.goto(base+'review-1d/'+file,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>{const s=document.createElementNS('http://www.w3.org/2000/svg','style');s.textContent='*{animation-play-state:paused!important}';document.documentElement.append(s)});await page.screenshot({path:qa+'/'+file.replace('.svg','.png')});}
async function main(){const browser=liveBrowser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
 const checks=[],clearance=[],backgrounds=[],stake=[];
 for(const entry of manifest.screens){const m=entry.profile==='portrait';await proof(page,entry.file,m?390:1920,m?844:1080);
  const d=JSON.parse(fs.readFileSync(out+'/'+entry.fixture));const dom=await page.evaluate(()=>{const box=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}};return {
   labels:[...document.querySelectorAll('.hand-label')].map(g=>[...g.querySelectorAll('text')].map(e=>{const b=e.getBBox();return {text:e.textContent,y:b.y,h:b.height,stroke:parseFloat(getComputedStyle(e).strokeWidth)||0}})),
   cards:[...document.querySelectorAll('[data-card-index]')].map(e=>({rank:e.dataset.rank,suit:e.dataset.suit,golden:e.dataset.golden==='true'})),
   texts:[...document.querySelectorAll('text')].map(e=>e.textContent),
   header:[...document.querySelectorAll('[data-hand-pays-header]')].map(e=>({text:e.textContent,font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,tracking:getComputedStyle(e).letterSpacing})),
   jokers:[...document.querySelectorAll('[data-joker]')].map(e=>({variant:e.dataset.joker,texts:e.querySelectorAll('text').length,pips:e.querySelectorAll('[data-pip]').length,indices:e.dataset.noIndices})),
   frame:{count:document.querySelectorAll('[data-frame]').length,corners:document.querySelectorAll('[data-frame] [data-carved-corner]').length,images:document.querySelectorAll('[data-frame] image').length},
   layers:[...document.querySelectorAll('[data-layer]')].map(e=>({name:e.dataset.layer,depth:e.dataset.depth})),
   banks:[...document.querySelectorAll('[data-bank-panel]')].map(e=>box(e.querySelector('path'))),numbers:[...document.querySelectorAll('[data-bank-number]')].map(e=>({text:e.textContent,font:parseFloat(getComputedStyle(e).fontSize)})),
   logo:document.querySelector('[data-logo]')?box(document.querySelector('[data-logo]')):null,
   flags:document.querySelectorAll('[data-flat-flag]').length,petals:document.querySelectorAll('.petal-drift').length,
  }});
  assert.deepEqual(dom.cards,d.cards.map(c=>({rank:String(c.rank||''),suit:String(c.suit||''),golden:!!c.golden})),entry.file+': exact settled cards');
  assert(dom.texts.includes(m?(entry.state==='fs'?'TOTAL WIN ':'WIN ')+d.amount:d.amount)||entry.state==='idle',entry.file+': same final WIN');
  assert.deepEqual(dom.frame,{count:1,corners:4,images:0},'Vector restored frame');assert.deepEqual(dom.layers,[{name:'far',depth:'2'},{name:'middle',depth:'4'},{name:'front',depth:'6'}]);
  assert.equal(dom.header.length,m?0:1);if(!m){assert.equal(dom.header[0].text,'HAND PAYS');assert.equal(dom.header[0].font,'Oswald');assert.equal(dom.header[0].tracking,'2.3px')}
  assert.equal(dom.jokers.length,d.cards.filter(c=>c.golden).length);for(const j of dom.jokers){assert.equal(j.texts,0);assert.equal(j.pips,0);assert.equal(j.indices,'true');assert.equal(j.variant,entry.joker)}
  const gaps=[];for(const [i,[title,cash]]of dom.labels.entries()){assert.equal(cash.text,d.target.lines[i].win_x.toFixed(2));const gap=cash.y-cash.stroke/2-(title.y+title.h+title.stroke/2);assert(gap>=2,entry.file+': hand name and amount separated');gaps.push({hand:title.text,amount:cash.text,gap})}
  if(entry.state==='fs'){assert.deepEqual(dom.numbers.map(n=>n.text),['×3','9']);assert(dom.numbers.every(n=>n.font>=50));const b=assets.variants.FS.principal,principal={x:b.left,y:b.top,w:b.width,h:b.height};
   if(!m){for(const bank of dom.banks)assert(!overlap(bank,principal),entry.file+': bank clear of graves');assert(!overlap(principal,{x:610,y:0,w:700,h:954}));assert(!overlap(principal,{x:0,y:955,w:1920,h:125}));
    if(entry.joker==='A')clearance.push({profile:entry.profile,layout:entry.layout,gap:principal.y-Math.max(...dom.banks.map(b=>b.y+b.h)),principal,bankRects:dom.banks,nonOverlap:true});
   }else {assert.equal(dom.banks.length,2);assert(dom.banks[0].x<3&&dom.banks[1].x>247);assert(dom.banks.every(b=>b.y+b.h<83));if(entry.joker==='A')clearance.push({profile:entry.profile,layout:entry.layout,gap:null,principalOutsideCrop:true,bankRects:dom.banks,nonOverlap:true});}
  }else if(!m){const b=assets.variants[entry.background].principal,principal={x:b.left,y:b.top,w:b.width,h:b.height};if(dom.logo)assert(!overlap(dom.logo,principal),entry.file+': logo clear of ofrenda');}
  const raw=fs.readFileSync(out+'/'+entry.file,'utf8');if(entry.state!=='fs'){assert.equal(raw.split(newU).length-1,3);assert.equal(raw.split(oldU).length-1,0)}
  checks.push({...entry,finalWin:d.amount,exact25Cards:true,labelGaps:gaps,frame:dom.frame,header:dom.header,flags:dom.flags,petals:dom.petals});
 }
 for(const p of manifest.native){await proof(page,p.file,p.w,p.h);const geometry=await page.evaluate(()=>({w:innerWidth,h:innerHeight,text:[...document.querySelectorAll('text')].map(e=>e.textContent)}));assert.equal(geometry.w,p.w);assert.equal(geometry.h,p.h);if(p.id!=='QH')assert.equal(geometry.text.length,0)}
 for(const [file,w,h]of [['logo-B-corrected.svg',900,420],['logo-B-header-132.svg',152,75],...manifest.ui.map(e=>[e.file,e.file.startsWith('frame')?(e.profile==='portrait'?390:700):(e.profile==='portrait'?390:610),e.file.startsWith('frame')?(e.profile==='portrait'?555:954):(e.profile==='portrait'?140:710)])])await proof(page,file,w,h);
 const approved=JSON.parse(fs.readFileSync(root+'/review-1b/brightness.json')).backgrounds.filter(b=>b.variant==='A');
 for(const e of manifest.backgrounds){const m=e.profile==='portrait';await proof(page,e.file,m?390:1920,m?844:1080);const stats=await pixels(qa+'/'+e.file.replace('.svg','.png')),threshold=approved.find(a=>a.profile===e.profile).mean;
  const region=m?{left:21,top:122,width:348,height:478}:{left:652,top:52,width:616,height:849},board=await pixels(qa+`/base-${e.variant}-${e.profile}-win.png`,region);
  const result={profile:e.profile,variant:e.variant,...stats,approved1b:threshold,delta:stats.mean-threshold,board,boardRegion:region,stakeThreshold:null};backgrounds.push(result);console.log('brightness',JSON.stringify(result));
  assert(stats.mean>=threshold,e.file+': >= approved Stage 1b purple dusk');assert(board.p95>stats.p95,e.file+': board strongest light mass');assert(board.rms>stats.rms,e.file+': board higher RMS contrast');
 }
 for(const v of ['A','B'])for(const format of ['3x4','9x16']){const file=`layers/${v}/stake-${format}.webp`,md=await sharp(out+'/'+file).metadata();assert.equal(md.width/md.height,format==='3x4'?.75:.5625);stake.push({variant:v,format,size:[md.width,md.height],...await pixels(out+'/'+file),stakeThreshold:null})}
 const alpha=[];for(const s of assets.sources.filter(s=>s.alpha)){const {data,info}=await sharp(out+'/'+s.file).ensureAlpha().raw().toBuffer({resolveWithObject:true});let zero=0,semi=0;for(let i=3;i<data.length;i+=info.channels){if(data[i]===0)zero++;else if(data[i]<255)semi++}assert(zero>info.width*info.height*.02,s.id+': actual transparent cutout');alpha.push({id:s.id,transparent:zero/(info.width*info.height),semi:semi/(info.width*info.height)})}
 const result={scope:'Stage 1d review only; no Stage 2/live changes',backgrounds,clearance,stake,checks,alpha,fixtureFinalWins:{base:'1.00',fsCumulative:'3.00'},nativeSizeProofs:6,staticCandles:true,frameCandidates:1,generatedAt:new Date().toISOString()};
 fs.writeFileSync(out+'/verification.json',JSON.stringify(result,null,2)+'\n');
 await page.setViewportSize({width:390,height:844});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'index.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>document.getElementById('brightness').textContent.includes('Y′'));assert.equal(await page.locator('button[data-item]').count(),6);
 await page.locator('[data-profile="portrait"]').click();await page.waitForFunction(()=>document.getElementById('proposal').contentDocument?.documentElement.getAttribute('width')==='390');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Review page fits phone');
 const native=await page.locator('.native-strip img').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));assert.deepEqual(native.map(n=>n.w),[86,86,86,60,60,60]);
 for(let i=1;i<=6;i++){await page.locator(`[data-item="${i}"]`).click();assert.equal(await page.locator('[data-section]:not(.hidden)').count(),1)}
 await page.locator('[data-item="1"]').click();await page.locator('[data-joker="B"]').click();await page.waitForFunction(()=>document.getElementById('proposal').contentDocument?.querySelector('[data-joker]')?.getAttribute('data-joker')==='B');
 await page.locator('[data-mode="reduced"]').click();let animations=await page.locator('#proposal').evaluate(e=>[...e.contentDocument.querySelectorAll('.flag-sway,.petal-drift')].filter(n=>getComputedStyle(n).animationName!=='none').length);assert.equal(animations,0,'Preview reduced motion');
 await page.locator('[data-mode="lite"]').click();const lite=await page.locator('#proposal').evaluate(e=>[...e.contentDocument.querySelectorAll('.petal-drift')].filter(n=>getComputedStyle(n).display!=='none').length);assert.equal(lite,2);assert.equal(await page.locator('#parallax').isDisabled(),true);
 await page.locator('[data-mode="full"]').click();await page.locator('#parallax').fill('1');const shifted=await page.locator('#proposal').evaluate(e=>e.contentDocument.querySelector('[data-depth="4"]').style.transform);assert.equal(shifted,'translate(4px, 2px)');
 await page.locator('[data-mode="reduced"]').click();await page.screenshot({path:qa+'/review-page-portrait.png',fullPage:true});await page.locator('[data-item="5"]').click();await page.locator('[data-background="B"]').click();await page.waitForFunction(()=>document.getElementById('proposal').contentDocument?.querySelector('[data-card-index]')&&document.getElementById('proposal').src.includes('base-B-portrait-win'));
 await page.locator('[data-layer="middle"]').click();assert((await page.locator('#layer-image').getAttribute('src')).includes('portrait-middle.webp'));
 await page.setViewportSize({width:1440,height:1000});await page.locator('[data-profile="desktop"]').click();await page.locator('[data-item="2"]').click();await page.locator('[data-layout="B"]').click();await page.waitForFunction(()=>document.getElementById('proposal').src.includes('fs-B-B-desktop'));await page.screenshot({path:qa+'/review-page-desktop.png',fullPage:true});assert.deepEqual(errors,[],'Review no JS errors');
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto(base+'review-1d/base-A-portrait-win.svg',{waitUntil:'networkidle'});animations=await page.locator('.flag-sway,.petal-drift').evaluateAll(es=>es.filter(n=>getComputedStyle(n).animationName!=='none').length);assert.equal(animations,0,'OS reduced motion');
 Object.assign(result,{mobilePageFits:true,reviewTabs:6,nativeDisplayedAtExactSize:true,osReducedMotion:true,litePetals:2,parallaxDisabledInLite:true,reviewErrors:errors});fs.writeFileSync(out+'/verification.json',JSON.stringify(result,null,2)+'\n');
 await browser.close();liveBrowser=null;console.log(JSON.stringify({screens:checks.length,nativeProofs:6,backgrounds:backgrounds.map(b=>({variant:b.variant,profile:b.profile,mean:b.mean,approved1b:b.approved1b,rms:b.rms,boardRms:b.board.rms})),clearance,mobilePageFits:true,reducedMotion:true,litePetals:2},null,2));
}
main().catch(async e=>{console.error(e);await liveBrowser?.close();process.exitCode=1});
