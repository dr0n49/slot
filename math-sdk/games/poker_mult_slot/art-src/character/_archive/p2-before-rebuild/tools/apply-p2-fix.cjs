/* Mechanical registration of painted P2 corrections; setup only. */
const fs=require('fs'),path=require('path');
const sharp=require(process.env.MUERTA_SHARP||'/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
module.exports=async ctx=>{
 const {ROOT,SRC,LAY,specs,bind,boneDefs,attachment,SCALE,PAD,FEET,OUTW,OUTH}=ctx;
 const by=Object.fromEntries(specs.map(s=>[s.name,s]));
 const raw=async f=>(await sharp(f).ensureAlpha().raw().toBuffer());
 const write=async(f,b,w,h)=>{const out=await sharp(b,{raw:{width:w,height:h,channels:4}}).withIccProfile('srgb').png().toBuffer();if(!fs.existsSync(f)||!fs.readFileSync(f).equals(out))fs.writeFileSync(f,out);};
 const report={source:'runtime 3.8; native editor waived by user',overlaps:[],hands:[],marigoldShiftPx:-25};
 for(const [name,id,delta,up] of [['left_sleeve','left-sleeve-overlap',61,false],['hood_front','hood-front-overlap',20,false],['cape','cape-shoulder-overlap',30,true]]){
  const s=by[name],oldH=s.h,h=oldH+delta,w=s.w,outputs=[];
  for(const sub of ['','fs/']){
   const paint=await sharp(path.join(SRC,`p2fix-${id}${sub?'-fs':''}.png`)).trim({threshold:6}).resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer();outputs.push(paint);
  }
  for(let i=3;i<outputs[1].length;i+=4)outputs[1][i]=outputs[0][i];
  for(let mode=0;mode<2;mode++)await write(path.join(LAY,mode?'fs':'',name+'.png'),outputs[mode],w,h);
  s.h=h;if(up)s.y-=delta;s.extendedOverlap={pixels:delta,direction:up?'up':'down',source:`p2fix-${id}.png`};report.overlaps.push({name,before:[w,oldH],after:[w,h],direction:s.extendedOverlap.direction});
 }
 // Re-register the rigid cuff from the same painted sleeve. Keeping the old cuff
 // would expose its rectangular crop when the continuous sleeve is repainted.
 {
  const sleeve=by.left_sleeve,cuff=by.left_wrist;
  const dx=Math.round(cuff.x-sleeve.x),dy=Math.round(cuff.y-sleeve.y);
  for(const sub of ['','fs/']){
   const p=await raw(path.join(LAY,sub+'left_sleeve.png')),out=Buffer.alloc(cuff.w*cuff.h*4);
   for(let y=0;y<cuff.h;y++)for(let x=0;x<cuff.w;x++)if(x+dx>=0&&y+dy>=0&&x+dx<sleeve.w&&y+dy<sleeve.h){const i=((y+dy)*sleeve.w+x+dx)*4;p.copy(out,(y*cuff.w+x)*4,i,i+4);}
   await write(path.join(LAY,sub+'left_wrist.png'),out,cuff.w,cuff.h);
  }
  cuff.registrationSource='left_sleeve painted cuff, exact aligned overlay';
 }
 const landmarks={left:{idle:[174,170],card:[151,180],point:[153,174],open:[160,171]},right:{idle:[183,173],card:[157,198],point:[167,157],open:[157,175]}};
 function palette(base,cool){const bins=new Map();for(let i=0;i<base.length;i+=4){if(base[i+3]<240)continue;const key=[base[i]>>4,base[i+1]>>4,base[i+2]>>4].join(',');if(!bins.has(key))bins.set(key,[0,0,0,0]);const a=bins.get(key);for(let c=0;c<3;c++)a[c]+=cool[i+c];a[3]++;}const colours=[...bins].map(([k,v])=>({key:k.split(',').map(Number),rgb:v.slice(0,3).map(c=>c/v[3])}));return (r,g,b)=>{const key=[r>>4,g>>4,b>>4],near=colours.map(c=>({c,d:c.key.reduce((d,k,i)=>d+(k-key[i])**2,0)})).sort((a,b)=>a.d-b.d).slice(0,3),out=[0,0,0];let sum=0;for(const n of near){const w=1/(.2+n.d);sum+=w;for(let c=0;c<3;c++)out[c]+=w*n.c.rgb[c];}return out.map(c=>Math.round(c/sum));};}
 if(fs.existsSync(path.join(SRC,'p2fix-chest-worn.png'))){
  const s=by.chest,colour=palette(await raw(path.join(LAY,'chest.png')),await raw(path.join(LAY,'fs/chest.png')));
  const base=await sharp(path.join(SRC,'p2fix-chest-worn.png')).trim({threshold:6}).resize(s.w,s.h,{fit:'fill'}).ensureAlpha().raw().toBuffer();
  const fsFile=path.join(SRC,'p2fix-chest-worn-fs.png');
  const cool=fs.existsSync(fsFile)?await sharp(fsFile).trim({threshold:6}).resize(s.w,s.h,{fit:'fill'}).ensureAlpha().raw().toBuffer():Buffer.from(base);
  for(let i=0;i<base.length;i+=4){cool[i+3]=base[i+3];if(!fs.existsSync(fsFile)&&base[i+3]){const c=colour(base[i],base[i+1],base[i+2]);for(let k=0;k<3;k++)cool[i+k]=c[k];}}
  await write(path.join(LAY,'chest.png'),base,s.w,s.h);await write(path.join(LAY,'fs/chest.png'),cool,s.w,s.h);
  s.paintSource='p2fix-chest-worn.png';report.neckline='Fitted open V collar, transparent neck opening, after user wearability correction';
 }
 function handPlacement(s,anchor,rotation=0){const wr=bind[s.bone.replace('_hand','_wrist')],wp=[wr.x+FEET[0]*SCALE+PAD,FEET[1]*SCALE-wr.y+PAD],a=rotation*Math.PI/180,dx=165-anchor[0],dy=anchor[1]-200,cx=dx*Math.cos(a)-dy*Math.sin(a),cy=dx*Math.sin(a)+dy*Math.cos(a);Object.assign(s,{x:wp[0]+cx-165,y:wp[1]-cy-200,w:330,h:400,canvas:'shared hand registration canvas',anchorPx:anchor,spriteRotation:rotation});}
 for(const side of ['left','right'])for(const pose of ['idle','card','point','open']){
  const name=`${side}_hand_${pose}`,s=by[name],colour=palette(await raw(path.join(LAY,name+'.png')),await raw(path.join(LAY,'fs',name+'.png'))),src=path.join(SRC,'p2fix-hand-parts',`${side}-${pose}.png`),m=await sharp(src).metadata(),scale=.55,size=[Math.round(m.width*scale),Math.round(m.height*scale)];
  const scaled=await sharp(src).resize(size[0],size[1],{fit:'fill'}).png().toBuffer();
  let pipe=sharp(scaled),landmark=landmarks[side][pose].map(n=>n*scale),rotation=0;
  if(pose==='point'){pipe=pipe.rotate(90);landmark=[size[1]-landmark[1],landmark[0]];size.reverse();rotation=90;}
  if(size[0]>330||size[1]>400)throw Error('Hand exceeds canvas '+name);
  const x=Math.floor((330-size[0])/2),y=Math.floor((400-size[1])/2),p=await pipe.ensureAlpha().raw().toBuffer(),out=Buffer.alloc(330*400*4);
  for(let yy=0;yy<size[1];yy++)for(let xx=0;xx<size[0];xx++)p.copy(out,((yy+y)*330+xx+x)*4,(yy*size[0]+xx)*4,(yy*size[0]+xx)*4+4);
  const anchor=[x+landmark[0],y+landmark[1]];handPlacement(s,anchor,rotation);Object.assign(s,{sourceLandmark:landmarks[side][pose],sourceScale:scale});
  await write(path.join(LAY,name+'.png'),out,330,400);const cool=Buffer.from(out);for(let i=0;i<cool.length;i+=4)if(cool[i+3]){const c=colour(out[i],out[i+1],out[i+2]);for(let k=0;k<3;k++)cool[i+k]=c[k];}await write(path.join(LAY,'fs',name+'.png'),cool,330,400);
  report.hands.push({name,canvas:[330,400],sourceScale:scale,sourceWrist:landmarks[side][pose],anchorPx:anchor,storedRotation:rotation});
 }
 const support=by.right_hand_deck,wr=bind.right_wrist,wp=[wr.x+FEET[0]*SCALE+PAD,FEET[1]*SCALE-wr.y+PAD],scale=.65,size=[Math.round(support.w*scale),Math.round(support.h*scale)],x=Math.floor((330-size[0])/2),y=Math.floor((400-size[1])/2),anchor=[x+(wp[0]-support.x)*scale,y+(wp[1]-support.y)*scale];
 for(const sub of ['','fs/']){const p=await sharp(path.join(LAY,sub+'right_hand_deck.png')).resize(...size).ensureAlpha().raw().toBuffer(),out=Buffer.alloc(330*400*4);for(let yy=0;yy<size[1];yy++)for(let xx=0;xx<size[0];xx++)p.copy(out,((yy+y)*330+xx+x)*4,(yy*size[0]+xx)*4,(yy*size[0]+xx)*4+4);await write(path.join(LAY,sub+'right_hand_deck.png'),out,330,400);}
 handPlacement(support,anchor);support.sourceScale=scale;report.hands.push({name:support.name,canvas:[330,400],anchorPx:anchor,sourceScale:scale});
 const deck=by.deck;for(const sub of ['','fs/']){const p=await sharp(path.join(LAY,sub+'deck.png')).resize(Math.round(deck.w*scale),Math.round(deck.h*scale)).ensureAlpha().raw().toBuffer();await write(path.join(LAY,sub+'deck.png'),p,Math.round(deck.w*scale),Math.round(deck.h*scale));}
 Object.assign(deck,{x:wp[0]+(deck.x-wp[0])*scale,y:wp[1]+(deck.y-wp[1])*scale,w:Math.round(deck.w*scale),h:Math.round(deck.h*scale)});
 const db=bind.deck;db.x=wr.x+(db.x-wr.x)*scale;db.y=wr.y+(db.y-wr.y)*scale;db.p=[db.x/SCALE+FEET[0],FEET[1]-db.y/SCALE];
 for(const n of ['garland_01','garland_02','garland_03','marigold','marigold_leaves','ribbon_left','ribbon_left_tip','ribbon_right','ribbon_right_tip']){bind[n].x-=25;bind[n].p[0]-=25/SCALE;}
 for(const n of ['marigold','marigold_leaves','ribbon_left','ribbon_right'])by[n].x-=25;
 for(const b of boneDefs){const p=bind[b.name],q=b.parent?bind[b.parent]:{x:0,y:0,r:0},r=q.r*Math.PI/180,dx=p.x-q.x,dy=p.y-q.y;b.x=+(dx*Math.cos(r)+dy*Math.sin(r)).toFixed(5);b.y=+(-dx*Math.sin(r)+dy*Math.cos(r)).toFixed(5);}
 const json=JSON.parse(fs.readFileSync(path.join(ROOT,'character-a-setup.json'),'utf8'));json.bones=boneDefs;
 const order=['cape','left_sleeve','hood_back','face_neck','chest','right_sleeve','hood_front','left_eye','right_eye','left_wrist','right_wrist','right_hand','left_hand','deck','ribbon_left','ribbon_right','marigold_leaves','marigold','left_eye_glow','right_eye_glow'];
 json.slots.sort((a,b)=>order.indexOf(a.name)-order.indexOf(b.name));report.drawOrder=order;
 const skin={},fsSkin={};for(const s of specs){const slot=s.slot||s.name;skin[slot]??={};fsSkin[slot]??={};const a=attachment(s);if(s.spriteRotation)a.rotation=+(s.spriteRotation-bind[s.bone].r).toFixed(5);skin[slot][s.name]=a;fsSkin[slot][s.name]=s.soft?{type:'linkedmesh',path:'fs/'+s.name,skin:'default',parent:s.name,deform:true,width:s.w,height:s.h}:{...a,path:'fs/'+s.name};}
 json.skins=[{name:'default',attachments:skin},{name:'fs',attachments:fsSkin}];json.animations={};fs.writeFileSync(path.join(ROOT,'character-a-setup.json'),JSON.stringify(json,null,2)+'\n');
 fs.writeFileSync(path.join(SRC,'layer-registration.json'),JSON.stringify({source:[948,1659],master:[OUTW,OUTH],scale:SCALE,padding:PAD,virtualFeet:FEET,targetEditor:'3.8.75',exportVersionStamp:null,revision:'P2-fix',parts:specs,boneBind:bind},null,2)+'\n');
 const defaults=json.slots.flatMap(sl=>sl.attachment?[by[sl.attachment]]:[]);
 for(const sub of ['','fs/']){const b=await sharp({create:{width:OUTW,height:OUTH,channels:4,background:'#00000000'}}).composite(defaults.map(s=>({input:path.join(LAY,sub+s.name+'.png'),left:Math.round(s.x),top:Math.round(s.y)}))).withIccProfile('srgb').png().toBuffer();fs.writeFileSync(path.join(ROOT,sub?'character-a-fs.png':'character-a-master.png'),b);}
 report.wristBonePositionChanges=0;fs.writeFileSync(path.join(ROOT,'qa/p2fix-changes.json'),JSON.stringify(report,null,2)+'\n');
};
