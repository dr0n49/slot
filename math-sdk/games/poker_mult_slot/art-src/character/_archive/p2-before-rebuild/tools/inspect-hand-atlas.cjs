const fs=require('fs'),path=require('path');
const sharp=require(process.env.MUERTA_SHARP||'/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
async function extract(side){
 const file=path.join(root,'source',`p2fix-hands-${side}-matched.png`),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,seen=new Int32Array(w*h),q=new Int32Array(w*h),parts=[];let tag=0;
 for(let p=0;p<w*h;p++){if(seen[p]||data[p*4+3]<8)continue;tag++;let a=0,b=1;q[0]=p;seen[p]=tag;let x0=w,y0=h,x1=0,y1=0,count=0;
  while(a<b){const z=q[a++],x=z%w,y=Math.floor(z/w);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);count++;for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(xx<0||yy<0||xx>=w||yy>=h)continue;const t=yy*w+xx;if(!seen[t]&&data[t*4+3]>=8){seen[t]=tag;q[b++]=t;}}}
  if(count>10000)parts.push({tag,x0:Math.max(0,x0-3),y0:Math.max(0,y0-3),x1:Math.min(w-1,x1+3),y1:Math.min(h-1,y1+3),count});
 }
 const sorted=parts.sort((a,b)=>a.y0-b.y0),rows=[sorted.slice(0,2).sort((a,b)=>a.x0-b.x0),sorted.slice(2,4).sort((a,b)=>a.x0-b.x0)].flat();if(rows.length!==4)throw Error('Expected four complete drawings: '+side);
 const names=['idle','card','point','open'];fs.mkdirSync(path.join(root,'source/p2fix-hand-parts'),{recursive:true});
 for(let i=0;i<4;i++){const p=rows[i];p.pose=names[i];p.crop={left:p.x0,top:p.y0,width:p.x1-p.x0+1,height:p.y1-p.y0+1};const out=Buffer.alloc(p.crop.width*p.crop.height*4);for(let y=p.y0;y<=p.y1;y++)for(let x=p.x0;x<=p.x1;x++){let belongs=seen[y*w+x]===p.tag;if(!seen[y*w+x]&&data[(y*w+x)*4+3]){for(let dy=-3;dy<=3&&!belongs;dy++)for(let dx=-3;dx<=3;dx++)if(x+dx>=0&&y+dy>=0&&x+dx<w&&y+dy<h&&seen[(y+dy)*w+x+dx]===p.tag){belongs=true;break;}}if(belongs){const z=((y-p.y0)*p.crop.width+x-p.x0)*4;data.copy(out,z,(y*w+x)*4,(y*w+x)*4+4);}}await sharp(out,{raw:{width:p.crop.width,height:p.crop.height,channels:4}}).png().toFile(path.join(root,'source/p2fix-hand-parts',`${side}-${names[i]}.png`));}
 return {side,source:[w,h],parts:rows};
}
async function main(){const out=await Promise.all(['left','right'].map(extract));fs.writeFileSync(path.join(root,'source/p2fix-hand-components.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));}
main().catch(e=>{console.error(e);process.exit(1)});
