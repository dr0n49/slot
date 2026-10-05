/* QA only. Official unmodified canvas runtime; temporary setup-relative poses. */
(async()=>{
 const json=await fetch('../character-a-p3-setup.json').then(r=>r.json()),reg=await fetch('../source/layer-registration.json').then(r=>r.json());
 const sampling=4,canvas=document.createElement('canvas');canvas.width=930*sampling;canvas.height=1691*sampling;
 const output=document.createElement('canvas');output.width=930;output.height=1691;document.body.append(output);const outputCtx=output.getContext('2d',{willReadFrequently:true});
 const ctx=canvas.getContext('2d'),regions={};
 const paths=new Set();for(const s of json.skins)for(const atts of Object.values(s.attachments))for(const[n,a]of Object.entries(atts))paths.add(a.path||n);
 await Promise.all([...paths].map(p=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const texture=new spine.canvas.CanvasTexture(img);const r={x:0,y:0,u:0,v:0,u2:1,v2:1,rotate:false,width:img.width,height:img.height,originalWidth:img.width,originalHeight:img.height,offsetX:0,offsetY:0,texture};r.renderObject=r;regions[p]=r;resolve();};img.onerror=()=>reject(Error(p));img.src='../layers/'+p+'.png';})));
 const loader={newRegionAttachment(s,n,p){const a=new spine.RegionAttachment(n);a.setRegion(regions[p]);return a;},newMeshAttachment(s,n,p){const a=new spine.MeshAttachment(n);a.region=regions[p];return a;}};
 const data=new spine.SkeletonJson(loader).readSkeletonData(json),rig=new spine.Skeleton(data),renderer=new spine.canvas.SkeletonRenderer(ctx);renderer.triangleRendering=true;
 function render({skin='default',rotations={},hidden=true,geometry=false,onlySlot=null}={}){
  rig.setSkinByName(skin);rig.setToSetupPose();for(const[name,degrees]of Object.entries(rotations))rig.findBone(name).rotation+=degrees;rig.updateWorldTransform();
  for(const slot of rig.slots)if(slot.data.name.endsWith('_underpaint')){
   if(hidden)rig.setAttachment(slot.data.name,slot.data.name);else if(!slot.data.name.includes('_gesture_'))slot.setAttachment(null);
   const a=slot.getAttachment();if(a&&slot.data.name.includes('_gesture_'))a.color.a=hidden?1:(skin.includes('idle')?1:0);
  }
  if(onlySlot)for(const s of rig.slots)if(s.data.name!==onlySlot)s.setAttachment(null);
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(sampling/reg.scale,0,0,-sampling/reg.scale,reg.virtualFeet[0]*sampling,reg.virtualFeet[1]*sampling);ctx.imageSmoothingEnabled=false;renderer.draw(rig);
  outputCtx.clearRect(0,0,930,1691);outputCtx.imageSmoothingEnabled=true;outputCtx.imageSmoothingQuality='high';outputCtx.drawImage(canvas,0,0,930,1691);
  const meshes=[];if(geometry)for(const slot of rig.slots){const a=slot.getAttachment();if(!a)continue;const mesh=a instanceof spine.MeshAttachment,world=new Float32Array(mesh?a.worldVerticesLength:8);if(mesh)a.computeWorldVertices(slot,0,world.length,world,0,2);else a.computeWorldVertices(slot.bone,world,0,2);
   const xy=Array.from(world,(v,i)=>i%2?reg.virtualFeet[1]-v/reg.scale:v/reg.scale+reg.virtualFeet[0]);meshes.push({slot:slot.data.name,name:a.name,path:a.path||a.name,mesh,xy,uvs:Array.from(a.uvs),triangles:mesh?Array.from(a.triangles):[0,1,2,2,3,0],alpha:a.color.a,texture:[a.region.width,a.region.height]});
  }
  return{png:output.toDataURL('image/png').split(',')[1],geometry:meshes,bones:rig.bones.length,animations:data.animations.length};
 }
 window.coverageQA={render,json,reg};document.documentElement.dataset.ready='true';
})().catch(e=>{document.documentElement.dataset.error=e.message;throw e;});
