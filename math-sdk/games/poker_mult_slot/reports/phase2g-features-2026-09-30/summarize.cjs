const fs=require('fs'),path=require('path'),root=__dirname,r=JSON.parse(fs.readFileSync(path.join(root,'verification.json')));
if(r.fatal||r.errors.length||r.failedAssets.length)throw Error('browser/asset/feature failure');
const metrics=r.runs.map(x=>{
  const f=(x.frames||[]).filter(v=>v>0&&v<250).sort((a,b)=>a-b);
  let earlyIncreases=0;const totals=(x.bonus||[]).filter(b=>b.total!=null);
  for(let i=1;i<totals.length;i++)if(parseFloat(totals[i].total)>parseFloat(totals[i-1].total)){
    const target=x.events.filter(e=>e.event==='target_received'&&e.t<=totals[i].t).at(-1),settled=x.events.filter(e=>e.event==='landing_settled'&&e.t<=totals[i].t).at(-1);
    if(target?.rev!==settled?.rev)earlyIncreases++;
  }
  if(earlyIncreases)throw Error(x.label+' HUD increased before real settlement');
  return {label:x.label,mode:x.mode,freeSpins:x.fsTargets,summary:x.summary,paintedBoards:x.painted.length,earlyIncreases,fps:f.length?f.length/f.reduce((a,b)=>a+b,0)*1000:null,p95Ms:f.length?f[Math.ceil(f.length*.95)-1]:null};
});
const result={browser:r.browser,runs:metrics,ordinaryCards:r.coverage.identities.filter(x=>x!=='JOKER').length,joker:r.coverage.identities.includes('JOKER'),coverageRounds:r.coverage.rounds,autoplay:{complete:r.autoplay.complete,stoppedDuring:r.autoplay.stoppedDuring,totalPlays:r.autoplay.totalPlays},errors:r.errors,failedAssets:r.failedAssets,notes:['Real engine boards and existing React orchestration; locally mocked RGS payouts, no real wallet traffic.','Desktop Chrome portrait emulation, not real-phone acceptance.','Known strict 50 ms feedback and anticipation colour parity gates remain open.']};
fs.writeFileSync(path.join(root,'metrics.json'),JSON.stringify(result,null,2));console.log(result);
