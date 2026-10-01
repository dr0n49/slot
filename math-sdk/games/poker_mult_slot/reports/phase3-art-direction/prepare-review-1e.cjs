// Review exports only. Generated edits are copied/assembled; no semantic raster repaint.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=__dirname,dir=root+'/review-1e',src=dir+'/sources',old=root+'/review-1d',out=dir+'/layers';
const mkdir=p=>fs.mkdirSync(p,{recursive:true});
const blank=(w,h)=>sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}});
const hero={base:{left:70,top:310,width:420,height:630},fs:{left:75,top:545,width:490,height:367}};
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function alphaBounds(buffer,threshold=8){const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});let x1=info.width,y1=info.height,x2=-1,y2=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>threshold){x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x);y2=Math.max(y2,y)}return{left:x1,top:y1,width:x2-x1+1,height:y2-y1+1};}
async function fullLayer(source,box,file,W=1920,H=1080){const input=await sharp(source).resize(box.width,box.height,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();await blank(W,H).composite([{input,left:box.left,top:box.top}]).webp({lossless:true}).toFile(file);}
async function joker(){const roi={left:465,top:930,width:285,height:235},original=old+'/sources/joker-B.png';
 const generated=await sharp(src+'/joker-B-hand.png').resize(285,235).ensureAlpha().png().toBuffer();
 // Only the AI-edited hand neighbourhood is transferred. The rest of approved B is byte-identical in decoded RGBA.
 const mask=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="285" height="235"><path d="M22 25L144 23 226 82 262 156 125 192 10 154Z" fill="white"/></svg>')).blur(7).png().toBuffer();
 const patch=await sharp(generated).composite([{input:mask,blend:'dest-in'}]).png().toBuffer();
 await sharp(original).composite([{input:patch,left:roi.left,top:roi.top}]).png().toFile(src+'/joker-B-corrected.png');
 await sharp(src+'/joker-B-corrected.png').resize(384,576).webp({lossless:true}).toFile(src+'/joker-B-render.webp');
 await sharp(src+'/joker-B-corrected.png').extract(roi).png().toFile(src+'/joker-B-lower-hand-detail.png');
 const a=await sharp(original).ensureAlpha().raw().toBuffer(),b=await sharp(src+'/joker-B-corrected.png').ensureAlpha().raw().toBuffer(),md=await sharp(original).metadata();let outsideChanged=0;
 for(let y=0;y<md.height;y++)for(let x=0;x<md.width;x++)if(x<roi.left||x>=roi.left+roi.width||y<roi.top||y>=roi.top+roi.height){const i=(y*md.width+x)*4;if(!a.subarray(i,i+4).equals(b.subarray(i,i+4)))outsideChanged++;}
 return {original:'../review-1d/sources/joker-B.png',originalSha256:sha(original),editedCrop:'sources/joker-B-hand.png',roi,feather:7,outsideRoiChangedPixels:outsideChanged};
}
async function frame(){const source=root+'/../phase2b-frame-2026-09-30/sources/frame.png',bounds=await alphaBounds(source,0);const d=dir+'/frame';mkdir(d);const full=await sharp(source).extract(bounds).png().toBuffer();await sharp(full).png().toFile(d+'/source-trimmed.png');
 const W=bounds.width,H=bounds.height,C=240,R=70,S=100;const boxes={nw:{left:0,top:0,width:C,height:C},ne:{left:W-C,top:0,width:C,height:C},sw:{left:0,top:H-C,width:C,height:C},se:{left:W-C,top:H-C,width:C,height:C},w:{left:0,top:C,width:S,height:H-2*C},e:{left:W-S,top:C,width:S,height:H-2*C}};
 for(const [name,top]of [['n',0],['s',H-R]]){boxes[name+'-left']={left:C,top,width:430-C,height:R};boxes[name+'-rosette']={left:430,top,width:130,height:R};boxes[name+'-right']={left:560,top,width:W-C-560,height:R};}
 for(const [name,box]of Object.entries(boxes))await sharp(full).extract(box).png().toFile(d+'/'+name+'.png');
 await sharp(full).extract({left:0,top:330,width:70,height:240}).png().toFile(d+'/leaf-material.png');
 const variants={};for(const[p,w,h,c,r,side]of[['desktop',700,954,120,35,50],['portrait',390,555,60,18,25]]){const center=Math.round(130*r/R),lw=Math.floor((w-2*c-center)/2),rw=w-2*c-center-lw;
  const dest={nw:[0,0,c,c],ne:[w-c,0,c,c],sw:[0,h-c,c,c],se:[w-c,h-c,c,c],w:[0,c,side,h-2*c],e:[w-side,c,side,h-2*c]};
  for(const[n,y]of[['n',0],['s',h-r]]){dest[n+'-left']=[c,y,lw,r];dest[n+'-rosette']=[c+lw,y,center,r];dest[n+'-right']=[c+lw+center,y,rw,r];}
  const items=[];for(const[name,[left,top,width,height]]of Object.entries(dest))items.push({input:await sharp(d+'/'+name+'.png').resize(width,height,{fit:'fill'}).png().toBuffer(),left,top});
  await blank(w,h).composite(items).png().toFile(d+'/'+p+'.png');variants[p]={size:[w,h],corner:c,railTopBottom:r,railSides:side,rosetteAspectError:Math.abs(center/r-130/70),segments:Object.entries(dest).map(([name,rect])=>({name,source:boxes[name],destination:rect}))};
 }
 return {source:'../phase2b-frame-2026-09-30/sources/frame.png',sha256:sha(source),sourceBounds:bounds,sliceCorner:C,sliceRailTopBottom:R,sliceRailSides:S,method:'Raster 9-slice with separately aspect-preserved top/bottom centre ornaments (12 segments). Full-width rails including the inner gold seam; whole corners. No paint, tracing, erasure or ornament removal.',diagonalHatchRemoved:false,candidates:1,variants};
}
async function mobileObjects(file,outfile){const m=await sharp(file).metadata(),half=Math.floor(m.width/2),objects=[],placements=[{left:3,top:647,width:88,height:74},{left:299,top:647,width:88,height:74}];
 for(let i=0;i<2;i++){const part=await sharp(file).extract({left:i*half,top:0,width:i===0?half:m.width-half,height:m.height}).png().toBuffer(),trim=await alphaBounds(part,8),cut=await sharp(part).extract(trim).png().toBuffer();const input=await sharp(cut).resize(88,74,{fit:'contain',background:{r:0,g:0,b:0,alpha:0},position:'bottom'}).png().toBuffer();objects.push({input,left:placements[i].left,top:placements[i].top});await sharp(input).png().toFile(outfile.replace('.webp','-'+i+'.png'));}
 await blank(390,844).composite(objects).webp({lossless:true}).toFile(outfile);return placements;
}
async function main(){mkdir(out);mkdir(dir+'/sprites');const manifest={scope:'Stage 1e review only',sources:[],variants:{},primaryBounds:hero,joker:await joker(),frame:await frame()};
 for(const[p,w,h]of[['desktop',610,520],['portrait',390,84]])await sharp(root+'/review-1b/current-'+p+'-fs.png').extract({left:0,top:0,width:w,height:h}).png().toFile(dir+'/current-bank-'+p+'.png');
 for(const v of ['B','FS']){const p=out+'/'+v;mkdir(p);const far=v==='B'?src+'/base-B-far-lit.png':old+'/sources/fs-far.png',mid=v==='B'?src+'/base-B-ofrenda-soft.png':old+'/sources/fs-graves.png';await sharp(far).resize(1920,1080,{fit:'cover'}).webp({quality:94}).toFile(p+'/desktop-far.webp');await fullLayer(mid,v==='B'?hero.base:hero.fs,p+'/desktop-middle.webp');
  const front=old+'/sources/base-B-front.png';await fullLayer(front,{left:16,top:884,width:554,height:185},p+'/desktop-front.webp');
  const md=await sharp(far).metadata(),crop={left:v==='B'?700:610,top:0,width:Math.floor(md.height*390/844),height:md.height};await sharp(far).extract(crop).resize(390,844).webp({quality:94}).toFile(p+'/portrait-far.webp');
  const objects=await mobileObjects(src+(v==='B'?'/mobile-base-objects.png':'/mobile-FS-objects.png'),p+'/portrait-middle.webp');await blank(390,844).webp({lossless:true}).toFile(p+'/portrait-front.webp');
  for(const pr of ['desktop','portrait'])await sharp(p+'/'+pr+'-far.webp').composite([{input:p+'/'+pr+'-middle.webp'},{input:p+'/'+pr+'-front.webp'}]).webp({quality:96}).toFile(p+'/'+pr+'-composite.webp');
  for(const[W,H,n]of[[1200,1600,'3x4'],[1080,1920,'9x16']]){const cw=Math.round(1080*W/H);await sharp(p+'/desktop-composite.webp').extract({left:0,top:0,width:cw,height:1080}).resize(W,H).webp({quality:96}).toFile(p+'/stake-'+n+'.webp');}
  manifest.variants[v]={world:[1920,1080],principal:v==='B'?hero.base:hero.fs,portraitNativeCrop:crop,mobileObjects:objects,middleVisibleOnPortrait:true,uiExclusion:[{left:0,top:84,width:390,height:555},{left:110,top:642,width:170,height:48},{left:0,top:723,width:390,height:121}],layers:['far','middle','front'].map(n=>({name:n,desktop:'layers/'+v+'/desktop-'+n+'.webp',portrait:'layers/'+v+'/portrait-'+n+'.webp'})),parallax:{far:2,middle:4,front:6}};
 }
 for(const col of ['pink','orange','teal']){const file=src+'/flag-'+(col==='pink'?'pink-connected':col)+'.png',b=await alphaBounds(file,8);await sharp(file).extract(b).resize(160,192,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(dir+'/sprites/flag-'+col+'.png');}
 fs.copyFileSync(old+'/sprites/petal.png',dir+'/sprites/petal.png');fs.copyFileSync(old+'/sprites/wire-desktop.png',dir+'/sprites/wire-desktop.png');
 for(const a of JSON.parse(fs.readFileSync(dir+'/generation-record.json'))){const f=src+'/'+a.id+'.png',m=await sharp(f).metadata();manifest.sources.push({id:a.id,file:'sources/'+a.id+'.png',size:[m.width,m.height],alpha:m.hasAlpha,sha256:sha(f),selected:a.id!=='flag-pink',note:a.id==='flag-pink'?'Rejected draft: unsupported eye/nose islands. Corrected in flag-pink-connected.':null});}
 fs.writeFileSync(dir+'/asset-manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log({sources:manifest.sources.length,layers:12,frame:manifest.frame.variants,joker:manifest.joker});
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});module.exports={hero};
