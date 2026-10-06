/* Pure crop classification. Writes QA only; never edits build inputs or masks. */
module.paths.push(require('path').resolve(require('path').dirname(process.execPath),'../node_modules'));
const fs=require('fs'),path=require('path'),sharp=require('sharp');
const {indexMesh,nearestValid}=require('./p3-underpaint-mapping.cjs');
const ROOT=path.resolve(__dirname,'..'),QA=process.env.P3_COVERAGE_QA||path.join(ROOT,'qa/p3-0b'),SRC=path.join(ROOT,'source/p3-0b'),before=process.argv.includes('--baseline'),folder=(before?'before':'after')+(process.argv.includes('--composite')?'-composite':'')+(process.argv.includes('--linear')?'-linear':''),DIR=path.join(QA,folder);
const read=async p=>(await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
async function main(){
 const report=JSON.parse(fs.readFileSync(path.join(DIR,'coverage.json'))),reg=JSON.parse(fs.readFileSync(before?path.join(SRC,'before/layer-registration.json'):path.join(ROOT,'source/layer-registration.json'))),j=JSON.parse(fs.readFileSync(before?path.join(SRC,'before/character-a-p3-setup.json'):path.join(ROOT,'character-a-p3-setup.json'))),parts=JSON.parse(fs.readFileSync(path.join(ROOT,'source/rebuild/slices.json'))).parts,owner=fs.readFileSync(path.join(ROOT,'source/rebuild/ownership.bin')),source=(await read(path.join(ROOT,'source/user-wearability-reference.png'))).data,mats={},reviews={},assignments=[];
 for(const p of reg.parts.filter(p=>p.name.endsWith('_underpaint')))for(const skin of ['default','idle']){
  const a=j.skins.find(s=>s.name===skin).attachments[p.name][p.name],leaf=a.path||p.name;if(mats[leaf])continue;
  const file=before?path.join(SRC,'before',leaf):path.join(ROOT,'layers',leaf+'.png'),im=await read(before?file+'.png':file),material=Buffer.from(im.data),pid=parts.findIndex(x=>x.name===(p.underpaintOf||'chest'));
  for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const sx=x+p.x,sy=y+p.y;if(sx<0||sy<0||sx>=930||sy>=1691)continue;const z=sy*930+sx;if(owner[z]===pid&&source[z*4+3]>=240)source.copy(material,(y*p.w+x)*4,z*4,z*4+4);}
  mats[leaf]={p,...nearestValid(material,p.w,p.h)};
 }
 for(const r of report.records){
  if(r.skin.startsWith('fs'))continue;const maps=JSON.parse(fs.readFileSync(path.join(QA,r.geometry))).filter(g=>mats[g.path]).map(g=>({m:mats[g.path],inverse:indexMesh(g)}));
  for(const c of r.candidates){
   const b=c.bounds,raw=(await read(path.join(QA,c.mask))).data,targets={},covers={};let opaque=0,outside=0;
   for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++)if(raw[(y*b.w+x)*4+3]){
    const choices=[];for(const {m,inverse}of maps){const uv=inverse(b.x+x+.5,b.y+y+.5);if(!uv)continue;const tx=Math.floor(uv[0]),ty=Math.floor(uv[1]);if(tx<0||ty<0||tx>=m.p.w||ty>=m.p.h)continue;const sx=tx+m.p.x,sy=ty+m.p.y,valid=sx>=0&&sy>=0&&sx<930&&sy<1691,z=sy*930+sx,alpha=valid?source[z*4+3]:0;choices.push({m,alpha,cover:valid?(parts[owner[z]]?.slot||parts[owner[z]]?.name||'background'):'background',score:m.dist[ty*m.p.w+tx]+(alpha<200?80:0)});}
    choices.sort((a,b)=>a.score-b.score);const h=choices[0];if(!h){outside++;continue;}if(h.alpha>=200)opaque++;targets[h.m.p.name]=(targets[h.m.p.name]||0)+1;covers[h.cover]=(covers[h.cover]||0)+1;
   }
   const defect=c.type==='internal'||opaque>=Math.max(1,c.area*.25),reason=defect?'Exposed cloth: inverse posed triangles identify '+Object.keys(targets).join(', ')+'; original covering slots: '+Object.keys(covers).join(', ')+'.':'Legitimate exterior concavity: fewer than 25% of inverse samples reach original opaque footprint; silhouette preserved.';
   const v={verdict:defect?'defect':'legitimate',reason};reviews[c.id]=v;reviews[c.id.replace(r.skin+'__',(r.skin==='default'?'fs':'fs_idle')+'__')]=v;Object.assign(c,v);
   assignments.push({candidate:c.id,skin:r.skin,pose:r.id,kind:r.kind,type:c.type,area:c.area,...v,targetPixels:targets,setupOccludingSlots:covers,opaqueOriginalPixels:opaque,outsideMeshPixels:outside});
  }
 }
 for(const r of report.records){for(const c of r.candidates)Object.assign(c,reviews[c.id]);r.edgeDefects=r.candidates.filter(c=>c.type==='edge'&&c.verdict==='defect').length;r.unreviewed=r.candidates.filter(c=>c.verdict==='unreviewed').length;}
 report.summary.workingEdgeDefects=report.records.filter(r=>r.kind==='working').reduce((s,r)=>s+r.edgeDefects,0);report.summary.unreviewed=report.records.filter(r=>r.kind==='working').reduce((s,r)=>s+r.unreviewed,0);report.result=before?'BASELINE_DEFECTS':'PENDING_STRUCTURAL_AUDIT';
 fs.writeFileSync(path.join(DIR,'coverage.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(DIR,'candidate-reviews.json'),JSON.stringify(reviews,null,2)+'\n');fs.writeFileSync(path.join(DIR,'assignments.json'),JSON.stringify(assignments,null,2)+'\n');fs.writeFileSync(path.join(QA,'coverage.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
