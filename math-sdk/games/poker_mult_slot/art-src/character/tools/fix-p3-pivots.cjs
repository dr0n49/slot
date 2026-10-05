/* P3-0 setup correction. Uses the unmodified Spine 3.8 runtime for binding
   transforms and validation. Adds no animations and does not alter PNGs. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const QA = path.join(ROOT, 'qa', 'p3-0-fixed');
const backupPath = path.join(ROOT, 'character-a-setup-backup.json');
const sourcePath = path.join(ROOT, 'character-a-setup.json');
const outputPath = path.join(ROOT, 'character-a-p3-setup.json');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const sourceBytes = fs.readFileSync(fs.existsSync(backupPath) ? backupPath : sourcePath);
const original = JSON.parse(sourceBytes);
const revised = JSON.parse(sourceBytes);
const registration = JSON.parse(fs.readFileSync(path.join(ROOT, 'source/layer-registration.json')));
const requested = {left_wrist: [-191.225, -253.891], right_wrist: [328.374, -10.508]};
const ctx = {console, Float32Array, Int16Array, Uint16Array, Uint32Array, Array, Math};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, 'vendor/spine-core-3.8.js'), 'utf8'), ctx);
const sp = ctx.spine;
const pngHashes = new Map();
function region(p) {
  const file = path.join(ROOT, 'layers', p + '.png');
  const png = fs.readFileSync(file);
  assert.equal(png.subarray(1, 4).toString(), 'PNG', file);
  pngHashes.set(p, hash(png));
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  return {u:0, v:0, u2:1, v2:1, rotate:false, width:w, height:h,
    originalWidth:w, originalHeight:h, offsetX:0, offsetY:0};
}
const loader = {
  newRegionAttachment(skin, name, p) {
    const a = new sp.RegionAttachment(name); a.setRegion(region(p)); return a;
  },
  newMeshAttachment(skin, name, p) {
    const a = new sp.MeshAttachment(name); a.region = region(p); return a;
  }
};
function skeleton(json) {
  const data = new sp.SkeletonJson(loader).readSkeletonData(json);
  const sk = new sp.Skeleton(data); sk.setToSetupPose(); sk.updateWorldTransform();
  return sk;
}
const before = skeleton(original);
for (const b of revised.bones) if (requested[b.name]) [b.x, b.y] = requested[b.name];
revised.skeleton.hash = 'muerta-reaper-a-p3-pivots';
const after = skeleton(revised);
const toWorld = (b, x, y) => [b.a*x + b.b*y + b.worldX, b.c*x + b.d*y + b.worldY];
function toLocal(b, x, y) {
  const det = b.a*b.d - b.b*b.c, dx=x-b.worldX, dy=y-b.worldY;
  assert(Math.abs(det)>1e-10, 'Noninvertible bone');
  return [(b.d*dx-b.b*dy)/det, (b.a*dy-b.c*dx)/det];
}
const round = n => +n.toFixed(7);
let compensatedRegions=0, updatedVertexBindings=0, meshesWithRestoredEdges=0,explicitRegionScales=0;
for (const skin of revised.skins) for (const [slotName, attachments] of Object.entries(skin.attachments)) {
  const slot = revised.slots.find(s => s.name === slotName);
  const oldBone=before.findBone(slot.bone), newBone=after.findBone(slot.bone);
  for (const [name,a] of Object.entries(attachments)) {
    if (!a.type || a.type==='region') {
      // Editor import takes region dimensions from the image. Express physical
      // size as image pixel dimensions plus an explicit scale, also valid in runtime.
      const image=region(a.path||name);
      a.scaleX=(a.scaleX??1)*(a.width/image.width);
      a.scaleY=(a.scaleY??1)*(a.height/image.height);
      a.width=image.width;a.height=image.height;explicitRegionScales++;
      if (Math.hypot(oldBone.worldX-newBone.worldX,oldBone.worldY-newBone.worldY)>1e-6) {
        // Only translations were changed, so rotation/scale remain untouched.
        for (const key of ['a','b','c','d']) assert(Math.abs(oldBone[key]-newBone[key])<1e-6);
        const p=toLocal(newBone,...toWorld(oldBone,a.x||0,a.y||0));
        a.x=round(p[0]); a.y=round(p[1]); compensatedRegions++;
      }
    } else if (a.type==='mesh') {
      if (a.vertices.length!==a.uvs.length) {
        for (let i=0;i<a.vertices.length;) {
          const count=a.vertices[i++];
          for (let j=0;j<count;j++,i+=4) {
            const index=a.vertices[i], old=before.bones[index], now=after.bones[index];
            if (Math.hypot(old.worldX-now.worldX,old.worldY-now.worldY)>1e-6) {
              const p=toLocal(now,...toWorld(old,a.vertices[i+1],a.vertices[i+2]));
              a.vertices[i+1]=round(p[0]); a.vertices[i+2]=round(p[1]); updatedVertexBindings++;
            }
          }
        }
      } else if (Math.hypot(oldBone.worldX-newBone.worldX,oldBone.worldY-newBone.worldY)>1e-6) {
        for(let i=0;i<a.vertices.length;i+=2) {
          const p=toLocal(newBone,...toWorld(oldBone,a.vertices[i],a.vertices[i+1]));
          a.vertices[i]=round(p[0]);a.vertices[i+1]=round(p[1]);updatedVertexBindings++;
        }
      }
      // Spine JSON nonessential edge indexes address the flattened XY array.
      // Preserve triangulation as editable internal edges during native import.
      const edges=new Set();
      for(let i=0;i<a.triangles.length;i+=3) {
        const t=a.triangles.slice(i,i+3);
        for(let j=0;j<3;j++) edges.add([Math.min(t[j],t[(j+1)%3]),Math.max(t[j],t[(j+1)%3])].join(','));
      }
      a.edges=[...edges].flatMap(e=>e.split(',').map(n=>Number(n)*2));
      meshesWithRestoredEdges++;
    }
  }
}
const final=skeleton(revised);
let maxGeometryDriftWorld=0, checkedAttachments=0;
function vertices(sk, skinName, slotName, name) {
  const slot=sk.findSlot(slotName),skin=sk.data.findSkin(skinName);
  const a=skin.getAttachment(slot.data.index,name);
  assert(a, `${skinName}/${slotName}/${name}`);
  if(a instanceof sp.RegionAttachment) {
    const out=new Float32Array(8);a.computeWorldVertices(slot.bone,out,0,2);return out;
  }
  if(a instanceof sp.MeshAttachment) {
    const out=new Float32Array(a.worldVerticesLength);
    a.computeWorldVertices(slot,0,a.worldVerticesLength,out,0,2);return out;
  }
  throw new Error('Unexpected attachment type');
}
for(const skin of revised.skins) for(const [slot,atts] of Object.entries(skin.attachments)) for(const name of Object.keys(atts)) {
  const old=vertices(before,skin.name,slot,name),now=vertices(final,skin.name,slot,name);
  assert.equal(old.length,now.length);
  for(let i=0;i<old.length;i+=2) maxGeometryDriftWorld=Math.max(maxGeometryDriftWorld,Math.hypot(old[i]-now[i],old[i+1]-now[i+1]));
  checkedAttachments++;
}
assert(maxGeometryDriftWorld<.001, `Setup geometry drift: ${maxGeometryDriftWorld}`);
const pivots=Object.entries(requested).map(([name,local])=>{
  const bone=final.findBone(name),side=name.split('_')[0],art=registration.originalWristsPx[side];
  const native=[bone.worldX/registration.scale+registration.virtualFeet[0],registration.virtualFeet[1]-bone.worldY/registration.scale];
  const distancePx=Math.hypot(native[0]-art[0],native[1]-art[1]);
  assert(distancePx<.002,`Artwork pivot mismatch: ${name}`);
  return {bone:name,local,nativeArtworkPx:native,targetArtworkPx:art,distancePx};
});
assert.equal(revised.bones.length,45);
assert.deepEqual(revised.ik,original.ik);
assert.deepEqual(revised.slots,original.slots);
assert.equal(Object.keys(revised.animations).length,0);
const changedBones=revised.bones.filter((b,i)=>JSON.stringify(b)!==JSON.stringify(original.bones[i])).map(b=>b.name);
assert.deepEqual(changedBones.sort(),Object.keys(requested).sort());
const meshes=[];
for(const skin of revised.skins) for(const [slot,atts] of Object.entries(skin.attachments)) for(const [name,a] of Object.entries(atts)) if(a.type==='mesh') {
  let i=0,n=0,maxSumError=0;const weights=[];
  while(i<a.vertices.length) {
    const count=a.vertices[i++];let sum=0;assert(Number.isInteger(count)&&count>0);
    for(let j=0;j<count;j++,i+=4) {
      const [index,x,y,w]=a.vertices.slice(i,i+4);
      assert(Number.isInteger(index)&&index>=0&&index<revised.bones.length);
      assert([x,y,w].every(Number.isFinite)&&w>=0);sum+=w;weights.push(w);
    }
    maxSumError=Math.max(maxSumError,Math.abs(sum-1));n++;
  }
  assert.equal(i,a.vertices.length);assert.equal(n,a.uvs.length/2);assert(maxSumError<1e-6);
  meshes.push({skin:skin.name,slot,name,vertices:n,maxWeightSumError:maxSumError});
}
fs.mkdirSync(QA,{recursive:true});
if(!fs.existsSync(backupPath)) fs.writeFileSync(backupPath,sourceBytes);
const output=JSON.stringify(revised,null,2)+'\n';
fs.writeFileSync(sourcePath,output);fs.writeFileSync(outputPath,output);
const report={revision:'P3-0-import-fix',method:'Direct JSON with official Spine 3.8 bind-transform compensation',
  bones:45,skins:revised.skins.map(s=>s.name),animations:0,changedBones,pivots,
  compensatedRegions,explicitRegionScales,updatedVertexBindings,meshesWithRestoredEdges,checkedAttachments,maxGeometryDriftWorld,
  meshStructuralValidation:meshes,textureFileSha256:Object.fromEntries(pngHashes),
  originalJsonSha256:hash(sourceBytes),correctedJsonSha256:hash(Buffer.from(output)),
  weights:'Original normalized influence values preserved. Spine Auto Weight and weight painting were not run.',
  editorWindowVerified:false,cliImportVerified:false,nativeScreenshots:false,result:'PASS'};
fs.writeFileSync(path.join(QA,'json-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({result:report.result,pivots,changedBones,compensatedRegions,updatedVertexBindings,
  checkedAttachments,maxGeometryDriftWorld,meshCount:meshes.length,animations:0},null,2));
