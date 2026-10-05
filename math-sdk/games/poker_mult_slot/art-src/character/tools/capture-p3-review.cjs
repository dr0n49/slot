/* Captures our local runtime viewer, never a native Spine Editor window. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),QA=path.join(ROOT,'qa/p3-0-fixed');
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.png':'image/png','.md':'text/plain'};
const server=http.createServer((req,res)=>{let p;try{p=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);res.end();return;}if(!p.startsWith(ROOT+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(p,(err,b)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(err?'Not found':b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.P3_CHROME_PATH?{executablePath:process.env.P3_CHROME_PATH}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1250},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/previews/p3-0.html');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true'||document.documentElement.dataset.error);
  assert.equal(await page.getAttribute('html','data-error'),null);assert.deepEqual(errors,[]);
  const states=[];
  async function capture(source,skin,pose,file){
   await page.selectOption('#source',source);await page.selectOption('#skin',skin);await page.selectOption('#pose',pose);
   const state=await page.evaluate(()=>window.p3Review.draw());assert.equal(state.nonfinite,0);assert.equal(state.glError,0);assert.equal(state.bones,45);assert.equal(state.animations,0);states.push(state);
   await page.screenshot({path:path.join(QA,file),fullPage:true});return file;
  }
  await capture('fixed','default','setup','runtime-skeleton-tree.png');
  await page.locator('#bones').uncheck();await capture('fixed','default','setup','runtime-canvas-default.png');await page.locator('#bones').check();
  for(const pose of['left-45','left-minus45','right-45','right-minus45','left-wrist-45','right-wrist-45','chest-15','chest-minus15'])await capture('fixed','default',pose,'runtime-'+pose+'.png');
  for(const pose of['setup','left-45','left-minus45','right-45','right-minus45'])await capture('fixed','fs',pose,'runtime-fs-'+pose+'.png');
  for(const skin of['idle','fs_idle'])await capture('fixed',skin,'setup','runtime-'+skin+'-setup.png');
  await capture('before','default','setup','runtime-before-setup.png');for(const side of['left','right'])await capture('before','default',side+'-45','runtime-before-'+side+'-45.png');
  async function contact(side){
   const panel=await browser.newPage({viewport:{width:1800,height:1400}});
   const entries=[['P2: setup','runtime-before-setup.png'],['P2: '+side+'_elbow +45°','runtime-before-'+side+'-45.png'],['P3: '+side+'_elbow +45°','runtime-'+side+'-45.png']];
   await panel.setContent('<style>body{margin:0;padding:20px;background:#15171b;color:#eee;font:20px system-ui}h1{margin:0;font-size:28px}p{color:#e5caa2}main{display:flex;gap:12px}article{width:calc(100% / 3)}img{width:100%}h2{font-size:20px}</style><h1>P3-0 · '+side+' · before / after</h1><p>Local runtime viewer — NOT a Spine Editor screenshot. Auto Weight and final clipping review remain pending.</p><main>'+entries.map(([label,f])=>'<article><h2>'+label+'</h2><img src="'+origin+'/qa/p3-0-fixed/'+f+'"></article>').join('')+'</main>');
   await panel.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await panel.screenshot({path:path.join(QA,'runtime-before-after-'+side+'.png'),fullPage:true});await panel.close();
  }
  await contact('left');await contact('right');
  fs.writeFileSync(path.join(QA,'browser-verification.json'),JSON.stringify({method:'Headless Chromium capture of our local runtime viewer; NOT native Editor UI',result:'PASS',states,pageErrors:errors,nativeEditorScreenshot:false,autoWeightPerformed:false},null,2)+'\n');
  console.log(JSON.stringify({result:'PASS',captures:states.length,pageErrors:errors,qa:QA}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
