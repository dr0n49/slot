// Vector conversion of the approved generated corner: contour paths, no embedded raster.
// Long rails are rebuilt separately, so their diagonal ornament is not carried into the UI.
const fs=require('node:fs');
const sharp=require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const source=__dirname+'/../phase2b-frame-2026-09-30/sources/frame.png';
function contours(mask,w,h){const edges=[],from=new Map();const add=(x,y,xx,yy,d)=>{const e={a:y*(w+1)+x,b:yy*(w+1)+xx,d,used:false};edges.push(e);if(!from.has(e.a))from.set(e.a,[]);from.get(e.a).push(e)};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){if(!y||!mask[(y-1)*w+x])add(x,y,x+1,y,0);if(x===w-1||!mask[y*w+x+1])add(x+1,y,x+1,y+1,1);if(y===h-1||!mask[(y+1)*w+x])add(x+1,y+1,x,y+1,2);if(!x||!mask[y*w+x-1])add(x,y+1,x,y,3)}
 const all=[];for(const start of edges){if(start.used)continue;const points=[];let edge=start;do{edge.used=true;points.push([edge.a%(w+1),Math.floor(edge.a/(w+1))]);if(edge.b===start.a)break;const options=(from.get(edge.b)||[]).filter(e=>!e.used),rank=d=>[1,0,3,2].indexOf((d-edge.d+4)%4);options.sort((a,b)=>rank(a.d)-rank(b.d));edge=options[0];}while(edge&&!edge.used);if(points.length>=4){let area=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1]}if(Math.abs(area)>3)all.push(points)}}return all;}
function simplify(p,eps=.36){if(p.length<4)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy;let max=0,at=0;
 for(let i=1;i<p.length-1;i++){const q=p[i],t=den?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den)):0,dist=Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);if(dist>max){max=dist;at=i}}
 return max>eps?[...simplify(p.slice(0,at+1),eps).slice(0,-1),...simplify(p.slice(at),eps)]:[a,b];}
async function main(){const crop={left:34,top:37,width:207,height:209};const {data,info}=await sharp(source).extract(crop).ensureAlpha().raw().toBuffer({resolveWithObject:true});const paths=[];
 for(const [i,threshold]of [45,65,85,105,130,160,190,215].entries()){const mask=new Uint8Array(info.width*info.height);let rsum=0,gsum=0,bsum=0,n=0;
  for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const q=(y*info.width+x)*4,r=data[q],g=data[q+1],b=data[q+2],a=data[q+3],l=.2126*r+.7152*g+.0722*b;
   // Remove the outer seam from this corner crop; it is supplied by the vector rails.
   if(x>=9&&y>=7&&a>180&&r>g*1.025&&g>b*1.07&&l>=threshold){mask[y*info.width+x]=1;if(l<threshold+25){rsum+=r;gsum+=g;bsum+=b;n++}}}
  const cs=contours(mask,info.width,info.height),d=cs.map(c=>{const s=simplify([...c,c[0]]);return 'M'+s.map(q=>q.join(' ')).join('L')+'Z'}).join('');const color=n?'#'+[rsum,gsum,bsum].map(v=>Math.round(v/n).toString(16).padStart(2,'0')).join(''):['#5c452b','#765737','#947148','#b18b5c','#c7a675','#dfc28d','#efdab1','#f8e9c9'][i];paths.push({threshold,color,d,contours:cs.length});}
 const result={source:'reports/phase2b-frame-2026-09-30/sources/frame.png',crop,method:'Eight nested chromatic contour layers, simplified closed polygons; no raster embedded in resulting frame.',paths};fs.writeFileSync(__dirname+'/review-1d/frame-corner-paths.json',JSON.stringify(result,null,2)+'\n');console.log({layers:paths.length,contours:paths.reduce((s,p)=>s+p.contours,0)});
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
