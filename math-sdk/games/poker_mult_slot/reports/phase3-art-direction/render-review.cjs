const fs=require('node:fs');
const {chromium}=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=__dirname;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}), page=await browser.newPage();
 const checks={errors:[],consoleErrors:[],missing:[],screens:[],ui:[],studies:[]};page.on('pageerror',e=>checks.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')checks.consoleErrors.push(m.text())});page.on('response',r=>{if(r.status()>=400)checks.missing.push({url:r.url(),status:r.status()})});
 for(const profile of ['desktop','portrait'])for(const state of ['idle','win','fs']){
  const width=profile==='desktop'?1920:390,height=profile==='desktop'?1080:844,file=`proposed-${profile}-${state}`;
  await page.setViewportSize({width,height});await page.goto('file://'+root+'/mockups/'+file+'.svg');await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:root+'/mockups/'+file+'.png'});const geometry=await page.evaluate(()=>({emptyPaths:[...document.querySelectorAll('path')].filter(p=>p.getTotalLength()===0).map(p=>p.getAttribute('d')),fontReady:document.fonts.check('400 29px Barrio')&&document.fonts.check('600 24px Oswald')}));checks.screens.push({profile,state,width,height,rasterInsert:false,...geometry});
 }
 for(const [w,h]of [[86,121],[60,85]])for(const id of ['ace','queen','reaper']){await page.setViewportSize({width:w,height:h});await page.goto('file://'+root+`/mockups/study-${id}-${w}x${h}.svg`);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:root+`/mockups/study-${id}-${w}x${h}.png`});checks.studies.push({id,w,h});}
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:5190/phase3-art-direction/index.html');await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
 checks.ui.push({allPairs:await page.locator('.compare').count(),images:await page.locator('.screen').count(),swatches:await page.locator('.swatch').count(),materials:await page.locator('.material').count()});
 await page.screenshot({path:root+'/page-desktop.png',fullPage:true});await page.screenshot({path:root+'/page-cover.png'});
 await page.getByRole('button',{name:'390×844',exact:true}).click();checks.ui.push({portraitVisible:await page.locator('.compare:visible').count()});
 await page.locator('.portrait [data-native]').nth(1).click();checks.ui.push({nativeDialog:await page.locator('dialog').evaluate(e=>e.open)});await page.keyboard.press('Escape');
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5190/phase3-art-direction/index.html');await page.waitForLoadState('networkidle');checks.ui.push({pageWidth:await page.evaluate(()=>document.documentElement.scrollWidth),viewport:390});await page.screenshot({path:root+'/page-portrait.png',fullPage:true});
 for(const profile of ['desktop','portrait'])for(const state of ['idle','win','fs']){const svg=fs.readFileSync(root+`/mockups/proposed-${profile}-${state}.svg`,'utf8');if(/<image\b|data:image|<filter\b|feGaussianBlur|<pattern\b/.test(svg))throw Error('forbidden insert or effect');}
 await browser.close();fs.writeFileSync(root+'/review-verification.json',JSON.stringify(checks,null,2)+'\n');console.log(checks);
 if(checks.errors.length||checks.consoleErrors.length||checks.missing.length||checks.screens.some(s=>s.emptyPaths.length||!s.fontReady))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
