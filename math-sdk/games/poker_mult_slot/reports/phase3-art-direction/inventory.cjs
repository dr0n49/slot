const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const sharp=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../..'),gitRoot=cp.execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8'}).trim();
const groups=[
 ['anchor','reports/phase1-art-anchor-2026-09-30','Queen A approved; Queen B reference only. Reaper remains standalone.'],
 ['courts','reports/phase2b-courts-2026-09-30','12 courts approved after KH/KD neck correction. Not installed.'],
 ['aces','reports/phase2b-aces-2026-09-30','Four aces without oval approved by continuation. Not installed.'],
 ['back','reports/phase2b-card-back-2026-09-30','Revised two-scythe card back approved. Not installed.'],
 ['frame','reports/phase2b-frame-2026-09-30','Nine-slice frame pending previous approval. Not installed.'],
 ['live-deck','frontend/public/assets/cards_v2','Existing live raster deck. Pixi draws indices separately.'],
 ['live-scene','frontend/public/assets/bg','Existing background SVGs.'],
 ['live-ui','frontend/public/assets/ui','Existing mixed UI sources.'],
 ['slice-proofs','frontend/src/slice/assets','Only four proof textures, not a complete deck.'],
 ['stake','design/thumbnail','Existing raster promotional assets.'],
];
function walk(dir){return fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]):[]}
(async()=>{
 const files=[];for(const [group,dir]of groups)for(const p of walk(path.join(root,dir)).filter(p=>/\.(svg|webp|png|jpg)$/i.test(p)&&!p.includes('/revisions/'))){
  const f={group,path:path.relative(root,p),bytes:fs.statSync(p).size,format:path.extname(p).slice(1)};
  if(f.format==='svg'){const s=fs.readFileSync(p,'utf8');f.viewBox=s.match(/viewBox="([^"]+)"/)?.[1];f.embeddedRaster=/data:image|<image\b/.test(s);f.patterns=(s.match(/<pattern\b/g)||[]).length;}
  else {const m=await sharp(p).metadata();f.width=m.width;f.height=m.height;f.alpha=m.hasAlpha;}
  files.push(f);
 }
 const branches=cp.execFileSync('git',['branch','--format=%(refname:short)'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 const prefix=path.relative(gitRoot,root),history=[];
 for(const branch of branches){const names=cp.execFileSync('git',['ls-tree','-r','--name-only',branch,'--',prefix+'/art',prefix+'/frontend/src/assets',prefix+'/reports/phase1-art-anchor-2026-09-30',prefix+'/reports/phase2b-courts-2026-09-30',prefix+'/reports/phase2b-aces-2026-09-30',prefix+'/reports/phase2b-card-back-2026-09-30',prefix+'/reports/phase2b-frame-2026-09-30'],{cwd:gitRoot,encoding:'utf8'}).trim().split('\n').filter(Boolean);history.push({branch,artFileCount:names.length,productionArtSrc:names.filter(p=>p.startsWith(prefix+'/art/')||p.startsWith(prefix+'/frontend/src/assets/'))});}
 const data={baseCommit:'e900fb3',capturedAt:new Date().toISOString(),groups:groups.map(([id,dir,status])=>({id,dir,status,count:files.filter(f=>f.group===id).length,bytes:files.filter(f=>f.group===id).reduce((a,b)=>a+b.bytes,0)})),files,branches:history,untrackedMuertaHudReferences:walk(path.join(gitRoot,'Claude outputs/w6/muerta-hud')).map(p=>path.relative(gitRoot,p)),missingDirectories:['art','art/src','frontend/src/assets'].filter(d=>!fs.existsSync(path.join(root,d)))};
 fs.writeFileSync(__dirname+'/asset-inventory.json',JSON.stringify(data,null,2)+'\n');
 console.log(data.groups);console.log('Embedded raster SVGs',files.filter(f=>f.embeddedRaster).length,'Pure SVGs',files.filter(f=>f.format==='svg'&&!f.embeddedRaster).length);
})().catch(e=>{console.error(e);process.exitCode=1});
