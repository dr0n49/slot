/* Standalone static QA viewer. No animation state or timelines; not game code. */
(async()=>{
const [json,reg]=await Promise.all([fetch('../character-a-setup.json',{cache:'no-store'}).then(r=>r.json()),fetch('../source/layer-registration.json',{cache:'no-store'}).then(r=>r.json())]);
const canvas=document.getElementById('rig'),overlay=document.getElementById('bones'),cx=overlay.getContext('2d');
const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL unavailable');
const vs=`attribute vec2 p;attribute vec2 uv;varying vec2 t;uniform vec2 viewport;uniform vec4 camera;void main(){vec2 q=vec2((p.x-camera.x)*camera.z+camera.w,(camera.y-p.y)*camera.z+20.);gl_Position=vec4(q.x/viewport.x*2.-1.,1.-q.y/viewport.y*2.,0,1);t=uv;}`;
const fs=`precision mediump float;varying vec2 t;uniform sampler2D image;uniform float alpha;void main(){vec4 c=texture2D(image,t);gl_FragColor=vec4(c.rgb,c.a*alpha);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const attrs={p:gl.getAttribLocation(program,'p'),uv:gl.getAttribLocation(program,'uv')};const posBuffer=gl.createBuffer(),uvBuffer=gl.createBuffer(),idxBuffer=gl.createBuffer();
const loc={camera:gl.getUniformLocation(program,'camera'),viewport:gl.getUniformLocation(program,'viewport'),alpha:gl.getUniformLocation(program,'alpha')};
const imgs={};await Promise.all(reg.parts.flatMap(s=>['','fs/'].map(sub=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{imgs[sub+s.name]=img;resolve();};img.onerror=()=>reject(Error('PNG failed: '+sub+s.name));img.src='../layers/'+sub+s.name+'.png';}))));
const regions={};for(const [name,img] of Object.entries(imgs)){const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);regions[name]={texture,u:0,v:0,u2:1,v2:1,rotate:false,width:img.width,height:img.height,originalWidth:img.width,originalHeight:img.height,offsetX:0,offsetY:0};}
const loader={newRegionAttachment(skin,name,p){const a=new spine.RegionAttachment(name);a.setRegion(regions[p]);return a;},newMeshAttachment(skin,name,p){const a=new spine.MeshAttachment(name);a.region=regions[p];return a;}};
const data=new spine.SkeletonJson(loader).readSkeletonData(json),skel=new spine.Skeleton(data);
const k=.32,minX=json.skeleton.x,maxY=json.skeleton.y+json.skeleton.height,left=225;
const toPixel=(x,y)=>[(x-minX)*k+left,(maxY-y)*k+20];
function pose(name){
 skel.setSkinByName(document.getElementById('skin').value);skel.setToSetupPose();
 if(name!=='deck'){for(const side of ['left','right'])skel.setAttachment(side+'_hand',side+'_hand_'+name);skel.setAttachment('deck',null);}
 const test=document.getElementById('jointTest').value;
 const match=test.match(/^(left|right)_(elbow|shoulder|wrist)_(plus|minus)(\d+)$/);
 if(match){skel.findBone(match[1]+'_'+match[2]).rotation+=(match[3]==='plus'?1:-1)*Number(match[4]);skel.setAttachment('deck',null);}
 else if(test==='pointGesture'){
   const target=skel.findBone('right_ik');target.x=(1200-reg.virtualFeet[0])*reg.scale;target.y=(reg.virtualFeet[1]-735)*reg.scale;skel.findIkConstraint('right_arm_ik').mix=1;skel.setAttachment('right_hand','right_hand_point');skel.setAttachment('deck',null);
   skel.updateWorldTransform();skel.findBone('right_hand').rotation=-skel.findBone('right_wrist').getWorldRotationX();
 } else if(test==='overlap'){
   skel.findBone('head').rotation+=4;skel.findBone('hood_left').rotation+=5;skel.findBone('cape_left').rotation+=4;
   skel.findBone('left_arm').rotation-=7;skel.findBone('right_arm').rotation+=6;skel.setAttachment('deck',null);skel.setAttachment('right_hand','right_hand_open');
 }
 if(document.getElementById('eyes').checked){skel.setAttachment('left_eye_glow','left_eye_glow');skel.setAttachment('right_eye_glow','right_eye_glow');}
 skel.updateWorldTransform();
}
function draw(onlySlots=null){
 pose(document.getElementById('pose').value);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.enable(gl.BLEND);gl.uniform2f(loc.viewport,canvas.width,canvas.height);gl.uniform4f(loc.camera,minX,maxY,k,left);cx.clearRect(0,0,overlay.width,overlay.height);
 let triangles=0,verticesOutsideViewport=0;
 for(const slot of skel.drawOrder){if(onlySlots&&!onlySlots.includes(slot.data.name))continue;const a=slot.getAttachment();if(!a)continue;let v,uv,tri;
 if(a instanceof spine.MeshAttachment){v=new Float32Array(a.worldVerticesLength);a.computeWorldVertices(slot,0,a.worldVerticesLength,v,0,2);uv=a.uvs;tri=a.triangles;}
 else if(a instanceof spine.RegionAttachment){v=new Float32Array(8);a.computeWorldVertices(slot.bone,v,0,2);uv=a.uvs;tri=[0,1,2,2,3,0];}else continue;
 for(let j=0;j<v.length;j+=2){const q=toPixel(v[j],v[j+1]);if(q[0]<0||q[0]>canvas.width||q[1]<0||q[1]>canvas.height)verticesOutsideViewport++;}
 gl.bindBuffer(gl.ARRAY_BUFFER,posBuffer);gl.bufferData(gl.ARRAY_BUFFER,v,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(attrs.p);gl.vertexAttribPointer(attrs.p,2,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(uv),gl.STATIC_DRAW);gl.enableVertexAttribArray(attrs.uv);gl.vertexAttribPointer(attrs.uv,2,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,idxBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(tri),gl.STATIC_DRAW);gl.bindTexture(gl.TEXTURE_2D,a.region.texture);gl.uniform1f(loc.alpha,slot.color.a*a.color.a);gl.blendFuncSeparate(gl.SRC_ALPHA,slot.data.blendMode===spine.BlendMode.Additive?gl.ONE:gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.drawElements(gl.TRIANGLES,tri.length,gl.UNSIGNED_SHORT,0);triangles+=tri.length/3;
 if(document.getElementById('showMesh').checked&&a instanceof spine.MeshAttachment){cx.strokeStyle='#a8ffe155';cx.lineWidth=.5;for(let j=0;j<tri.length;j+=3){cx.beginPath();for(let q=0;q<3;q++){const idx=tri[j+q]*2,p=toPixel(v[idx],v[idx+1]);q?cx.lineTo(...p):cx.moveTo(...p);}cx.closePath();cx.stroke();}}
 }
 if(document.getElementById('showBones').checked){cx.font='11px system-ui';for(const b of skel.bones){const p=toPixel(b.worldX,b.worldY);if(b.parent){const pp=toPixel(b.parent.worldX,b.parent.worldY);cx.strokeStyle='#6ae5dd';cx.beginPath();cx.moveTo(...pp);cx.lineTo(...p);cx.stroke();}cx.fillStyle='#ffce66';cx.beginPath();cx.arc(...p,3,0,Math.PI*2);cx.fill();cx.fillText(b.data.name,p[0]+5,p[1]-3);}}
 if(document.getElementById('showPivots').checked){cx.font='16px system-ui';const names=['left_shoulder','left_elbow','left_wrist','right_shoulder','right_elbow','right_wrist','marigold','ribbon_left','ribbon_right'];names.forEach((n,i)=>{const b=skel.findBone(n),p=toPixel(b.worldX,b.worldY);cx.strokeStyle='#ffe768';cx.lineWidth=2;cx.beginPath();cx.moveTo(p[0]-9,p[1]);cx.lineTo(p[0]+9,p[1]);cx.moveTo(p[0],p[1]-9);cx.lineTo(p[0],p[1]+9);cx.stroke();const dx=i===7?-20:12,dy=i===8?18:-7;cx.strokeStyle='#171717';cx.lineWidth=4;cx.strokeText(String(i+1),p[0]+dx,p[1]+dy);cx.fillStyle='#fff8de';cx.fillText(String(i+1),p[0]+dx,p[1]+dy);cx.fillText(`${i+1}. ${n}`,150+(i>=5?400:0),970+(i%5)*28);});}
 document.getElementById('status').textContent=`${data.bones.length} костей · ${reg.parts.filter(p=>p.soft).length} сеток · ${triangles} треугольников · ${data.animations.length} анимаций`;
 return {pose:document.getElementById('pose').value,test:document.getElementById('jointTest').value,skin:document.getElementById('skin').value,triangles,verticesOutsideViewport,error:gl.getError(),wrists:Object.fromEntries(['left','right'].map(s=>{const b=skel.findBone(s+'_wrist');return [s,{local:[b.x,b.y],world:[b.worldX,b.worldY]}];}))};
}
for(const id of ['pose','skin','jointTest','showBones','showMesh','showPivots','eyes'])document.getElementById(id).onchange=()=>draw();
for(const s of reg.parts){const card=document.createElement('div');card.className='piece';card.innerHTML=`<img src="../layers/${s.name}.png" alt="${s.name}"><span>${s.name}</span><span>${s.w} × ${s.h} · ${s.soft?'mesh':'rigid / swap'}</span>`;document.getElementById('layers').appendChild(card);}
function overlap(a,b){const masks=[];for(const slots of [a,b]){draw(slots);const rgba=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,rgba);masks.push(rgba);}let pixels=0;for(let i=3;i<masks[0].length;i+=4)if(masks[0][i]>=128&&masks[1][i]>=128)pixels++;draw();return {pixels,scale:k,source:'PNG alpha rendered by official Spine 3.8 geometry'};}
window.rigReview={draw,overlap,skel,reg,data,capture:()=>canvas.toDataURL('image/png')};draw();document.documentElement.dataset.ready='true';
})().catch(e=>{document.getElementById('status').textContent=e.stack;console.error(e);});
