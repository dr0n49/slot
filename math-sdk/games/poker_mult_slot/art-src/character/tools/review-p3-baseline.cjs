/* Read-only baseline classification with original registrations and textures. */
module.paths.push(require('path').resolve(require('path').dirname(process.execPath),'../node_modules'));
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {indexMesh,nearestValid}=require('./p3-underpaint-mapping.cjs');
const ROOT=path.resolve(__dirname,'..'),QA=path.join(ROOT,'qa/p3-0b'),DIR=path.join(QA,'before-composite'+(process.argv.includes('--linear')?'-linear':'')),SRC=path.join(ROOT,'source/p3-0b');
const read=async p=>(await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
async function main(){
 const report=JSON.parse(fs.readFileSync(path.join(DIR,'coverage.json'))),reg=JSON.parse(fs.readFileSync(path.join(SRC,'before/layer-registration.json'))),parts=JSON.parse(fs.readFileSync(path.join(ROOT,'source/rebuild/slices.json'))).parts,owner=fs.readFileSync(path.join(ROOT,'source/rebuild/ownership.bin')),source=(await read(path.join(ROOT,'source/user-wearability-reference.png'))).data,mats={},reviews={},assignments=[];
 for(const p of reg.parts.filter(p=>p.name.endsWith('_underpaint'))){
  const im=await read(path.join(SRC,'before/underpaint',p.name+'.png'));
  const material=Buffer.from(im.data),pid=parts.findIndex(x=>x.name===(p.underpaintOf||'chest'));
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const sx=x+p.x,sy=y+p.y;if(sx<0||sy<0||sx>=930||sy>=1691)continue;const j=sy*930+sx;if(owner[j]===pid&&source[j*4+3]>=240)source.copy(material,(y*p.w+x)*4,j*4,j*4+4);}
  mats['underpaint/'+p.name]={p,...nearestValid(material,p.w,p.h)};
 }
 for(const r of report.records){
  if(r.skin.startsWith('fs'))continue;
  const maps=JSON.parse(fs.readFileSync(path.join(QA,r.geometry))).filter(g=>mats[g.path]).map(g=>({m:mats[g.path],inverse:indexMesh(g)}));
  for(const c of r.candidates){
   const b=c.bounds,raw=(await read(path.join(QA,c.mask))).data,targets={},covers={};let opaque=0,outside=0;
   for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++)if(raw[(y*b.w+x)*4+3]){
    const choices=[];
    for(const {m,inverse}of maps){const uv=inverse(b.x+x+.5,b.y+y+.5);if(!uv)continue;const tx=Math.floor(uv[0]),ty=Math.floor(uv[1]);if(tx<0||ty<0||tx>=m.p.w||ty>=m.p.h)continue;const sx=tx+m.p.x,sy=ty+m.p.y,valid=sx>=0&&sy>=0&&sx<930&&sy<1691,j=sy*930+sx,alpha=valid?source[j*4+3]:0;choices.push({m,alpha,cover:valid?(parts[owner[j]]?.slot||parts[owner[j]]?.name||'background'):'background',score:m.dist[ty*m.p.w+tx]+(alpha<200?80:0)});}
    choices.sort((a,b)=>a.score-b.score);const h=choices[0];if(!h){outside++;continue;}if(h.alpha>=200)opaque++;targets[h.m.p.name]=(targets[h.m.p.name]||0)+1;covers[h.cover]=(covers[h.cover]||0)+1;
   }
   const defect=c.type==='internal'||opaque>=Math.max(1,c.area*.25),reason=defect?'Exposed cloth in accepted baseline; inverse posed triangles identify '+Object.keys(targets).join(', ')+'; original covering slots: '+Object.keys(covers).join(', ')+'.':'Exterior concavity: fewer than 25% of inverse samples reach original opaque footprint; preserved as legitimate silhouette.';
   const v={verdict:defect?'defect':'legitimate',reason};reviews[c.id]=v;reviews[c.id.replace(r.skin+'__',(r.skin==='default'?'fs':'fs_idle')+'__')]=v;Object.assign(c,v);
   assignments.push({candidate:c.id,skin:r.skin,pose:r.id,kind:r.kind,type:c.type,area:c.area,...v,targetPixels:targets,setupOccludingSlots:covers,opaqueOriginalPixels:opaque,outsideMeshPixels:outside});
  }
 }
 for(const r of report.records){for(const c of r.candidates)Object.assign(c,reviews[c.id]);r.edgeDefects=r.candidates.filter(c=>c.type==='edge'&&c.verdict==='defect').length;r.unreviewed=r.candidates.filter(c=>c.verdict==='unreviewed').length;}
 report.summary.workingEdgeDefects=report.records.filter(r=>r.kind==='working').reduce((s,r)=>s+r.edgeDefects,0);report.summary.unreviewed=report.records.filter(r=>r.kind==='working').reduce((s,r)=>s+r.unreviewed,0);report.result='BASELINE_DEFECTS';
 fs.writeFileSync(path.join(DIR,'coverage.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(DIR,'candidate-reviews.json'),JSON.stringify(reviews,null,2)+'\n');fs.writeFileSync(path.join(SRC,'before-composite'+(process.argv.includes('--linear')?'-linear':'')+'-assignments.json'),JSON.stringify(assignments,null,2)+'\n');
 console.log(JSON.stringify(report.summary));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
