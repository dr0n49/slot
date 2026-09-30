// Validate PCM masters, build a listening reel and test the real 600-second loop.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=__dirname,ff='/opt/homebrew/bin/ffmpeg',sr=48000,out=path.join(root,'auditions');
const run=a=>{const r=cp.spawnSync(ff,['-hide_banner','-nostdin',...a],{maxBuffer:250*1024*1024});if(r.status)throw Error(r.stderr.toString().slice(-2000));return r;};
const probe=p=>JSON.parse(cp.execFileSync('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','stream=codec_name,sample_rate,channels,bits_per_raw_sample,duration_ts,time_base','-of','json',p])).streams[0];
const report=JSON.parse(fs.readFileSync(root+'/verification.json')),reel=new Float32Array(Math.round(37.8*sr)*2),offsets={spin_press:0,reel_stop_0:1,win_normal:2,big_nice:3.5,bonus_trigger:5.4,music_base:7.8};
for(const c of report.cues){
  const p=path.join(root,c.file),stream=probe(p);c.pcmProbe=stream;
  if(stream.codec_name!=='pcm_s24le'||Number(stream.sample_rate)!==sr||Number(stream.bits_per_raw_sample)!==24||stream.channels!==c.channels||Number(stream.duration_ts)!==c.expectedFrames)throw Error('PCM contract '+c.id);
  const peakMatch=c.target.match(/sample peak−([\d.]+)/),lufsMatch=c.target.match(/−([\d.]+) LUFS-I/),tpMatch=c.target.match(/TP≤−([\d.]+) dBTP/);
  c.masterTargetPassed=peakMatch?Math.abs(c.samplePeakDbfs+Number(peakMatch[1]))<.1:Math.abs(Number(c.lufsIntegrated)+Number(lufsMatch[1]))<=.1&&Number(c.truePeakDbtp)<=-Number(tpMatch[1]);
  if(!c.masterTargetPassed)throw Error('master target '+c.id);
  const b=run(['-i',p,'-ar',String(sr),'-ac','2','-f','f32le','pipe:1']).stdout,a=new Float32Array(b.buffer,b.byteOffset,b.byteLength/4),start=Math.round(offsets[c.id]*sr)*2,count=Math.min(a.length,reel.length-start);
  reel.set(a.subarray(0,count),start);
}
const raw=Buffer.from(reel.buffer);
// Keep the media write explicit so spawnSync receives the actual mixed PCM.
let r=cp.spawnSync(ff,['-hide_banner','-nostdin','-y','-f','f32le','-ar',String(sr),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',out+'/six-sample-reel.wav'],{input:raw,maxBuffer:4*1024*1024});if(r.status)throw Error(r.stderr.toString());
run(['-y','-i',out+'/six-sample-reel.wav','-c:a','libmp3lame','-b:a','192k',out+'/six-sample-reel.mp3']);
const temporary='/private/tmp/muerta-cc0-base-10m.wav';
run(['-y','-stream_loop','-1','-i',out+'/music_base.wav','-t','600','-c:a','pcm_s24le',temporary]);
const meter=run(['-i',temporary,'-af','loudnorm=I=-24:TP=-3:LRA=7:print_format=json','-f','null','-']).stderr.toString(),metrics=JSON.parse(meter.match(/\{\s*"input_i"[\s\S]*?\}/)[0]);
const b=run(['-i',temporary,'-f','f32le','pipe:1']).stdout,a=new Float32Array(b.buffer,b.byteOffset,b.byteLength/4),frames=a.length/2,seamFrames=1843200,wraps=[];
for(let n=seamFrames;n<frames;n+=seamFrames)wraps.push({frame:n,leftDelta:Math.abs(a[n*2]-a[(n-1)*2]),rightDelta:Math.abs(a[n*2+1]-a[(n-1)*2+1])});
report.loopTest={seconds:600,frames,expectedFrames:28800000,wraps:wraps.length,maxSeamDelta:Math.max(...wraps.flatMap(w=>[w.leftDelta,w.rightDelta])),lufsIntegrated:metrics.input_i,truePeakDbtp:metrics.input_tp,numericalPassed:frames===28800000&&Math.abs(Number(metrics.input_i)+24)<.15&&Number(metrics.input_tp)<=-3,headphoneAndPhoneListening:'pending user review; no claim of audible acceptance'};
if(!report.loopTest.numericalPassed)throw Error('600-second loop');
// The seam excerpt straddles the real PCM wrap, without a crossfade.
run(['-y','-i',temporary,'-ss','37.4','-t','2','-c:a','libmp3lame','-b:a','192k',out+'/music_base-seam.mp3']);
report.listeningReel={file:'auditions/six-sample-reel.mp3',seconds:37.8,offsets};
fs.writeFileSync(root+'/verification.json',JSON.stringify(report,null,2));
fs.unlinkSync(temporary);
console.log(JSON.stringify({allSixMasterTargetsPassed:report.cues.every(c=>c.masterTargetPassed),loopTest:report.loopTest,listeningReel:report.listeningReel},null,2));
