// Normal asset export only: copy, proportional resize, crop and layer assembly. No semantic repaint/retouch.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {P,defs,flag}=require('./build-direction.cjs');
const root=__dirname,dir=root+'/review-1d',src=dir+'/sources',out=dir+'/layers';
const mkdir=p=>fs.mkdirSync(p,{recursive:true});mkdir(out);mkdir(dir+'/sprites');
const transparent=(w,h)=>sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
const hero={base:{left:70,top:310,width:420,height:630},fs:{left:103,top:665,width:380,height:285}};
async function fullLayer(source,box,file,W=1920,H=1080){const buff=await sharp(source).resize(box.width,box.height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();await transparent(W,H).composite([{input:buff,left:box.left,top:box.top}]).webp({lossless:true}).toFile(file);}
async function foreground(source,file,mobile=false){const W=mobile?390:1920,H=mobile?844:1080;const list=mobile?[{left:-14,top:688,width:192,height:64},{left:255,top:690,width:168,height:56}]:[{left:16,top:884,width:554,height:185}];
 const items=[];for(const b of list){let buff=await sharp(source).resize(b.width,b.height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();let l=b.left,t=b.top;const extraction={left:Math.max(0,-l),top:0,width:Math.min(b.width-Math.max(0,-l),W-Math.max(l,0)),height:Math.min(b.height,H-t)};buff=await sharp(buff).extract(extraction).png().toBuffer();items.push({input:buff,left:Math.max(l,0),top:t});}await transparent(W,H).composite(items).webp({lossless:true}).toFile(file);}
async function main(){const manifest={sources:[],variants:{},primaryBounds:hero,mobilePolicy:'Independent crop of the quiet far field; principal altar/grave remains outside the phone camera. No principal object behind board or HUD.',frame:{source:'reports/phase2b-frame-2026-09-30/sources/frame.png',candidatesFound:1,adaptation:'Vector contour conversion of the original engraved corners, rebuilt soot rails and narrow gold seams. Original diagonal rail ornament is excluded.',trace:'frame-corner-paths.json'}};
 for(const v of ['A','B','FS']){
  const p=out+'/'+v;mkdir(p);const far=src+(v==='FS'?'/fs-far.png':`/base-${v}-far.png`),mid=src+(v==='FS'?'/fs-graves.png':`/base-${v}-ofrenda.png`),front=src+`/base-${v==='FS'?'A':v}-front.png`;
  await sharp(far).resize(1920,1080,{fit:'cover'}).webp({quality:94}).toFile(p+'/desktop-far.webp');
  await fullLayer(mid,v==='FS'?hero.fs:hero.base,p+'/desktop-middle.webp');await foreground(front,p+'/desktop-front.webp');
  const md=await sharp(far).metadata(),crop={left:v==='A'?785:v==='B'?700:610,top:0,width:Math.floor(md.height*390/844),height:md.height};
  await sharp(far).extract(crop).resize(390,844).webp({quality:94}).toFile(p+'/portrait-far.webp');
  await transparent(390,844).webp({lossless:true}).toFile(p+'/portrait-middle.webp');await foreground(front,p+'/portrait-front.webp',true);
  await sharp(p+'/desktop-far.webp').composite([{input:p+'/desktop-middle.webp'},{input:p+'/desktop-front.webp'}]).webp({quality:96}).toFile(p+'/desktop-composite.webp');
  await sharp(p+'/portrait-far.webp').composite([{input:p+'/portrait-front.webp'}]).webp({quality:96}).toFile(p+'/portrait-composite.webp');
  if(v!=='FS')for(const[W,H,n]of[[1200,1600,'3x4'],[1080,1920,'9x16']]){const cw=Math.round(1080*W/H);await sharp(p+'/desktop-composite.webp').extract({left:0,top:0,width:cw,height:1080}).resize(W,H).webp({quality:96}).toFile(p+`/stake-${n}.webp`)}
  manifest.variants[v]={world:[1920,1080],principal:v==='FS'?hero.fs:hero.base,portraitNativeCrop:crop,middleVisibleOnPortrait:false,layers:['far','middle','front'].map(n=>({name:n,desktop:`layers/${v}/desktop-${n}.webp`,portrait:`layers/${v}/portrait-${n}.webp`})),frontClip:'Canvas bounds only, no HUD edge baked into exported art',parallax:{far:2,middle:4,front:6}};
 }
 for(const v of ['A','B'])await sharp(src+`/joker-${v}.png`).resize(384,576).webp({lossless:true}).toFile(src+`/joker-${v}-render.webp`);
 for(const v of ['A','B'])await sharp(src+`/joker-${v}.png`).extract({left:465,top:930,width:285,height:235}).png().toFile(src+`/joker-${v}-lower-hand-detail.png`);
 for(const[v,col]of[['pink',P.pink],['orange',P.orange],['teal',P.teal]]){const s=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="192" viewBox="0 0 80 96">${defs()}${flag(40,1,1,col)}</svg>`;await sharp(Buffer.from(s)).png().toFile(dir+`/sprites/flag-${v}.png`)}
 await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="28" viewBox="-12 -14 24 28"><path d="M-3 0Q-2-9 4-5Q8 1 1 4Z" fill="${P.orange}" stroke="#a36528" stroke-width=".8"/></svg>`)).png().toFile(dir+'/sprites/petal.png');
 for(const m of [false,true]){const W=m?390:1920,H=m?42:80;const spans=m?[[-25,415]]:[[-45,600],[1320,1960]];const paths=spans.map(([a,z])=>'<path d="M'+a+' 8Q'+((a+z)/2)+' '+(m?35:75)+' '+z+' 8" fill="none" stroke="#bba17e" stroke-width="'+(m?1:1.6)+'"/>').join('');await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">'+paths+'</svg>')).png().toFile(dir+'/sprites/wire-'+(m?'portrait':'desktop')+'.png');}
 for(const a of JSON.parse(fs.readFileSync(dir+'/generation-record.json'))){const f=src+'/'+a.id+'.png',m=await sharp(f).metadata();manifest.sources.push({id:a.id,file:'sources/'+a.id+'.png',size:[m.width,m.height],alpha:m.hasAlpha,sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),selected:a.id!=='fs-night'});}
 fs.writeFileSync(dir+'/asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(dir+'/source-metadata.json',JSON.stringify(manifest.sources,null,2)+'\n');console.log({variants:3,layers:18,generatedSources:manifest.sources.length,frameCandidates:1});
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={hero};
