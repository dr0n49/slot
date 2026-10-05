/* Independent setup/native-roundtrip checks; pose tests are in memory only. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),QA=path.join(ROOT,'qa/p3-0-fixed');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p)));
const original=read('character-a-setup-backup.json'),corrected=read('character-a-p3-setup.json');
const native=read('qa/p3-0-fixed/native-export/character-a.json');
const reg=read('source/layer-registration.json');
const ctx={console,Float32Array,Int16Array,Uint16Array,Uint32Array,Array,Math};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/spine-core-3.8.js'),'utf8'),ctx);
const sp=ctx.spine,regions={};
function region(p){if(regions[p])return regions[p];const b=fs.readFileSync(path.join(ROOT,'layers',p+'.png'));const w=b.readUInt32BE(16),h=b.readUInt32BE(20);return regions[p]={u:0,v:0,u2:1,v2:1,rotate:false,width:w,height:h,originalWidth:w,originalHeight:h,offsetX:0,offsetY:0};}
const loader={newRegionAttachment(s,n,p){const a=new sp.RegionAttachment(n);a.setRegion(region(p));return a;},newMeshAttachment(s,n,p){const a=new sp.MeshAttachment(n);a.region=region(p);return a;}};
function make(json){const data=new sp.SkeletonJson(loader).readSkeletonData(json),s=new sp.Skeleton(data);s.setToSetupPose();s.updateWorldTransform();return s;}
function verts(s,slot,a){const v=new Float32Array(a instanceof sp.MeshAttachment?a.worldVerticesLength:8);if(a instanceof sp.MeshAttachment)a.computeWorldVertices(slot,0,v.length,v,0,2);else a.computeWorldVertices(slot.bone,v,0,2);return v;}
const before=make(original),fixed=make(corrected);
assert.equal(native.skeleton.spine,'3.8.75');assert.equal(native.bones.length,45);assert.equal(Object.keys(native.animations||{}).length,0);
assert.deepEqual(native.skins.map(s=>s.name).sort(),['default','fs','fs_idle','idle']);
// The bundled official parser explicitly rejects exports stamped 3.8.75.
// Keep that stamp and the runtime unchanged; check native serialization as raw data.
let nativeRuntimeError=null;try{make(native);}catch(e){nativeRuntimeError=e.message;}
assert.match(nativeRuntimeError||'',/Unsupported skeleton data/);
let preservedGeometryMaxWorld=0,nativeMaxNumericDifference=0,count=0;
function compareNumbers(a,b,label){assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++){const delta=Math.abs(a[i]-b[i]);assert(delta<.011,label+'['+i+']');nativeMaxNumericDifference=Math.max(nativeMaxNumericDifference,delta);}}
function unorderedTopology(values,stride){const groups=[];for(let i=0;i<values.length;i+=stride)groups.push(values.slice(i,i+stride).sort((a,b)=>a-b).join(','));return groups.sort();}
for(const bone of corrected.bones){const n=native.bones.find(b=>b.name===bone.name);assert(n,bone.name);assert.equal(n.parent,bone.parent);for(const k of['x','y','rotation','scaleX','scaleY','length','shearX','shearY'])compareNumbers([bone[k]??(k.startsWith('scale')?1:0)],[n[k]??(k.startsWith('scale')?1:0)],bone.name+'/'+k);}
assert.deepEqual(native.slots.map(s=>s.name),corrected.slots.map(s=>s.name));
for(const skin of corrected.skins)for(const [slotName,atts]of Object.entries(skin.attachments))for(const name of Object.keys(atts)){
 const arrays=[before,fixed].map(s=>{const slot=s.findSlot(slotName),a=s.data.findSkin(skin.name).getAttachment(slot.data.index,name);assert(a,skin.name+'/'+slotName+'/'+name);return verts(s,slot,a);});
 assert.equal(arrays[0].length,arrays[1].length);
 for(let i=0;i<arrays[0].length;i+=2)preservedGeometryMaxWorld=Math.max(preservedGeometryMaxWorld,Math.hypot(arrays[0][i]-arrays[1][i],arrays[0][i+1]-arrays[1][i+1]));
 const a=atts[name],n=native.skins.find(s=>s.name===skin.name).attachments[slotName][name];assert(n,skin.name+'/'+slotName+'/'+name);assert.equal(n.type||'region',a.type||'region');assert.equal(n.path||name,a.path||name);
 if(a.type==='mesh'){compareNumbers(a.vertices,n.vertices,name+'/vertices');compareNumbers(a.uvs,n.uvs,name+'/uvs');assert.deepEqual(unorderedTopology(n.triangles,3),unorderedTopology(a.triangles,3),name+'/triangles');assert.deepEqual(unorderedTopology(n.edges,2),unorderedTopology(a.edges,2),name+'/edges');}
 else if(!a.type||a.type==='region')for(const k of['x','y','rotation','scaleX','scaleY','width','height'])compareNumbers([a[k]??(k.startsWith('scale')?1:0)],[n[k]??(k.startsWith('scale')?1:0)],name+'/'+k);
 count++;
}
assert(preservedGeometryMaxWorld<.001);
const tests=[];
const scenarios=[['setup',null,0],['left-45','left_elbow',45],['left-minus45','left_elbow',-45],['right-45','right_elbow',45],['right-minus45','right_elbow',-45],['left-wrist-45','left_wrist',45],['right-wrist-45','right_wrist',45],['chest-15','chest',15],['chest-minus15','chest',-15]];
function area(v,t){const[a,b,c]=t.map(n=>n*2);return(v[b]-v[a])*(v[c+1]-v[a+1])-(v[b+1]-v[a+1])*(v[c]-v[a]);}
for(const skin of ['default','fs','idle','fs_idle']){
 fixed.setSkinByName(skin);fixed.setToSetupPose();fixed.updateWorldTransform();
 const baseline=new Map(fixed.slots.filter(s=>s.getAttachment()).map(s=>[s.data.name,verts(fixed,s,s.getAttachment())]));
 for(const[name,bone,degrees]of scenarios){
  fixed.setToSetupPose();if(bone)fixed.findBone(bone).rotation+=degrees;fixed.updateWorldTransform();
  let nonfinite=0,foldedTriangles=0,maxMovementWorld=0,sleeveMovementWorld=0;let activeAttachments=0;
  for(const slot of fixed.drawOrder){const a=slot.getAttachment();if(!a||!a.color.a)continue;activeAttachments++;const v=verts(fixed,slot,a),old=baseline.get(slot.data.name);
   for(let i=0;i<v.length;i+=2){if(!Number.isFinite(v[i])||!Number.isFinite(v[i+1]))nonfinite++;const move=Math.hypot(v[i]-old[i],v[i+1]-old[i+1]);maxMovementWorld=Math.max(maxMovementWorld,move);if(slot.data.name===(bone?.startsWith('left')?'left_sleeve':'right_sleeve'))sleeveMovementWorld=Math.max(sleeveMovementWorld,move);}
   if(a instanceof sp.MeshAttachment)for(let i=0;i<a.triangles.length;i+=3){const t=Array.from(a.triangles).slice(i,i+3);if(area(old,t)*area(v,t)<0)foldedTriangles++;}
  }
  assert.equal(nonfinite,0);if(bone?.endsWith('elbow'))assert(sleeveMovementWorld>1,'Sleeve must deform with forearm');
  tests.push({skin,pose:name,bone,degrees,activeAttachments,nonfinite,foldedTriangles,maxMovementWorld,sleeveMovementWorld});
 }
}
fixed.setToSetupPose();fixed.updateWorldTransform();
const pivots=['left','right'].map(side=>{const b=fixed.findBone(side+'_wrist'),n=native.bones.find(b=>b.name===side+'_wrist'),xy=[b.worldX/reg.scale+reg.virtualFeet[0],reg.virtualFeet[1]-b.worldY/reg.scale],target=reg.originalWristsPx[side];return{side,correctedLocal:[b.data.x,b.data.y],nativeExportLocal:[n.x||0,n.y||0],correctedArtworkPx:xy,targetArtworkPx:target,distancePx:Math.hypot(xy[0]-target[0],xy[1]-target[1])};});
for(const p of pivots)assert(p.distancePx<.02);
const report={result:'PASS_WITH_LIMITATIONS',source:'Corrected source parsed by official unmodified Spine 3.8 runtime; native export compared as raw data',
 nativeVersion:native.skeleton.spine,nativeProjectBytes:fs.statSync(path.join(ROOT,'character-a-p3.spine')).size,
 nativeProjectSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'character-a-p3.spine'))).digest('hex'),
 checkedAttachments:count,preservedGeometryMaxWorld,nativeMaxNumericDifference,nativeRuntimeError,
 exportPrecisionNote:'Native JSON export rounds coordinate fields; authoritative corrected setup and native project are also retained.',
 pivots,poseTests:tests,animations:0,missingTextureFiles:[],
 clippingCertified:false,editorWindowVerified:false,autoWeightPerformed:false,
 remaining:'Native Editor screenshots, Auto Weight/paint refinement and visual clipping certification remain pending. Native 3.8.75 export must be re-exported with a compatible newer 3.8 patch for this runtime.'};
fs.writeFileSync(path.join(QA,'roundtrip-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:report.result,nativeVersion:report.nativeVersion,nativeRuntimeError,checkedAttachments:count,preservedGeometryMaxWorld,nativeMaxNumericDifference,pivots,poseTests:tests.length,foldedTrianglesTotal:tests.reduce((n,t)=>n+t.foldedTriangles,0),animations:0},null,2));
