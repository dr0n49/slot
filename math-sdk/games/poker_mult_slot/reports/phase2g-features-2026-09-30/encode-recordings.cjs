const fs=require('fs'),path=require('path'),{spawn}=require('child_process');
const root=__dirname;
function run(a){return new Promise((resolve,reject)=>{const p=spawn('/opt/homebrew/bin/ffmpeg',a);let e='';p.stderr.on('data',d=>e+=d);p.on('exit',c=>c?reject(e.slice(-1500)):resolve())})}
(async()=>{const manifest=[];for(const label of ['desktop','portrait']){
  const dir=path.join(root,label+'-frames'),frames=JSON.parse(fs.readFileSync(dir+'/frames.json'));
  const concat=frames.map((f,i)=>`file '${f.file}'\nduration ${Math.max(.02,(frames[i+1]?.t??f.t+.125)-f.t)}`).join('\n')+`\nfile '${frames.at(-1).file}'\n`;
  fs.writeFileSync(dir+'/real-time-concat.txt',concat);
  await run(['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',dir+'/real-time-concat.txt','-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-r','30','-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',root+'/'+label+'.mp4']);
  const seconds=frames.at(-1).t-frames[0].t,width=label==='desktop'?960:390;
  // A labelled preview edit: opening/first spins + the closing total.
  const end=Math.max(18,seconds-4);
  await run(['-hide_banner','-loglevel','error','-y','-i',root+'/'+label+'.mp4','-filter_complex',`[0:v]trim=0:18,setpts=PTS-STARTPTS[a];[0:v]trim=start=${end},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0,fps=15,scale=${width}:-1:flags=lanczos,split[c][d];[c]palettegen=stats_mode=diff[p];[d][p]paletteuse=dither=bayer:bayer_scale=3`,'-loop','0',root+'/'+label+'.gif']);
  manifest.push({file:label+'.mp4',seconds,sourceFrames:frames.length,note:'Full silent feature; actual CDP intervals resampled to 30 fps. GIF is an edited preview: first 18 s plus final 4 s. This recording is not an FPS measurement.'});console.log('encoded',label,seconds);
}fs.writeFileSync(root+'/recording-manifest.json',JSON.stringify(manifest,null,2))})().catch(e=>{console.error(e);process.exit(1)});
