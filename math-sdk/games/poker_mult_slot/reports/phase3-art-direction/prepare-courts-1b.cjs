// Reuse existing illustrations only. No generation, repaint, tracing or new production assets.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=__dirname,project=path.resolve(root,'../..'),ids=['JS','JH','JD','JC','QS','QH','QD','QC','KS','KH','KD','KC'];
(async()=>{
 const data={date:new Date().toISOString(),exception:'Raster illustration only; approved card frame/indices/pips stay SVG',sets:{},rejectedHistory:[{id:'KH/KD v1',path:'reports/phase2b-courts-2026-09-30/revisions/v1',issue:'Previously rejected by user: excess neck bones. Current sources are corrected.'},{id:'KH alpha-edit',path:'reports/phase2b-courts-2026-09-30/revisions/neck-edit-alpha-defect',issue:'Rejected intermediate alpha defect; never used.'}]};
 for(const set of ['queen-a','earlier']){
  fs.mkdirSync(root+'/review-1b/illustrations/'+set,{recursive:true});data.sets[set]=[];
  for(const id of ids){
   const source=set==='queen-a'?'reports/phase2b-courts-2026-09-30/sources/'+id+'.png':'frontend/public/assets/cards_v2/'+id+'.webp',src=path.join(project,source),m=await sharp(src).metadata();
   const extraction=set==='queen-a'?{left:0,top:0,width:1024,height:1080}:{left:Math.round(m.width*.15),top:Math.round(m.height*.03),width:Math.round(m.width*.7),height:Math.floor(m.height*.94)};
   const dest='review-1b/illustrations/'+set+'/'+id+'.webp';await sharp(src).extract(extraction).webp({lossless:true}).toFile(root+'/'+dest);
   const dm=await sharp(root+'/'+dest).metadata();await sharp(root+'/'+dest).resize({width:256}).webp({lossless:true}).toFile(root+'/review-1b/illustrations/'+set+'/'+id+'-render.webp');
   const notes=set==='earlier'?['Limited source resolution (444×624 full card).','Different clothing and rendering between suits; not one Queen A engraver.','Original centre/paper remains inside figure crop; no retouch or concealment.']:['Visible eyes and teeth inspected in source head sheet; no obvious pseudo-text found.','Fine crown/robe engraving becomes dense at 60×85.','Original alpha/halo is preserved; not silently cleaned.'];
   if(set==='earlier'&&id==='KS')notes.unshift('Watch: collar ornament has glyph-like shapes resembling pseudo-text; inspect original.');if(set==='earlier'&&['JC','KH'].includes(id))notes.unshift('Watch: dense teeth / mouth details break up at final portrait size.');if(set==='earlier'&&id==='QD')notes.unshift('Watch: hand near shoulder has merged fine finger contours.');if(set==='earlier')notes.push('Human Calavera makeup, unlike the fully skeletal Queen A style.');if(set==='queen-a'&&['KH','KD'].includes(id))notes.unshift('Use corrected neck source, not rejected v1.');
   if(set==='queen-a'&&id==='KC')notes.unshift('Watch: moustache overlaps lower mouth detail; inspect full-size face.');
   if(set==='queen-a'&&id==='JH')notes.unshift('Watch: right orbit is denser than left; drawing has a slight head turn.');
   data.sets[set].push({id,source,sourceWidth:m.width,sourceHeight:m.height,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex'),extraction,preview:dest,width:dm.width,height:dm.height,review:notes,flagged:set==='earlier'||['KC','JH'].includes(id)});
   const face=set==='queen-a'?{left:250,top:0,width:524,height:490}:{left:Math.round(m.width*.2),top:Math.round(m.height*.1),width:Math.round(m.width*.6),height:Math.round(m.height*.39)};
   await sharp(src).extract(face).resize({width:320,withoutEnlargement:true}).png().toFile(root+'/review-1b/illustrations/'+set+'/'+id+'-detail.png');
  }
 }
 const src=project+'/reports/phase1-art-anchor-2026-09-30/sources/queen-b-illustration.png';await sharp(src).extract({left:0,top:0,width:1024,height:1080}).webp({lossless:true}).toFile(root+'/review-1b/illustrations/queen-b.webp');
 fs.writeFileSync(root+'/court-review-1b.json',JSON.stringify(data,null,2)+'\n');console.log({sets:2,courts:24,flagged:data.sets['queen-a'].filter(c=>c.flagged).map(c=>c.id)});
})().catch(e=>{console.error(e);process.exitCode=1});
