// Real React/Pixi flow, local intercepted wallet only. Measure captured pixels,
// not JavaScript dispatch or background animation. All trials remain in report.
const fs=require('fs'),runtime='/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/';
const {chromium}=require(runtime+'playwright'),sharp=require(runtime+'sharp');
const root=__dirname,base=process.env.MUERTA_TEST_URL||'http://127.0.0.1:5182',recording=process.env.MUERTA_RECORD==='1',report={trials:[],wallet:[],errors:[],failedAssets:[]};
const init=()=>{window.__events=[];window.__press=0;window.__hud=[];
  document.addEventListener('pixi-landing',e=>__events.push(e.detail));
  document.addEventListener('click',e=>{if(e.target.closest?.('[aria-label="Spin"]'))__press=performance.now()},true);
  function sample(){const e=[...document.querySelectorAll('.win-plaque-count')].find(e=>e.getBoundingClientRect().width>0);if(e)__hud.push({t:performance.now(),text:e.innerText});requestAnimationFrame(sample)}requestAnimationFrame(sample);
};
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});report.browser=await browser.version();
  for(const [label,viewport,params]of [['desktop',{width:1440,height:900},''],['portrait',{width:390,height:844},''],['mobile-lite',{width:390,height:844},'&device=mobile']]){
    if(recording&&label==='mobile-lite')continue;
    const ctx=await browser.newContext({viewport});await ctx.addInitScript(init);const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push({label,error:String(e)}));p.on('response',r=>{if(r.status()>=400&&!r.url().includes('/mock-rgs/'))report.failedAssets.push({label,status:r.status(),url:r.url()})});let reject=false;
    await p.route('**/mock-rgs/wallet/**',async route=>{const req=route.request(),endpoint=req.url().split('/').at(-1);report.wallet.push({label,reject,endpoint,frame:req.frame().url(),at:Date.now()});let body={balance:{amount:1000000000,currency:'USD'}};
      if(endpoint==='authenticate')body.config={defaultBetLevel:1000000,betLevels:[1000000]};
      if(endpoint==='play'){await new Promise(r=>setTimeout(r,1200));if(reject){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:{status:'ERR_IPB'}})});return}body={balance:{amount:999000000,currency:'USD'},round:{betID:'local-latency',amount:1000000,payout:1000000,active:true,mode:'base',state:[{type:'win',winX:1}]}}}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})});
    for(let trial=0;trial<(recording?1:4);trial++){reject=trial%2===1;
      await p.goto(base+'/?renderer=pixi&sessionID=local-latency&rgs_url='+encodeURIComponent(base+'/mock-rgs')+params);await p.locator('.boot-splash.is-ready').waitFor({timeout:60000});await p.getByRole('button',{name:'Enter game',exact:true}).click();await p.waitForTimeout(400);
      const before=await p.locator('[data-renderer="pixi"]').getAttribute('data-cards'),rect=await p.locator('[data-renderer="pixi"] canvas').boundingBox(),origin=await p.evaluate(()=>performance.timeOrigin);
      const cd=await ctx.newCDPSession(p),frames=[];cd.on('Page.screencastFrame',e=>{cd.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});frames.push({t:e.metadata.timestamp,data:e.data})});await cd.send('Page.startScreencast',{format:'jpeg',quality:90,everyNthFrame:1});await p.waitForTimeout(180);
      await p.evaluate(()=>{__events=[];__hud=[]});await p.getByRole('button',{name:'Spin',exact:true}).click();const press=await p.evaluate(()=>__press);await p.waitForTimeout(650);
      const waiting=await p.evaluate(()=>({events:__events,state:JSON.parse(document.querySelector('[data-renderer="pixi"]').dataset.landing),hud:__hud}));
      if(waiting.state.hasTarget||waiting.events.some(e=>['target_received','landing_collision','landing_settled'].includes(e.event))||waiting.hud.some(h=>Number(h.text.replace(/[^\d.]/g,''))>0))throw Error('guessed waiting result');
      await p.keyboard.press('Space');await p.waitForTimeout(100);if(await p.evaluate(()=>__events.some(e=>e.event==='landing_settled')))throw Error('target-free skip');
      await p.waitForFunction(reject?()=>__events.some(e=>e.event==='travel_rollback'):()=>__events.some(e=>e.event==='landing_settled'),{timeout:30000});await cd.send('Page.stopScreencast');await cd.detach();
      if(recording){const dir=root+'/'+label+'-frames';fs.mkdirSync(dir,{recursive:true});const manifest=frames.map((f,i)=>{const file=String(i).padStart(5,'0')+'.jpg';fs.writeFileSync(dir+'/'+file,Buffer.from(f.data,'base64'));return{file,t:f.t}});fs.writeFileSync(dir+'/frames.json',JSON.stringify(manifest))}
      const crop={left:Math.round(rect.x+rect.width*.07),top:Math.round(rect.y+rect.height*.22),width:Math.floor(rect.width*.85),height:Math.floor(rect.height*.56)},raw=f=>sharp(Buffer.from(f.data,'base64')).extract(crop).raw().toBuffer();
      const baseline=frames.filter(f=>f.t*1000-origin<press).at(-1);if(!baseline)throw Error('no pre-press raster');const b=await raw(baseline);let changed=null;const samples=[];
      for(const f of frames){const ms=f.t*1000-origin-press;if(ms<0)continue;const a=await raw(f);let pixels=0;for(let i=0;i<a.length;i+=3)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>45)pixels++;if(ms<160)samples.push({ms,pixels});if(!changed&&pixels>2000){changed={ms,pixels};fs.writeFileSync(root+'/'+label+'-'+(recording?'record-':'')+trial+'-first.jpg',Buffer.from(f.data,'base64'))}}
      const after=await p.locator('[data-renderer="pixi"]').getAttribute('data-cards'),events=await p.evaluate(()=>__events);
      if(reject&&before!==after)throw Error('rollback changed actual board');if(!reject){const target=events.find(e=>e.event==='target_received'),settles=events.filter(e=>e.event==='landing_settled');if(!target||settles.length!==1||JSON.stringify(target.cards)!==after)throw Error('actual result mismatch')}
      const result={label,trial,reject,walletDelayMs:1200,firstChangedRaster:changed,passed:!!changed&&changed.ms<=50,clickToTravelMs:events.find(e=>e.event==='travel_begin').t-press,earlySamples:samples,exactRollback:reject?before===after:null,events};report.trials.push(result);console.log(label,trial,reject,changed,result.passed);
    }await ctx.close();
  }await browser.close();report.passed=report.trials.every(t=>t.passed)&&!report.errors.length&&!report.failedAssets.length;fs.writeFileSync(root+'/'+(recording?'recording-verification.json':'verification.json'),JSON.stringify(report,null,2));console.log({passed:report.passed,trials:report.trials.length,maxMs:Math.max(...report.trials.map(t=>t.firstChangedRaster?.ms??Infinity)),errors:report.errors,failedAssets:report.failedAssets});
})().catch(e=>{report.fatal=String(e);fs.writeFileSync(root+'/'+(recording?'recording-verification.json':'verification.json'),JSON.stringify(report,null,2));console.error(e);process.exit(1)});
