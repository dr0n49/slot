/* Mechanical production export: mask/extract existing artwork, register painted
   hidden overlaps, trim PNGs, place them in Spine 3.8. No art is synthesized here. */
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.MUERTA_SHARP || '/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'source');
const LAY = path.join(ROOT, 'layers');
const W = 948, H = 1659, SCALE = 2720/H, PAD = 40;
const OUTW = Math.round(W*SCALE)+PAD*2, OUTH=2800;
const FEET = [474,2600];
const world = p => [(p[0]-FEET[0])*SCALE, (FEET[1]-p[1])*SCALE];
const round = n => +n.toFixed(5);
const paths = {
  chest:'M382 475 Q406 457 441 467 L546 477 Q579 501 570 550 L690 618 L648 881 L536 1211 L440 1270 L329 1209 L242 971 L234 625 Q324 652 377 589 Z',
  left_sleeve:'M233 621 Q261 618 273 654 L257 803 L292 1030 L230 1157 L209 1245 L162 1322 L53 1305 L13 1220 L5 1076 L52 962 L119 867 L143 767 L167 655 Z',
  right_sleeve:'M678 605 Q734 593 806 625 L930 712 L948 954 L948 1160 L906 1280 L834 1336 L729 1310 L687 1190 L706 1110 L657 1030 L632 853 Z',
  hood_front:'M0 0 H948 V553 L876 700 L813 705 L733 645 L642 638 L561 626 L539 568 L575 496 L662 434 L695 350 L697 269 L669 176 L613 119 L575 106 L513 146 L473 191 L451 255 L434 309 L435 393 L451 439 L431 464 L386 479 L374 522 L381 571 L347 620 L293 639 L229 625 L144 673 L137 714 L75 734 L0 734 Z',
  face_neck:'M581 112 Q620 111 646 140 L671 178 L684 231 L695 271 L689 327 L667 362 L648 413 L618 470 L597 490 L554 480 L502 456 L476 440 L464 474 L482 547 L505 576 L460 621 L405 656 L399 616 L420 569 L447 524 L444 476 L433 443 L440 398 L447 358 L436 319 L450 272 L466 220 L487 184 L523 151 Z',
  left_wrist:'M53 1137 L193 1141 L213 1257 L181 1308 L155 1321 L35 1286 L9 1234 Z',
  right_wrist:'M734 1039 L854 1060 L920 1148 L883 1267 L802 1320 L740 1291 L707 1190 Z',
  left_hand_idle:'M52 1229 L88 1248 L110 1291 L132 1320 L147 1405 L149 1460 L123 1469 L131 1505 L151 1524 L132 1556 L104 1539 L80 1531 L52 1516 L27 1495 L9 1453 L2 1419 L14 1371 L37 1344 L44 1305 Z',
  right_hand_deck:'M503 1121 L525 1116 L555 1128 L585 1160 L623 1183 L658 1183 L691 1163 L706 1126 L710 1085 L722 1065 L748 1057 L768 1079 L782 1125 L784 1191 L771 1264 L751 1296 L724 1278 L710 1229 L681 1237 L649 1237 L620 1233 L591 1219 L563 1206 L539 1180 L518 1153 Z',
  marigold_leaves:'M526 655 L560 669 L668 664 L684 699 L699 754 L639 747 L613 733 L574 752 L498 766 L525 706 Z',
  ribbon_left:'M554 727 L606 730 L590 812 L560 870 L536 888 L540 794 Z',
  ribbon_right:'M614 730 L645 728 L640 792 L640 859 L615 829 L609 783 Z',
  marigold:'M612 632 C651 634 678 654 678 690 C680 722 648 748 615 749 C578 749 550 724 548 691 C547 657 576 634 612 632 Z',
  deck:'M490 1086 L583 1056 L718 1104 L722 1149 Q675 1191 622 1180 L492 1134 Z',
  left_eye:'M505 253 C525 236 555 238 583 257 Q594 277 581 291 Q549 313 517 292 Q499 276 505 253 Z',
  right_eye:'M642 283 Q662 270 684 285 L676 316 Q660 333 646 320 Z'
};
const order = Object.keys(paths);
const ownership = ['cape', ...order];
async function svgMask(d){ return sharp(Buffer.from(`<svg width="${W}" height="${H}"><path d="${d}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer(); }
async function readRaw(file){ return sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}); }
function blank(){ return Buffer.alloc(W*H*4); }
function over(a,b){ // premultiplication-aware straight-alpha composite
  for(let i=0;i<a.length;i+=4){const ba=b[i+3]/255,aa=a[i+3]/255,ca=ba+aa*(1-ba); if(ca){for(let c=0;c<3;c++)a[i+c]=Math.round((b[i+c]*ba+a[i+c]*aa*(1-ba))/ca);a[i+3]=Math.round(ca*255);} }
  return a;
}
async function fit(file,rect,reference=null){
  let pipe=sharp(path.join(SRC,file));
  if(reference){const m=await sharp(path.join(SRC,reference)).metadata(),t=await sharp(path.join(SRC,reference)).trim({threshold:6}).png().toBuffer({resolveWithObject:true});const full=await pipe.resize(m.width,m.height,{fit:'fill'}).png().toBuffer();pipe=sharp(full).extract({left:-t.info.trimOffsetLeft,top:-t.info.trimOffsetTop,width:t.info.width,height:t.info.height});}
  else pipe=pipe.trim({threshold:6});
  const raw=await pipe.resize(rect[2],rect[3],{fit:'fill'}).ensureAlpha().raw().toBuffer(),out=blank();for(let y=0;y<rect[3];y++)for(let x=0;x<rect[2];x++){let dx=x+rect[0],dy=y+rect[1];if(dx<0||dy<0||dx>=W||dy>=H)continue;const si=(y*rect[2]+x)*4,di=(dy*W+dx)*4;raw.copy(out,di,si,si+4);}return out;
}
async function fitAffine(file,srcPts,dstPts){
  const {data,info}=await readRaw(path.join(SRC,file));
  const [p,q,r]=srcPts,[a,b,c]=dstPts,ux=q[0]-p[0],uy=q[1]-p[1],vx=r[0]-p[0],vy=r[1]-p[1],det=ux*vy-uy*vx;
  const dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1];
  const m00=(dx*vy-ex*uy)/det,m01=(-dx*vx+ex*ux)/det,m10=(dy*vy-ey*uy)/det,m11=(-dy*vx+ey*ux)/det;
  const tx=a[0]-m00*p[0]-m01*p[1],ty=a[1]-m10*p[0]-m11*p[1],dd=m00*m11-m01*m10,out=blank();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=(m11*(x-tx)-m01*(y-ty))/dd,sy=(-m10*(x-tx)+m00*(y-ty))/dd,ix=Math.floor(sx),iy=Math.floor(sy);if(ix<0||iy<0||ix+1>=info.width||iy+1>=info.height)continue;const f=sx-ix,g=sy-iy,acc=[0,0,0,0];for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){const wt=(xx?f:1-f)*(yy?g:1-g),i=((iy+yy)*info.width+ix+xx)*4,alpha=data[i+3]/255;acc[3]+=alpha*wt;for(let k=0;k<3;k++)acc[k]+=data[i+k]*alpha*wt;}const di=(y*W+x)*4;if(acc[3]){for(let k=0;k<3;k++)out[di+k]=Math.round(acc[k]/acc[3]);out[di+3]=Math.round(acc[3]*255);}}
  return out;
}
function clipRect(buf,r){for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(x<r[0]||x>r[2]||y<r[1]||y>r[3])buf[(y*W+x)*4+3]=0;}return buf;}
const specs=[];
const nativePieces={};
const fsPaint={};
async function savePiece(name,buf,bone,soft=false,weightBones=[],extra={}){
  nativePieces[name]=Buffer.from(buf);
  const resized=await sharp(buf,{raw:{width:W,height:H,channels:4}}).resize(Math.round(W*SCALE),Math.round(H*SCALE),{kernel:'lanczos3'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let x0=resized.info.width,y0=resized.info.height,x1=-1,y1=-1;
  for(let y=0;y<resized.info.height;y++)for(let x=0;x<resized.info.width;x++)if(resized.data[(y*resized.info.width+x)*4+3]>0){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  if(x1<0)throw Error('Empty piece '+name);
  const rect={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
  await sharp(resized.data,{raw:resized.info}).extract(rect).withIccProfile('srgb').png().toFile(path.join(LAY,name+'.png'));
  const spec={name,bone,soft,weightBones,x:PAD+x0,y:PAD+y0,w:rect.width,h:rect.height,...extra};specs.push(spec);return spec;
}
async function main(){
  fs.mkdirSync(LAY,{recursive:true});
  const master=(await readRaw(path.join(SRC,'identity-master-v2.png'))).data;
  const masks=await Promise.all(order.map(n=>svgMask(paths[n])));
  const owner=new Uint8Array(W*H);
  for(let p=0;p<W*H;p++)for(let j=0;j<masks.length;j++)if(masks[j][p*4+3]>=128)owner[p]=j+1;
  const visibles={}; for(const n of ownership)visibles[n]=blank();
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const p=y*W+x,i=p*4;master.copy(visibles[ownership[owner[p]]],i,i,i+4);
    // Two source pixels of actual painted overlap prevent resampling seams.
    if(master[i+3]>200){const adjacent=new Set();for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<W&&ny<H)adjacent.add(owner[ny*W+nx]);}for(const k of adjacent)master.copy(visibles[ownership[k]],i,i,i+4);}
  }
  // Painted hidden overlaps are registered beneath retained visible pixels.
  const torso=await fit('cape-final-v2.png',[90,456,780,1199],'cape-final.png');
  const skull=await fit('face-neck-underpaint.png',[263,91,459,571]);
  const hood=await fit('hood-front-final.png',[75,0,860,740]);
  const left=await fitAffine('left-sleeve-underpaint.png',[[485,170],[585,810],[410,1410]],[[307,675],[272,1020],[104,1307]]);
  const right=await fitAffine('right-sleeve-final.png',[[568,207],[873,806],[278,1280]],[[750,690],[830,989],[736,1200]]);
  const prop=await fit('marigold-final.png',[537,641,153,206]);
  const flower=clipRect(Buffer.from(prop),[537,641,690,770]);
  const lRibbon=clipRect(Buffer.from(prop),[547,744,612,847]);
  const rRibbon=clipRect(Buffer.from(prop),[613,744,681,847]);
  const leafMask=await svgMask('M537 685 H690 V768 H537 Z');const leaves=blank();
  for(let p=0;p<W*H;p++){let i=p*4;if(leafMask[i+3]>128&&Math.hypot((p%W)-611,(Math.floor(p/W)-693)*1.15)>53)prop.copy(leaves,i,i,i+4);}
  function hidden(buf,allowed){for(let p=0;p<W*H;p++){const i=p*4; if(!allowed(p%W,Math.floor(p/W),ownership[owner[p]])||!master[i+3])buf[i+3]=0; else buf[i+3]=Math.min(buf[i+3],master[i+3]);} return buf;}
  const cape=Buffer.from(torso);
  const chest=await fit('chest-final.png',[245,465,486,852]);
  // The complete repainted skull/neck replaces the cut face so the hidden dome,
  // jaw and clavicles are genuinely continuous, with no duplicate chin seam.
  const face=Buffer.from(skull);
  const larm=Buffer.from(left),rarm=Buffer.from(right);
  // Back wrap uses painted inside folds. Front remains one uninterrupted crown-to-shoulder mesh.
  const hback=await fit('hood-underpaint.png',[99,20,805,704]);
  const hoodFront=Buffer.from(hood);
  // Draw order mirrors assembly: hidden fabric first, skull before collar, hand before deck.
  await savePiece('cape',cape,'cape',true,['hips','spine_01','spine_02','cape','cape_left','cape_center','cape_right']);
  await savePiece('hood_back',hback,'hood_back',true,['chest','neck','head','hood_back']);
  await savePiece('face_neck',face,'face_neck',true,['neck','head','jaw']);
  await savePiece('left_sleeve',larm,'left_sleeve',true,['left_arm','left_elbow','left_wrist']);
  await savePiece('right_sleeve',rarm,'right_sleeve',true,['right_arm','right_elbow','right_wrist']);
  await savePiece('chest',chest,'chest',false);
  await savePiece('hood_front',hoodFront,'hood_front',true,['head','neck','chest','hood_front','hood_left','hood_right']);
  // Cuffs are exact portions of the continuous sleeve, not a second design.
  await savePiece('left_wrist',clipRect(Buffer.from(left),[18,1220,224,1336]),'left_wrist');
  await savePiece('right_wrist',clipRect(Buffer.from(right),[653,1135,839,1310]),'right_wrist');
  await savePiece('marigold_leaves',leaves,'marigold_leaves');
  await savePiece('ribbon_left',lRibbon,'ribbon_left',true,['garland_02','ribbon_left','ribbon_left_tip']);
  await savePiece('ribbon_right',rRibbon,'ribbon_right',true,['garland_03','ribbon_right','ribbon_right_tip']);
  await savePiece('marigold',flower,'marigold');
  await savePiece('right_hand_deck',await fit('hand-deck-final.png',[506,1082,279,178]),'right_hand',false,[],{slot:'right_hand',default:true});
  await savePiece('deck',await fit('deck-final.png',[519,1080,207,139]),'deck',false,[],{slot:'deck',default:true});
  for(const side of ['left','right']){const d=paths[side+'_eye'];const mask=await svgMask(d);const eye=blank();for(let y=0;y<H;y++)for(let x=0;x<W-25;x++){let i=(y*W+x)*4,mi=(y*W+x+25)*4;if(mask[mi+3]>128)skull.copy(eye,i,i,i+4);}visibles[side+'_eye']=eye;await savePiece(side+'_eye',eye,side+'_eye');}
  // Hand-sheet cell extraction is mechanical; the illustration contains the poses.
  for(const side of ['left','right']){
    const file=path.join(SRC,`hands-${side}-poses.png`),meta=await sharp(file).metadata();
    const poses=['idle','card','point','open'];
    const wrist=side==='left'?[104,1307]:[736,1200];
    for(let j=0;j<4;j++){
      const cw=Math.floor(meta.width/2),ch=Math.floor(meta.height/2);
      const cr=j===2?{left:0,top:ch,width:Math.min(cw+34,meta.width),height:ch}:j===3?{left:cw+34,top:ch,width:meta.width-cw-34,height:ch}:{left:(j%2)*cw,top:0,width:cw,height:ch};
      const extracted=await sharp(file).extract(cr).png().toBuffer();
      let cell=await sharp(extracted).trim({threshold:6}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      // Each illustrated stub is at the upper-left of its cell; normalize its
      // anatomical wrist registration instead of aligning transparent cell bounds.
      const wristRatios=side==='left'?[[.32,.33],[.271,.378],[.21,.322],[.287,.326]]:[[.364,.306],[.302,.476],[.25,.42],[.274,.376]];
      const ps=side==='left'?.48:.40,size=[Math.round(cell.info.width*ps),Math.round(cell.info.height*ps)];
      const data=await sharp(cell.data,{raw:cell.info}).resize(size[0],size[1]).ensureAlpha().raw().toBuffer();
      const x0=Math.round(wrist[0]-size[0]*wristRatios[j][0]),y0=Math.round(wrist[1]-size[1]*wristRatios[j][1]);
      const full=blank();for(let y=0;y<size[1];y++)for(let x=0;x<size[0];x++){let dx=x+x0,dy=y+y0;if(dx<0||dy<0||dx>=W||dy>=H)continue;const si=(y*size[0]+x)*4,di=(dy*W+dx)*4;data.copy(full,di,si,si+4);}
      await savePiece(`${side}_hand_${poses[j]}`,full,`${side}_hand`,false,[],{slot:`${side}_hand`,default:side==='left'&&j===0,pose:poses[j]});
    }
  }
  // Eye-glow is a colour treatment of the existing eye-socket art, isolated.
  for(const side of ['left','right']){
    const glow=await fit('eye-glow-final.png',side==='left'?[503,267,30,19]:[625,290,20,14]);
    await savePiece(side+'_eye_glow',glow,side+'_eye_glow',false,[],{slot:side+'_eye_glow',default:false,fx:true});
  }
  const fsMap={cape:['cape-fs.png',[90,456,780,1199]],chest:['chest-fs.png',[245,465,486,852]],hood_front:['hood-front-fs.png',[75,0,860,740]],hood_back:['hood-front-fs.png',[99,20,805,704]],face_neck:['face-neck-fs.png',[263,91,459,571]]};
  for(const [n,[f,r]] of Object.entries(fsMap))if(fs.existsSync(path.join(SRC,f)))fsPaint[n]=await fit(f,r);
  if(fs.existsSync(path.join(SRC,'deck-fs.png')))fsPaint.deck=await fit('deck-fs.png',[519,1080,207,139]);
  if(fs.existsSync(path.join(SRC,'left-sleeve-fs.png')))fsPaint.left_sleeve=await fitAffine('left-sleeve-fs.png',[[485,170],[585,810],[410,1410]],[[307,675],[272,1020],[104,1307]]);
  if(fs.existsSync(path.join(SRC,'right-sleeve-fs.png')))fsPaint.right_sleeve=await fitAffine('right-sleeve-fs.png',[[568,207],[873,806],[278,1280]],[[750,690],[830,989],[736,1200]]);
  if(fsPaint.left_sleeve)fsPaint.left_wrist=fsPaint.left_sleeve;if(fsPaint.right_sleeve)fsPaint.right_wrist=fsPaint.right_sleeve;
  fs.writeFileSync(path.join(ROOT,'source/layer-registration.json'),JSON.stringify({source:[W,H],master:[OUTW,OUTH],scale:SCALE,padding:PAD,virtualFeet:FEET,parts:specs},null,2)+'\n');
  await exportFs(master,visibles);
  await exportSkeleton();
  const defaults=specs.filter(s=>s.default!==false);
  await sharp({create:{width:OUTW,height:OUTH,channels:4,background:'#00000000'}}).composite(defaults.map(s=>({input:path.join(LAY,s.name+'.png'),left:s.x,top:s.y}))).withIccProfile('srgb').png().toFile(path.join(ROOT,'character-a-master.png'));
  await sharp({create:{width:OUTW,height:OUTH,channels:4,background:'#00000000'}}).composite(defaults.map(s=>({input:path.join(LAY,'fs',s.name+'.png'),left:s.x,top:s.y}))).withIccProfile('srgb').png().toFile(path.join(ROOT,'character-a-fs.png'));
  if(fs.existsSync(path.join(SRC,'p2fix-left-sleeve-overlap.png')))await require('./apply-p2-fix.cjs')({ROOT,SRC,LAY,specs,bind,boneDefs,attachment,SCALE,PAD,FEET,OUTW,OUTH});
  console.log(JSON.stringify({master:[OUTW,OUTH],pieces:specs.length,sourceScale:SCALE}));
}
async function exportFs(master,visibles){
  fs.mkdirSync(path.join(LAY,'fs'),{recursive:true});
  const guide=(await sharp(path.join(SRC,'lighting-fs-guide.png')).resize(W,H,{fit:'fill'}).ensureAlpha().raw().toBuffer());
  // Palette transfer is sampled from the generated FS painting. Visible pixels
  // retain its painted rim; hidden paint and hand swaps use the same sampled LUT.
  const bins=new Map(),key=(r,g,b)=>((r>>4)<<8)|((g>>4)<<4)|(b>>4);
  for(let p=0;p<W*H;p++){const i=p*4;if(master[i+3]<240||guide[i+3]<240)continue;const k=key(master[i],master[i+1],master[i+2]);if(!bins.has(k))bins.set(k,[0,0,0,0]);const a=bins.get(k);a[0]+=guide[i];a[1]+=guide[i+1];a[2]+=guide[i+2];a[3]++;}
  for(const a of bins.values())for(let c=0;c<3;c++)a[c]/=a[3];
  const lut=new Map(bins),ks=[...bins.keys()];
  function colour(r,g,b){const k=key(r,g,b);if(lut.has(k))return lut.get(k);const kr=k>>8,kg=(k>>4)&15,kb=k&15;let best=ks[0],d=1e9;for(const q of ks){const dist=((q>>8)-kr)**2+(((q>>4)&15)-kg)**2+((q&15)-kb)**2;if(dist<d){best=q;d=dist;}}const v=bins.get(best);lut.set(k,v);return v;}
  for(const s of specs){
    const out=Buffer.from(nativePieces[s.name]),paint=fsPaint[s.name];
    for(let p=0;p<W*H;p++){const i=p*4;if(!out[i+3])continue;let c;if(s.fx){const l=(out[i]*.2126+out[i+1]*.7152+out[i+2]*.0722)/255;c=[l*110,l*245,l*255];}else if(paint&&paint[i+3]>180)c=[paint[i],paint[i+1],paint[i+2]];else c=colour(out[i],out[i+1],out[i+2]);for(let ch=0;ch<3;ch++)out[i+ch]=Math.round(c[ch]);}
    await sharp(out,{raw:{width:W,height:H,channels:4}}).resize(Math.round(W*SCALE),Math.round(H*SCALE),{kernel:'lanczos3'}).extract({left:s.x-PAD,top:s.y-PAD,width:s.w,height:s.h}).withIccProfile('srgb').png().toFile(path.join(LAY,'fs',s.name+'.png'));
  }
}
const boneDefs=[]; const bind={};
function bone(name,parent,p,target=null){
  const pos=world(p),par=parent?bind[parent]:{x:0,y:0,r:0};
  const ar=target?Math.atan2(p[1]-target[1],target[0]-p[0])*180/Math.PI:0;
  const pr=par.r*Math.PI/180,dx=pos[0]-par.x,dy=pos[1]-par.y;
  const b={name};if(parent)b.parent=parent;b.x=round(dx*Math.cos(pr)+dy*Math.sin(pr));b.y=round(-dx*Math.sin(pr)+dy*Math.cos(pr));b.rotation=round(ar-par.r);
  if(target)b.length=round(Math.hypot(target[0]-p[0],target[1]-p[1])*SCALE);
  boneDefs.push(b);bind[name]={x:pos[0],y:pos[1],r:ar,index:boneDefs.length-1,p};
}
function local(name,p){const b=bind[name],r=b.r*Math.PI/180,dx=p[0]-b.x,dy=p[1]-b.y;return [round(dx*Math.cos(r)+dy*Math.sin(r)),round(-dx*Math.sin(r)+dy*Math.cos(r))];}
function weights(s,x,y){
  let names=s.weightBones;
  if(s.name==='hood_front'&&x>380&&x<650&&y>420&&y<650){const n=Math.max(0,Math.min(1,(y-480)/110));return [['head',1-n],['neck',n]];}
  if(s.name==='cape'&&y<820){const side=x<474?'left':'right',b=bind[side+'_shoulder'].p,d=Math.hypot(x-b[0],y-b[1]),sw=.65*Math.max(0,1-d/230);return [['chest',1-sw],[side+'_shoulder',sw]];}
  if(s.name==='face_neck'){
    if(y>490){const nw=Math.max(.1,Math.min(1,(y-480)/110));return [['neck',nw],['head',1-nw]];}
    if(y>350&&x>445){const jw=Math.max(0,Math.min(.4,(y-350)/280));return [['head',1-jw],['jaw',jw]];}
    return [['head',1]];
  }
  if(s.name.includes('sleeve')){
    const side=s.name.startsWith('left')?'left':'right',a=bind[side+'_arm'].p,b=bind[side+'_elbow'].p,c=bind[side+'_wrist'].p;
    function project(p,q){const dx=q[0]-p[0],dy=q[1]-p[1],t=Math.max(0,Math.min(1,((x-p[0])*dx+(y-p[1])*dy)/(dx*dx+dy*dy)));return {t,d:Math.hypot(x-(p[0]+dx*t),y-(p[1]+dy*t))};}
    const upper=project(a,b),fore=project(b,c),elbowDistance=Math.hypot(x-b[0],y-b[1]);
    if(elbowDistance<68){const t=(upper.d<fore.d?-.5:.5)*(1-elbowDistance/68)+.5;return [[side+'_arm',1-t],[side+'_elbow',t]];}
    if(upper.d<fore.d)return [[side+'_arm',1]];
    const wristMix=Math.max(0,Math.min(1,(fore.t-.79)/.21));return [[side+'_elbow',1-wristMix],[side+'_wrist',wristMix]];
  }
  const candidates=names.map(n=>({n,d:Math.hypot(x-bind[n].p[0],y-bind[n].p[1])})).sort((a,b)=>a.d-b.d).slice(0,3);
  const vals=candidates.map(c=>1/Math.pow(Math.max(35,c.d),2.6)),total=vals.reduce((a,b)=>a+b,0);
  return candidates.map((c,i)=>[c.n,vals[i]/total]);
}
function attachment(s){
  const cx=s.x+s.w/2-PAD,cy=s.y+s.h/2-PAD;
  const wc=[cx-FEET[0]*SCALE,FEET[1]*SCALE-cy];
  if(!s.soft){const lc=local(s.bone,wc);return {type:'region',path:s.name,x:lc[0],y:lc[1],rotation:round(-bind[s.bone].r),width:s.w,height:s.h};}
  const cols=Math.max(6,Math.min(13,Math.ceil(s.w/120))),rows=Math.max(8,Math.min(18,Math.ceil(s.h/120)));
  const uvs=[],verts=[],tris=[],positions=[];
  // Rectangular outer hull first, then inner grid; hull is real boundary order.
  const coords=[];for(let x=0;x<=cols;x++)coords.push([x,0]);for(let y=1;y<=rows;y++)coords.push([cols,y]);for(let x=cols-1;x>=0;x--)coords.push([x,rows]);for(let y=rows-1;y>0;y--)coords.push([0,y]);
  const hull=coords.length;for(let y=1;y<rows;y++)for(let x=1;x<cols;x++)coords.push([x,y]);
  const indices=new Map(coords.map((c,i)=>[c.join(','),i]));
  for(const [gx,gy] of coords){
    const u=gx/cols,v=gy/rows;uvs.push(round(u),round(v));
    const px=s.x-PAD+u*s.w,py=s.y-PAD+v*s.h;
    const wp=[px-FEET[0]*SCALE,FEET[1]*SCALE-py];positions.push(wp);
    const w=weights(s,px/SCALE,py/SCALE).filter(a=>a[1]>.00001);const sum=w.reduce((a,b)=>a+b[1],0);verts.push(w.length);
    for(const [n,wgt] of w){const lc=local(n,wp);verts.push(bind[n].index,lc[0],lc[1],+(wgt/sum).toFixed(8));}
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=indices.get([x,y].join(',')),b=indices.get([x+1,y].join(',')),c=indices.get([x,y+1].join(',')),d=indices.get([x+1,y+1].join(','));tris.push(a,c,b,b,c,d);}
  const edges=[];for(let i=0;i<hull;i++)edges.push(i*2,((i+1)%hull)*2);
  s.meshWorld=positions.map(p=>p.map(round));
  return {type:'mesh',path:s.name,uvs,triangles:tris,vertices:verts,hull,edges,width:s.w,height:s.h};
}
async function exportSkeleton(){
  bone('root',null,FEET);bone('hips','root',[474,1180]);bone('spine_01','hips',[470,1010]);bone('spine_02','spine_01',[465,830]);bone('chest','spine_02',[470,650]);bone('neck','chest',[472,562]);bone('head','neck',[452,478]);bone('jaw','head',[449,353]);
  bone('face_neck','head',[452,478]);bone('left_eye','head',[517,276]);bone('right_eye','head',[634,297]);bone('left_eye_glow','left_eye',[517,276]);bone('right_eye_glow','right_eye',[634,297]);
  bone('hood_front','head',[572,125]);bone('hood_back','chest',[456,520]);bone('hood_left','hood_front',[333,493]);bone('hood_right','hood_front',[739,448]);
  bone('cape','hips',[474,1140]);bone('cape_left','cape',[261,1360]);bone('cape_center','cape',[420,1510]);bone('cape_right','cape',[690,1410]);
  for(const side of ['left','right']){
    const pts=side==='left'?[[307,675],[272,1020],[104,1307]]:[[750,690],[830,989],[736,1200]];
    bone(side+'_shoulder','chest',pts[0]);bone(side+'_arm',side+'_shoulder',pts[0],pts[1]);bone(side+'_elbow',side+'_arm',pts[1],pts[2]);bone(side+'_wrist',side+'_elbow',pts[2]);bone(side+'_hand',side+'_wrist',pts[2]);bone(side+'_ik','root',pts[2]);
    bone(side+'_sleeve',side+'_arm',pts[0]);
  }
  bone('deck','right_hand',[620,1124]);bone('garland_01','chest',[611,691]);bone('garland_02','garland_01',[594,731]);bone('garland_03','garland_02',[618,742]);bone('marigold','garland_01',[611,691]);bone('marigold_leaves','garland_02',[594,731]);bone('ribbon_left','garland_02',[595,756]);bone('ribbon_left_tip','ribbon_left',[576,833]);bone('ribbon_right','garland_03',[620,757]);bone('ribbon_right_tip','ribbon_right',[637,834]);
  const slots=[],skin={};
  for(const s of specs){const slot=s.slot||s.name;if(!skin[slot]){skin[slot]={};const sl={name:slot,bone:s.bone};if(s.default!==false)sl.attachment=s.name;if(s.fx)sl.blend='additive';slots.push(sl);}skin[slot][s.name]=attachment(s);}
  const fsSkin={};for(const s of specs){const slot=s.slot||s.name;fsSkin[slot]??={};fsSkin[slot][s.name]=s.soft?{type:'linkedmesh',path:'fs/'+s.name,skin:'default',parent:s.name,deform:true,width:s.w,height:s.h}:{...skin[slot][s.name],path:'fs/'+s.name};}
  const skeleton={skeleton:{hash:'muerta-reaper-a-hand-authored-setup',x:round(-FEET[0]*SCALE-PAD),y:round((FEET[1]-H)*SCALE-PAD),width:OUTW,height:OUTH,images:'./layers/'},bones:boneDefs,slots,ik:['left','right'].map((s,i)=>({name:s+'_arm_ik',order:i,bones:[s+'_arm',s+'_elbow'],target:s+'_ik',mix:0,bendPositive:s==='left'})),skins:[{name:'default',attachments:skin},{name:'fs',attachments:fsSkin}],animations:{}};
  fs.writeFileSync(path.join(ROOT,'character-a-setup.json'),JSON.stringify(skeleton,null,2)+'\n');
  fs.writeFileSync(path.join(ROOT,'source/layer-registration.json'),JSON.stringify({source:[W,H],master:[OUTW,OUTH],scale:SCALE,padding:PAD,virtualFeet:FEET,targetEditor:'3.8.75',exportVersionStamp:null,parts:specs,boneBind:bind},null,2)+'\n');
}
main().catch(e=>{console.error(e);process.exit(1)});
