/* Checks source clipping and PNG export metadata; does not modify artwork. */
const fs = require('fs');
const path = require('path');
const sharp = require(process.env.MUERTA_SHARP || '/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const ROOT = path.resolve(__dirname, '..');
const registration=JSON.parse(fs.readFileSync(path.join(ROOT,'source/layer-registration.json'),'utf8'));
const errors = [];
async function pixels(file) {
  return sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
}
async function affineBounds(file, src, dst) {
  const {data, info} = await pixels(path.join(ROOT, 'source', file));
  const [p,q,r]=src,[a,b,c]=dst,ux=q[0]-p[0],uy=q[1]-p[1],vx=r[0]-p[0],vy=r[1]-p[1],det=ux*vy-uy*vx;
  const dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1];
  const m00=(dx*vy-ex*uy)/det,m01=(-dx*vx+ex*ux)/det,m10=(dy*vy-ey*uy)/det,m11=(-dy*vx+ey*ux)/det;
  const tx=a[0]-m00*p[0]-m01*p[1],ty=a[1]-m10*p[0]-m11*p[1];
  let bounds=[Infinity,Infinity,-Infinity,-Infinity],outside=0,total=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++) {
    if(data[(y*info.width+x)*4+3]<32)continue;
    const xx=m00*x+m01*y+tx,yy=m10*x+m11*y+ty;
    bounds=[Math.min(bounds[0],xx),Math.min(bounds[1],yy),Math.max(bounds[2],xx),Math.max(bounds[3],yy)];
    total++;if(xx<0||yy<0||xx>=948||yy>=1659)outside++;
  }
  if(outside)errors.push(`${file}: ${outside} opaque source pixels clipped`);
  return {file,source:[info.width,info.height],registeredBounds:bounds.map(n=>+n.toFixed(3)),alphaThreshold:32,outside,total};
}
async function main() {
  const sleeves=[];
  for(const file of ['left-sleeve-underpaint.png','left-sleeve-fs.png'])sleeves.push(await affineBounds(file,[[485,170],[585,810],[410,1410]],[[307,675],[272,1020],[104,1307]]));
  for(const file of ['right-sleeve-final.png','right-sleeve-fs.png'])sleeves.push(await affineBounds(file,[[568,207],[873,806],[278,1280]],[[750,690],[830,989],[736,1200]]));
  const files=['character-a-master.png','character-a-fs.png',...fs.readdirSync(path.join(ROOT,'layers')).filter(n=>n.endsWith('.png')).map(n=>'layers/'+n),...fs.readdirSync(path.join(ROOT,'layers/fs')).filter(n=>n.endsWith('.png')).map(n=>'layers/fs/'+n)];
  const exports=[];
  for(const file of files) {
    const m=await sharp(path.join(ROOT,file)).metadata();
    if(m.space!=='srgb'||!m.hasAlpha)errors.push(`${file}: expected sRGB + alpha`);
    const {data,info}=await pixels(path.join(ROOT,file));let x0=info.width,y0=info.height,x1=-1,y1=-1;
    for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    const margins=[x0,y0,info.width-1-x1,info.height-1-y1];
    const part=registration.parts.find(s=>s.name===path.basename(file,'.png'));
    if(file.startsWith('layers/')&&!part?.canvas&&margins.some(n=>n!==0))errors.push(`${file}: export is not tight-trimmed`);
    if(!file.startsWith('layers/')&&margins.some(n=>n<40))errors.push(`${file}: master protective margin < 40px`);
    exports.push({file,size:[m.width,m.height],space:m.space,icc:!!m.icc,alpha:m.hasAlpha,margins,registrationCanvas:part?.canvas??null});
  }
  const sources=[];
  for(const file of fs.readdirSync(path.join(ROOT,'source')).filter(n=>n.endsWith('.png')).sort()) {
    const m=await sharp(path.join(ROOT,'source',file)).metadata();sources.push({file,size:[m.width,m.height],alpha:m.hasAlpha});
  }
  const report={result:errors.length?'FAIL':'PASS',errors,sleeves,exports,sources};
  fs.writeFileSync(path.join(ROOT,'qa/artwork-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({result:report.result,errors,sleeves,pngs:exports.length,sources:sources.length},null,2));
  if(errors.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1)});
