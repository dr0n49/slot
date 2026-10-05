/* Transfer Editor weights to the exact source setup geometry. No PNG or animation changes. */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'character-a-p3-setup.json')));
const native=JSON.parse(fs.readFileSync(process.argv[2]));
assert.equal(native.skeleton.spine,'3.8.75');
const meshes=['cape','chest','hood_back','hood_front','face_neck','left_sleeve','right_sleeve'];
const ctx={console,Float32Array,Int16Array,Uint16Array,Uint32Array,Array,Math};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,'vendor/spine-core-3.8.js'),'utf8'),ctx);
const sp=ctx.spine;
function region(p){const b=fs.readFileSync(path.join(ROOT,'layers',p+'.png')),w=b.readUInt32BE(16),h=b.readUInt32BE(20);return {u:0,v:0,u2:1,v2:1,rotate:false,width:w,height:h,originalWidth:w,originalHeight:h,offsetX:0,offsetY:0};}
const loader={newRegionAttachment(s,n,p){const a=new sp.RegionAttachment(n);a.setRegion(region(p));return a;},newMeshAttachment(s,n,p){const a=new sp.MeshAttachment(n);a.region=region(p);return a;}};
const rig=new sp.Skeleton(new sp.SkeletonJson(loader).readSkeletonData(source));rig.setToSetupPose();rig.updateWorldTransform();
const log=[];
for(const skinName of ['default','idle'])for(const name of meshes){
 const skin=source.skins.find(s=>s.name===skinName),mesh=skin.attachments[name][name];
 const reference=native.skins.find(s=>s.name==='default'||s.name==='BASE').attachments[name][name];
 assert.equal(mesh.type,'mesh');assert.equal(mesh.uvs.length,reference.uvs.length);
 assert(mesh.uvs.every((x,i)=>Math.abs(x-reference.uvs[i])<.00001),name+' vertex order');
 const slot=rig.findSlot(name),a=rig.data.findSkin(skinName).getAttachment(slot.data.index,name),world=new Float32Array(a.worldVerticesLength);
 a.computeWorldVertices(slot,0,world.length,world,0,2);
 const vertices=[];let offset=0;
 for(let i=0;i<world.length/2;i++){
  const count=reference.vertices[offset++],influences=[];let sum=0;
  for(let j=0;j<count;j++){const bone=reference.vertices[offset],weight=reference.vertices[offset+3];offset+=4;assert.equal(source.bones[bone].name,native.bones[bone].name);if(weight>0){influences.push({bone,weight});sum+=weight;}}
  assert(sum>0);vertices.push(influences.length);
  for(const influence of influences){const b=rig.bones[influence.bone],x=world[2*i]-b.worldX,y=world[2*i+1]-b.worldY,d=b.a*b.d-b.b*b.c;
   vertices.push(influence.bone,(x*b.d-y*b.b)/d,(y*b.a-x*b.c)/d,influence.weight/sum);
  }
 }
 assert.equal(offset,reference.vertices.length);
 log.push({skin:skinName,mesh:name,vertices:world.length/2,method:name==='right_sleeve'?'Editor Smooth (Auto failed)':'Editor Update Bindings + Auto',changed:JSON.stringify(mesh.vertices)!==JSON.stringify(vertices)});
 mesh.vertices=vertices;
}
for(const filename of ['character-a-setup.json','character-a-p3-setup.json'])fs.writeFileSync(path.join(ROOT,filename),JSON.stringify(source,null,2)+'\n');
// Spine Editor's implicit default skin is not selectable. Give its native copy
// an explicit BASE name so all four skins are selectable without collisions.
const editor=JSON.parse(JSON.stringify(source));editor.skins.find(s=>s.name==='default').name='BASE';
for(const skin of editor.skins)for(const atts of Object.values(skin.attachments))for(const a of Object.values(atts))if(a.skin==='default')a.skin='BASE';
fs.writeFileSync(path.join(ROOT,'character-a-p3-editor.json'),JSON.stringify(editor,null,2)+'\n');
fs.writeFileSync(path.join(ROOT,'qa/p3-0-fixed/editor-weight-transfer.json'),JSON.stringify({nativeVersion:'3.8.75',nativeSource:path.basename(process.argv[2]),editorBaseSkin:'BASE',runtimeBaseSkin:'default',meshes:log,animations:0},null,2)+'\n');
console.log(JSON.stringify({updatedMeshes:log.length,editorSkinNames:editor.skins.map(s=>s.name),animations:0},null,2));
