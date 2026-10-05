/* Mechanical proof sheets / crosshair annotations and delivery hashes.
   Original painted pixels are only placed and scaled, never repainted here. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require(process.env.MUERTA_SHARP||'/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function main(){
 const check=JSON.parse(fs.readFileSync(path.join(root,'qa/setup-check.json'),'utf8'));
 const svg=`<svg width="1634" height="2800" xmlns="http://www.w3.org/2000/svg">${check.pivots.map(p=>{const [x,y]=p.masterPixel,dx=p.marker===8?-36:24,dy=p.marker===9?36:-16;return `<path d="M${x-20} ${y}h40M${x} ${y-20}v40" stroke="#ffe86c" stroke-width="4"/><text x="${x+dx}" y="${y+dy}" font-family="sans-serif" font-size="32" fill="#fff2ac" stroke="#181518" stroke-width="5" paint-order="stroke">${p.marker}</text>`;}).join('')}<rect x="350" y="2500" width="900" height="260" fill="#17151d" fill-opacity=".9"/>${check.pivots.map((p,i)=>`<text x="${380+(i>=5?430:0)}" y="${2542+(i%5)*44}" fill="#ffefce" font-family="sans-serif" font-size="24">${p.marker}. ${p.name}</text>`).join('')}</svg>`;
 await sharp(path.join(root,'character-a-master.png')).composite([{input:Buffer.from(svg)}]).withIccProfile('srgb').png().toFile(path.join(root,'qa/p2fix-master-pivots.png'));
 const lights=[];for(const [i,name] of ['master','fs'].entries())lights.push({input:await sharp(path.join(root,`character-a-${name}.png`)).resize({height:1040}).png().toBuffer(),left:25+i*640,top:30});
 await sharp({create:{width:1280,height:1080,channels:4,background:'#17171e'}}).composite(lights).withIccProfile('srgb').png().toFile(path.join(root,'previews/character-a-lights.png'));
 const comparison=[];
 for(const [i,name] of ['_archive/p2fix-before-neckline/character-a-master.png','character-a-master.png'].entries())comparison.push({input:await sharp(path.join(root,name)).extract({left:160,top:40,width:1400,height:1530}).resize({width:590}).png().toBuffer(),left:15+i*620,top:48});
 comparison.push({input:Buffer.from('<svg width="1240" height="710" xmlns="http://www.w3.org/2000/svg"><g font-family="sans-serif" font-size="23" fill="#efe3c8"><text x="25" y="32">До · пустой овальный воротник</text><text x="645" y="32">После · воротник вокруг шеи</text></g></svg>'),left:0,top:0});
 await sharp({create:{width:1240,height:710,channels:4,background:'#17171e'}}).composite(comparison).withIccProfile('srgb').png().toFile(path.join(root,'qa/p2fix-neckline-comparison.png'));
 const tests=['left_elbow_plus45','left_elbow_minus45','right_elbow_plus45','right_elbow_minus45','left_shoulder_plus30','left_shoulder_minus30','right_shoulder_plus30','right_shoulder_minus30'];
 for(const skin of ['default','fs']){
  const inputs=[];
  for(let i=0;i<tests.length;i++){const x=i%4*448,y=Math.floor(i/4)*556;inputs.push({input:await sharp(path.join(root,`qa/runtime-${skin}-${tests[i]}.png`)).resize(448,525).png().toBuffer(),left:x,top:y+31});}
  const captions=`<svg width="1792" height="1112" xmlns="http://www.w3.org/2000/svg">${tests.map((t,i)=>`<text x="${i%4*448+18}" y="${Math.floor(i/4)*556+23}" font-family="sans-serif" font-size="18" fill="#f4e0b6">${t.replaceAll('_',' ')} · ${skin}</text>`).join('')}</svg>`;
  inputs.push({input:Buffer.from(captions),left:0,top:0});
  await sharp({create:{width:1792,height:1112,channels:4,background:'#17171e'}}).composite(inputs).withIccProfile('srgb').png().toFile(path.join(root,`qa/p2fix-rotations-${skin}.png`));
 }
 // Preserve stale/preliminary proofs instead of deleting them.
 const archive=path.join(root,'_archive/p2fix-preliminary-proofs');fs.mkdirSync(archive,{recursive:true});
 for(const name of ['hand-sources','rig-default-overlap.png','rig-fs-overlap.png','p2fix-near-shoulder-test.png']){const from=path.join(root,'qa',name),to=path.join(archive,name);if(fs.existsSync(from)&&!fs.existsSync(to))fs.renameSync(from,to);}
 const files=[];function scan(dir){for(const n of fs.readdirSync(path.join(root,dir))){const rel=dir?dir+'/'+n:n,f=path.join(root,rel);if(fs.statSync(f).isDirectory()){if(!rel.startsWith('_archive')&&!rel.startsWith('tools'))scan(rel);}else if(rel!=='source/delivery-manifest.json'){const b=fs.readFileSync(f);files.push({file:rel,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}scan('');
 fs.writeFileSync(path.join(root,'source/delivery-manifest.json'),JSON.stringify({created:'2026-10-04',revision:'P2-fix',targetEditor:'3.8.75',editorImportVerified:false,nativeEditorWorkflowWaivedByUser:true,files:files.sort((a,b)=>a.file.localeCompare(b.file))},null,2)+'\n');
 console.log(JSON.stringify({proofs:5,files:files.length,targetEditor:'3.8.75',editorImportVerified:false}));
}
main().catch(e=>{console.error(e);process.exit(1)});
