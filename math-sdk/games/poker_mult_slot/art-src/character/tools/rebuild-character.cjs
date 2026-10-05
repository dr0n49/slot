/* Pixel-preserving mechanical slicing. Generated paint is accepted ONLY through
   hidden masks, exported separately and disabled in setup (user-approved). */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const sharp=require(process.env.MUERTA_SHARP||'/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT=path.resolve(__dirname,'..'),SRC=path.join(ROOT,'source'),WORK=path.join(SRC,'rebuild'),QA=path.join(ROOT,'qa/rebuild'),LAY=path.join(ROOT,'layers');
const config=JSON.parse(fs.readFileSync(path.join(SRC,'rebuild-slices.json'))),[W,H]=config.size,N=W*H;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=async f=>(await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
const write=async(f,b,w,h)=>{fs.mkdirSync(path.dirname(f),{recursive:true});await sharp(b,{raw:{width:w,height:h,channels:4}}).withIccProfile('srgb').png().toFile(f);};
async function mask(d){const b=await sharp(Buffer.from(`<svg width="${W}" height="${H}"><path d="${d}" fill="white"/></svg>`)).ensureAlpha().raw().toBuffer();return Uint8Array.from({length:N},(_,p)=>b[p*4+3]>=128?1:0);}
function bounds(b,w=W,h=H){let x=w,y=h,x1=-1,y1=-1;for(let p=0;p<w*h;p++)if(b[p*4+3]){const px=p%w,py=Math.floor(p/w);x=Math.min(x,px);y=Math.min(y,py);x1=Math.max(x1,px);y1=Math.max(y1,py);}if(x1<0)return null;return{x,y,w:x1-x+1,h:y1-y+1};}
function crop(b,r,w=W){const out=Buffer.alloc(r.w*r.h*4);for(let y=0;y<r.h;y++)b.copy(out,y*r.w*4,((y+r.y)*w+r.x)*4,((y+r.y)*w+r.x+r.w)*4);return out;}
function nearestPaint(guide,w,h){
 const total=w*h,nearest=new Int32Array(total).fill(-1),q=new Int32Array(total);let tail=0,head=0;
 for(let p=0;p<total;p++){const i=p*4,pink=guide[i]>200&&guide[i+1]<60&&guide[i+2]>180;if(guide[i+3]>=128&&!pink){nearest[p]=p;q[tail++]=p;}}
 if(!tail)throw Error('Generated hidden-paint guide contains no usable paint');
 while(head<tail){const p=q[head++];for(const n of [p%w?p-1:-1,p%w<w-1?p+1:-1,p>=w?p-w:-1,p+w<total?p+w:-1])if(n>=0&&nearest[n]<0){nearest[n]=nearest[p];q[tail++]=n;}}
 return nearest;
}
function expand(r,px){const x=Math.max(0,r.x-px),y=Math.max(0,r.y-px);return{x,y,w:Math.min(W,r.x+r.w+px)-x,h:Math.min(H,r.y+r.h+px)-y};}
function distance(own,index){const d=new Uint8Array(N).fill(255),q=new Int32Array(N);let t=0,head=0;for(let p=0;p<N;p++)if(own[p]===index){d[p]=0;q[t++]=p;}while(head<t){const p=q[head++],v=d[p]+1;if(v>config.bufferPx)continue;for(const n of [p%W?p-1:-1,p%W<W-1?p+1:-1,p>=W?p-W:-1,p+W<N?p+W:-1])if(n>=0&&d[n]>v){d[n]=v;q[t++]=n;}}return d;}
async function slice(){
 const input=await read(path.join(SRC,config.source));if(input.info.width!==W||input.info.height!==H)throw Error('Source dimensions changed');
 const source=input.data,rawMasks={};for(const s of config.parts){rawMasks[s.name]=await mask(s.path);if(['left_card','deck','left_hand_card','right_hand_deck'].includes(s.name)){
  // Include the original dark contour and antialiased paper rim, not just the
  // fill interior of the lasso. Ownership changes only; RGBA stays untouched.
  for(let n=0;n<4;n++){const a=rawMasks[s.name],b=new Uint8Array(a);for(let p=0;p<N;p++)if(a[p])for(const q of [p%W?p-1:-1,p%W<W-1?p+1:-1,p>=W?p-W:-1,p+W<N?p+W:-1])if(q>=0)b[q]=1;rawMasks[s.name]=b;}
 }}
 const masks={};for(const s of config.parts){masks[s.name]=new Uint8Array(rawMasks[s.name]);if(s.subtract){const m=await mask(s.subtract);for(let p=0;p<N;p++)if(m[p])masks[s.name][p]=0;}for(const n of s.subtractParts||[])for(let p=0;p<N;p++)if(rawMasks[n][p])masks[s.name][p]=0;}
 const own=new Uint8Array(N);for(let k=1;k<config.parts.length;k++)for(let p=0;p<N;p++)if(masks[config.parts[k].name][p])own[p]=k;
 // Recover ivory contour fragments close to anatomical lasso boundaries. This
 // changes pixel ownership only, never RGBA. No replacement hand/face artwork.
 const ids=Object.fromEntries(config.parts.map((s,k)=>[s.name,k]));
 const boneInk=p=>{const i=p*4,r=source[i],g=source[i+1],b=source[i+2];return source[i+3]>0&&r>90&&g>65&&b>40&&r-g<68&&g-b<85&&r>b+15;};
 const repairs=[{to:'left_hand_card',from:['cape','left_sleeve','chest'],rect:[125,610,360,902]}, {to:'face_neck',from:['hood_back','hood_front'],rect:[474,120,739,499]}, {to:'right_hand_deck',from:['cape','chest','right_sleeve'],rect:[480,1105,755,1228]}];
 for(const repair of repairs){const from=new Set(repair.from.map(n=>ids[n])),[x0,y0,x1,y1]=repair.rect,selected=[];
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const p=y*W+x;if(from.has(own[p])&&boneInk(p))selected.push(p);}
  const selectedSet=new Set(selected),visited=new Set(),retained=[];
  for(const first of selected){if(visited.has(first))continue;const component=[first];visited.add(first);for(let head=0;head<component.length;head++){const p=component[head];for(const n of [p-1,p+1,p-W,p+W])if(selectedSet.has(n)&&!visited.has(n)){visited.add(n);component.push(n);}}if(component.length>=64)retained.push(...component);}
  for(const p of retained)own[p]=ids[repair.to];
 }
 fs.mkdirSync(QA,{recursive:true});fs.mkdirSync(WORK,{recursive:true});fs.writeFileSync(path.join(WORK,'ownership.bin'),own);
 const records=[],baseComposite=Buffer.alloc(N*4),labels=Buffer.alloc(N*4);let alphaHistogram=new Array(256).fill(0);
 for(let p=0;p<N;p++){alphaHistogram[source[p*4+3]]++;if(source[p*4+3]){const k=own[p];labels[p*4]=(k*73+71)%230+25;labels[p*4+1]=(k*109+97)%230+25;labels[p*4+2]=(k*137+41)%230+25;labels[p*4+3]=source[p*4+3];}}
 for(let k=0;k<config.parts.length;k++){
  const s=config.parts[k],visible=Buffer.alloc(N*4);let visiblePixels=0;
  for(let p=0;p<N;p++)if(own[p]===k&&source[p*4+3]){source.copy(visible,p*4,p*4,p*4+4);source.copy(baseComposite,p*4,p*4,p*4+4);visiblePixels++;}
  const r=bounds(visible);if(!r)throw Error('Empty slice: '+s.name);
  await write(path.join(LAY,s.name+'.png'),crop(visible,r),r.w,r.h);
  await write(path.join(WORK,'visible',s.name+'.png'),crop(visible,r),r.w,r.h);
  const rec={...s,path:undefined,subtract:undefined,subtractParts:undefined,...r,visiblePixels,slot:s.slot||s.name,default:true,source:'unaltered original pixels'};
  const hidden=Buffer.alloc(N*4),paintTarget=Buffer.from(visible);let hiddenPixels=0;
  if(s.soft){const d=distance(own,k);for(let p=0;p<N;p++)if(d[p]>0&&d[p]<=config.bufferPx&&own[p]>k&&source[p*4+3]>=240){hidden[p*4+3]=255;paintTarget[p*4]=255;paintTarget[p*4+1]=0;paintTarget[p*4+2]=255;paintTarget[p*4+3]=255;hiddenPixels++;}}
  if(hiddenPixels){const hr=bounds(paintTarget);await write(path.join(WORK,'masks',s.name+'.png'),crop(hidden,hr),hr.w,hr.h);await write(path.join(WORK,'targets',s.name+'.png'),crop(paintTarget,hr),hr.w,hr.h);rec.hidden={...hr,pixels:hiddenPixels,bufferPx:config.bufferPx,guide:s.name+'-paint.png',defaultVisible:false};}
  records.push(rec);
 }
 // Zero-alpha RGB is not visible. Preserve it in the full reference export too.
 for(let p=0;p<N;p++)if(!source[p*4+3])source.copy(baseComposite,p*4,p*4,p*4+4);
 if(!source.equals(baseComposite))throw Error('Slice partition did not reconstruct source');
 await write(path.join(ROOT,'character-a-master-sliced.png'),baseComposite,W,H);
 await write(path.join(QA,'ownership.png'),labels,W,H);
 const report={revision:'P2-rebuild',source:config.source,sourcePngSha256:sha(fs.readFileSync(path.join(SRC,config.source))),sourceRgbaSha256:sha(source),nativeSize:[W,H],upscale:false,alphaHistogram,hiddenPolicy:'separate disabled slots, approved by user',parts:records};
 fs.writeFileSync(path.join(WORK,'slices.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({phase:'slice',size:[W,H],parts:records.length,sourceRgbaEqual:true,hiddenTargets:records.filter(s=>s.hidden).map(s=>({name:s.name,...s.hidden}))},null,2));
}
const smooth=(a,b,x)=>{let t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function colourFs(r,g,b){
 // RGB-only colour treatment: preserves the original geometry, edge coverage,
 // line locations and relative light/shadow planes. Palette documented below.
 const mx=Math.max(r,g,b,1),light=(.2126*r+.7152*g+.0722*b)/255,t=smooth(.05,.88,light),gr=g/Math.max(r,1),br=b/Math.max(r,1);
 const gold=smooth(.30,.50,gr)*(1-smooth(.30,.52,br))*smooth(25,100,r),red=smooth(.10,.33,(r-g)/mx)*(1-gold);
 const neutral=[r*.74+6*t,g*.92+15*t,b*1.02+23*t],blue=[r*.12,r*.49,r*.62],warm=[r*.94,g*.97,b*.95+5];
 const out=neutral.map((v,i)=>(v*(1-red)+blue[i]*red)*(1-gold)+warm[i]*gold);
 return out.map(v=>Math.max(0,Math.min(255,Math.round(v))));
}
function applyFs(b){const out=Buffer.from(b);for(let i=0;i<out.length;i+=4)if(out[i+3]){const c=colourFs(b[i],b[i+1],b[i+2]);for(let k=0;k<3;k++)out[i+k]=c[k];}return out;}
async function finish(){
 const report=JSON.parse(fs.readFileSync(path.join(WORK,'slices.json'))),source=(await read(path.join(SRC,config.source))).data;
 if(sha(source)!==report.sourceRgbaSha256)throw Error('Original pixels changed since slice');
 const parts=report.parts.map(s=>({...s}));
 // Visible BASE layers may not be sourced from generation, resampled or repainted.
 for(const s of parts){const locked=(await read(path.join(WORK,'visible',s.name+'.png'))).data,live=(await read(path.join(LAY,s.name+'.png'))).data;if(!locked.equals(live))throw Error('Visible layer changed: '+s.name);await write(path.join(LAY,'fs',s.name+'.png'),applyFs(live),s.w,s.h);}
 const fsOriginal=applyFs(source);await write(path.join(WORK,'fs-original.png'),fsOriginal,W,H);
 const preflight=[];
 for(const [mode,original]of [['',source],['fs/',fsOriginal]]){
  const composed=await sharp({create:{width:W,height:H,channels:4,background:'#00000000'}}).pipelineColourspace('scrgb').composite(parts.map(s=>({input:path.join(LAY,mode+s.name+'.png'),left:s.x,top:s.y}))).toColourspace('srgb').ensureAlpha().raw().toBuffer();
  let changedPixels=0,maxDelta=0;for(let i=0;i<original.length;i+=4)if(original[i+3]){let changed=false;for(let k=0;k<4;k++){const d=Math.abs(composed[i+k]-original[i+k]);if(d)changed=true;maxDelta=Math.max(maxDelta,d);}if(changed)changedPixels++;}
  preflight.push({skin:mode?'FS':'BASE',compositor:'libvips linear scRGB; native PNGs at integer offsets, 100% opacity',changedVisibleRgbaPixels:changedPixels,maxDelta});if(changedPixels)throw Error('Pixel identity preflight failed BEFORE Spine: '+mode);
 }
 fs.writeFileSync(path.join(QA,'preflight-before-spine.json'),JSON.stringify({result:'PASS',composites:preflight},null,2)+'\n');
 // These buffers never appear in the setup composite. Paint is clipped to only
 // the precomputed occluded 32px band; generated visible pixels are discarded.
 for(const s of [...parts])if(s.hidden){const h=s.hidden,file=path.join(WORK,'paint',h.guide);if(!fs.existsSync(file))throw Error('Missing hidden paint: '+file);const guide=await sharp(file).trim({threshold:8}).resize(h.w,h.h,{fit:'fill'}).ensureAlpha().raw().toBuffer(),nearest=nearestPaint(guide,h.w,h.h),m=(await read(path.join(WORK,'masks',s.name+'.png'))).data,b=Buffer.alloc(guide.length);let covered=0,edgeFilled=0;for(let p=0;p<h.w*h.h;p++)if(m[p*4+3]){const src=nearest[p];if(src!==p)edgeFilled++;for(let c=0;c<3;c++)b[p*4+c]=guide[src*4+c];b[p*4+3]=255;covered++;}const name=s.name+'_underpaint',r=bounds(b,h.w,h.h),pixels=crop(b,r,h.w);await write(path.join(LAY,'underpaint',name+'.png'),pixels,r.w,r.h);await write(path.join(LAY,'fs/underpaint',name+'.png'),applyFs(pixels),r.w,r.h);parts.push({name,bone:s.bone,slot:name,soft:true,x:h.x+r.x,y:h.y+r.y,w:r.w,h:r.h,default:false,underpaintOf:s.name,paintedPixels:covered,bufferPx:config.bufferPx,imagePath:'underpaint/'+name,hiddenPaintRegistration:'trimmed generated guide; nearest painted edge extended only inside hidden mask',edgeFilledPixels:edgeFilled});}
 // Full hidden footprints behind the original hands/card/deck support swaps.
 // They are separate from the 32px deformation buffers and are transparent in
 // BASE/FS setup; idle/point/open explicitly reveal them, never the original.
 const ownership=fs.readFileSync(path.join(WORK,'ownership.bin')),ids=Object.fromEntries(report.parts.map((s,k)=>[s.name,k]));
 // Full-canvas inpaint preserves registration and continues the costume behind
 // the removed props. Accept only occluded original hand/card/deck footprints;
 // generated changes to the visible costume and silhouette are discarded.
 const gestureGuides={};for(const [side,r]of [['left',{x:110,y:590,w:490,h:370}],['right',{x:425,y:1010,w:400,h:310}]]){const b=await sharp(path.join(WORK,'paint/gesture-'+side+'-local.png')).resize(r.w,r.h,{fit:'fill'}).ensureAlpha().raw().toBuffer();gestureGuides[side]={...r,b,nearest:nearestPaint(b,r.w,r.h)};}
 const gestureOwner=new Uint8Array(N);
 for(const side of ['left','right']){const removed=new Set((side==='left'?['left_card','left_hand_card']:['deck','right_hand_deck']).map(n=>ids[n])),b=Buffer.alloc(N*4);let count=0;
  const g=gestureGuides[side];for(let p=0;p<N;p++)if(removed.has(ownership[p])&&source[p*4+3]){const x=p%W-g.x,y=Math.floor(p/W)-g.y;if(x<0||y<0||x>=g.w||y>=g.h)throw Error('Hand/prop outside local paint crop: '+side);const q=g.nearest[y*g.w+x];for(let c=0;c<3;c++)b[p*4+c]=g.b[q*4+c];b[p*4+3]=source[p*4+3];gestureOwner[p]=side==='left'?1:2;count++;}
  const r=bounds(b),name=side+'_gesture_underpaint';await write(path.join(LAY,'underpaint',name+'.png'),crop(b,r),r.w,r.h);await write(path.join(LAY,'fs/underpaint',name+'.png'),applyFs(crop(b,r)),r.w,r.h);parts.push({name,bone:'chest',slot:name,soft:true,...r,default:false,gestureUnderpaint:true,source:'generated hidden cloth behind removed original hand and props',paintedPixels:count,imagePath:'underpaint/'+name});
 }
 fs.writeFileSync(path.join(WORK,'gesture-ownership.bin'),gestureOwner);
 // Preserve the previously provided alternate hand drawings as optional swaps.
 // Their pose is not a substitute for the original default. Original CARD pose
 // remains the BASE and FS setup; idle skin selects the distinct idle attachments.
 const oldReg=JSON.parse(fs.readFileSync(path.join(ROOT,'_archive/p2-before-rebuild/source/layer-registration.json'))),oldJson=JSON.parse(fs.readFileSync(path.join(ROOT,'_archive/p2-before-rebuild/character-a-setup.json')));
 const S=2800/H,FEET=[W/2,H+oldJson.skeleton.y/S],world=(x,y)=>[(x-FEET[0])*S,(FEET[1]-y)*S];
 const context={console,Float32Array,Int16Array,Uint16Array,Uint32Array,Array,Math};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/spine-core-3.8.js'),'utf8'),context);const sp=context.spine;
 const data=new sp.SkeletonData();for(const [i,b]of oldJson.bones.entries()){const bd=new sp.BoneData(i,b.name,b.parent?data.findBone(b.parent):null);for(const k of ['x','y','rotation','scaleX','scaleY','length','shearX','shearY'])if(b[k]!=null)bd[k]=b[k];data.bones.push(bd);}const sk=new sp.Skeleton(data);sk.updateWorldTransform();const bind=Object.fromEntries(sk.bones.map(b=>[b.data.name,{x:b.worldX,y:b.worldY,a:b.a,b:b.b,c:b.c,d:b.d,r:b.getWorldRotationX(),index:b.data.index}]));
 const nativeWrists={left:[191,857],right:[731,1182]};
 for(const side of ['left','right'])for(const pose of ['idle','point','open',...(side==='right'?['card']:[])]){
  const name=side+'_hand_'+pose,old=oldReg.parts.find(p=>p.name===name),scale=.9;
  const file=path.join(ROOT,'_archive/p2-before-rebuild/layers',name+'.png');const oldPixels=(await read(file)).data;
  // Poses are kept at their delivered resolution. A renderer-only uniform scale
  // matches the original wrist size; no source pixels are rewritten.
  await write(path.join(LAY,name+'.png'),oldPixels,old.w,old.h);await write(path.join(LAY,'fs',name+'.png'),applyFs(oldPixels),old.w,old.h);
  const anchor=old.anchorPx,rot=(old.spriteRotation||0)*Math.PI/180;const [wx,wy]=nativeWrists[side],dx=(old.w/2-anchor[0])*scale,dy=(old.h/2-anchor[1])*scale;
  const cx=wx+dx*Math.cos(rot)+dy*Math.sin(rot),cy=wy-dx*Math.sin(rot)+dy*Math.cos(rot);
  parts.push({name,bone:side+'_hand',slot:side+'_hand',soft:false,x:cx-old.w*scale/2,y:cy-old.h*scale/2,w:old.w,h:old.h,displayScale:scale,rotation:old.spriteRotation||0,anchorPx:anchor,default:false,source:'previous optional hand-pose drawing; not original setup art'});
 }
 // Original right hand may also be selected through a card alias without
 // substituting an independently generated hand in the setup.
 const slots=[],base={},fsSkin={},idle={},fsIdle={};
 const local=(name,p)=>{const b=bind[name],det=b.a*b.d-b.b*b.c,dx=p[0]-b.x,dy=p[1]-b.y;return [(dx*b.d-dy*b.b)/det,(dy*b.a-dx*b.c)/det];};
 const rr=v=>+v.toFixed(7);
 const weights=(s,x,y)=>{
  if(s.bone==='face_neck'){const t=smooth(425,610,y);return [['head',1-t],['neck',t]];}
  if(s.bone==='cape'){const t=smooth(850,1280,y);return [['chest',1-t],['cape',t]];}
  if(s.bone==='chest'){const t=smooth(870,1190,y);return [['chest',1-t],['hips',t]];}
  if(s.bone==='hood_front'||s.bone==='hood_back'){const t=smooth(410,640,y);return [['head',1-t],['chest',t]];}
  if(s.bone==='left_sleeve'){const t=smooth(740,980,y);return [['left_arm',1-t],['left_elbow',t]];}
  if(s.bone==='right_sleeve'){const t=smooth(820,1110,y);return [['right_arm',1-t],['right_elbow',t]];}
  return [[s.bone,1]];
 };
 function attachment(s,prefix=''){
  const spriteScale=s.displayScale||1,cx=s.x+s.w*spriteScale/2,cy=s.y+s.h*spriteScale/2,p=world(cx,cy),imagePath=prefix+(s.imagePath||s.name);
  if(!s.soft){const lc=local(s.bone,p);return{type:'region',path:imagePath,x:rr(lc[0]),y:rr(lc[1]),rotation:rr((s.rotation||0)-bind[s.bone].r),width:s.w*spriteScale*S,height:s.h*spriteScale*S};}
  const cols=Math.max(2,Math.min(16,Math.ceil(s.w/70))),rows=Math.max(2,Math.min(24,Math.ceil(s.h/70))),coords=[];
  for(let x=0;x<=cols;x++)coords.push([x,0]);for(let y=1;y<=rows;y++)coords.push([cols,y]);for(let x=cols-1;x>=0;x--)coords.push([x,rows]);for(let y=rows-1;y>0;y--)coords.push([0,y]);const hull=coords.length;for(let y=1;y<rows;y++)for(let x=1;x<cols;x++)coords.push([x,y]);
  const index=new Map(coords.map((p,i)=>[p.join(','),i])),uvs=[],vertices=[],triangles=[],positions=[];
  for(const [gx,gy]of coords){const u=gx/cols,v=gy/rows,x=s.x+u*s.w,y=s.y+v*s.h,wp=world(x,y);positions.push(wp.map(rr));uvs.push(rr(u),rr(v));const ws=weights(s,x,y).filter(a=>a[1]>.000001),sum=ws.reduce((n,a)=>n+a[1],0);vertices.push(ws.length);for(const [bone,w]of ws){const p=local(bone,wp);vertices.push(bind[bone].index,rr(p[0]),rr(p[1]),rr(w/sum));}}
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=index.get([x,y].join(',')),b=index.get([x+1,y].join(',')),c=index.get([x,y+1].join(',')),d=index.get([x+1,y+1].join(','));triangles.push(a,c,b,b,c,d);}s.meshWorld=positions;
  return{type:'mesh',path:imagePath,uvs,vertices,triangles,hull,width:s.w,height:s.h};
 }
 const draw=[];for(const s of report.parts){if(s.name==='left_wrist')draw.push(...parts.filter(p=>p.gestureUnderpaint));const under=parts.find(p=>p.underpaintOf===s.name);if(under)draw.push(under);draw.push(parts.find(p=>p.name===s.name));}draw.push(...parts.filter(p=>!p.default&&!p.underpaintOf&&!p.gestureUnderpaint));
 for(const s of draw){const slot=s.slot;if(!base[slot]){base[slot]={};fsSkin[slot]={};const sl={name:slot,bone:s.bone};if(s.default||s.gestureUnderpaint)sl.attachment=s.name;slots.push(sl);}base[slot][s.name]=attachment(s);fsSkin[slot][s.name]=s.soft?{type:'linkedmesh',path:'fs/'+(s.imagePath||s.name),skin:'default',parent:s.name,deform:true}:{...base[slot][s.name],path:'fs/'+(s.imagePath||s.name)};if(s.gestureUnderpaint){base[slot][s.name].color='ffffff00';fsSkin[slot][s.name].color='ffffff00';idle[slot]={[s.name]:{...base[slot][s.name],color:'ffffffff'}};fsIdle[slot]={[s.name]:{...fsSkin[slot][s.name],color:'ffffffff'}};}}
 // Skin-specific setup aliases choose idle hands without touching bone values.
 for(const side of ['left','right']){const slot=side+'_hand',defaultName=side==='left'?'left_hand_card':'right_hand_deck',idleName=side+'_hand_idle';idle[slot]={[defaultName]:{...base[slot][idleName]}};fsIdle[slot]={[defaultName]:{...fsSkin[slot][idleName]}};}idle.left_card={left_card:{...base.left_card.left_card,color:'ffffff00'}};idle.deck={deck:{...base.deck.deck,color:'ffffff00'}};fsIdle.left_card={left_card:{...fsSkin.left_card.left_card,color:'ffffff00'}};fsIdle.deck={deck:{...fsSkin.deck.deck,color:'ffffff00'}};
 const maxY=FEET[1]*S,json={skeleton:{hash:'muerta-reaper-a-original-slices',x:-FEET[0]*S,y:(FEET[1]-H)*S,width:W*S,height:H*S,images:'./layers/'},bones:oldJson.bones,slots,ik:oldJson.ik,skins:[{name:'default',attachments:base},{name:'fs',attachments:fsSkin},{name:'idle',attachments:{...base,...idle}},{name:'fs_idle',attachments:{...fsSkin,...fsIdle}}],animations:{}};
 const reg={revision:'P2-rebuild',source:[W,H],master:[W,H],scale:S,padding:0,virtualFeet:FEET,worldBounds:[json.skeleton.x,json.skeleton.y,json.skeleton.width,json.skeleton.height],targetEditor:'3.8.75',exportVersionStamp:null,bonesPreservedSha256:sha(Buffer.from(JSON.stringify(json.bones))),parts:draw,boneBind:bind,originalWristsPx:nativeWrists,originalRgbaSha256:report.sourceRgbaSha256,hiddenPolicy:report.hiddenPolicy};
 fs.writeFileSync(path.join(ROOT,'character-a-setup.json'),JSON.stringify(json,null,2)+'\n');fs.writeFileSync(path.join(SRC,'layer-registration.json'),JSON.stringify(reg,null,2)+'\n');
 await write(path.join(ROOT,'character-a-master.png'),source,W,H);await write(path.join(ROOT,'character-a-fs.png'),fsOriginal,W,H);
 fs.writeFileSync(path.join(WORK,'fs-treatment.json'),JSON.stringify({method:'RGB-only deterministic continuous hue-weighted treatment; no displacement/resampling of original',geometry:'original RGBA coverage retained',reference:'BASE original plus approved cyan FS identity',palette:{oxblood:'smooth hue weight toward deep teal/cyan, RGB proportional to original red channel',bone:'cool ivory, continuous shadow-to-light treatment',gold:'warm retained by smooth gold hue weight',hardHueThresholds:false},baseRgbaSha256:sha(source),fsRgbaSha256:sha(fsOriginal)},null,2)+'\n');
 console.log(JSON.stringify({phase:'finish',parts:draw.length,slots:slots.length,bonesUnchanged:sha(Buffer.from(JSON.stringify(json.bones)))===sha(Buffer.from(JSON.stringify(oldJson.bones))),originalDefault:['left_hand_card','right_hand_deck'],scale:'PNG native, uniform renderer scale '+S,hiddenDisabled:true}));
}
(async()=>{await(fs.existsSync(path.join(WORK,'slices.json'))&&process.argv.includes('--finish')?finish():slice());})().catch(e=>{console.error(e);process.exit(1);});
