'use strict';
// Original Muerta Poker audition. Every sound is locally synthesized/modelled.
// No provider music, recordings, stock loops or artist reference material.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const DIR = __dirname, SR = 48000, BPM = 100, SECONDS = 30;
const FRAMES = SR * SECONDS, BEAT = 60 / BPM;
const left = new Float64Array(FRAMES), right = new Float64Array(FRAMES);
const events = [];
let seed = 0x4d554552;
function random() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }
function hz(midi) { return 440 * 2 ** ((midi - 69) / 12); }
const names = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
function noteName(midi) { return names[midi % 12] + (Math.floor(midi / 12) - 1); }
function event(voice, beat, duration, notes, gain, pan) {
  events.push({ voice, beat, startSeconds: +(beat * BEAT).toFixed(6), durationSeconds: duration, notes: notes.map(noteName), midi: notes, frequenciesHz: notes.map(hz), gain, pan });
}
function add(wave, beat, gain, pan, voice, notes = []) {
  const start = Math.round(beat * BEAT * SR);
  const l = Math.cos((pan + 1) * Math.PI / 4), r = Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < wave.length && start + i < FRAMES; i++) {
    if (start + i >= 0) { left[start + i] += wave[i] * gain * l; right[start + i] += wave[i] * gain * r; }
  }
  event(voice, beat, wave.length / SR, notes, gain, pan);
}
function pluck(midi, length = 1.7, muted = true) {
  const frequency = hz(midi), period = SR / frequency - 0.5;
  const n = Math.floor(period), fraction = period - n, size = n + 2;
  const delay = new Float64Array(size), wave = new Float64Array(Math.round(length * SR));
  let avg = 0, low = 0;
  for (let i = 0; i < size; i++) { low = 0.35 * (random() * 2 - 1) + 0.65 * low; delay[i] = low; avg += low; }
  avg /= size; for (let i = 0; i < size; i++) delay[i] -= avg;
  let cursor = 0, previousDelayed = 0, bodyLow = 0, dc = 0, peak = 0;
  const damping = muted ? 0.9968 : 0.9988;
  for (let i = 0; i < wave.length; i++) {
    const a = (cursor - n + size) % size, b = (cursor - n - 1 + size) % size;
    const delayed = delay[a] * (1 - fraction) + delay[b] * fraction;
    const next = (delayed + previousDelayed) * 0.5 * damping;
    previousDelayed = delayed; delay[cursor] = next; cursor = (cursor + 1) % size;
    bodyLow += 0.16 * (next - bodyLow); dc += 0.002 * (bodyLow - dc);
    const t = i / SR;
    const attack = Math.min(1, t / 0.0025), release = Math.min(1, (length - t) / 0.08);
    const v = (bodyLow - dc) * attack * release * Math.exp(-t / (muted ? 1.0 : 1.65));
    wave[i] = v; peak = Math.max(peak, Math.abs(v));
  }
  if (peak) for (let i = 0; i < wave.length; i++) wave[i] *= 0.8 / peak;
  return wave;
}
function modal(midi, length, modes, decays) {
  const wave = new Float64Array(Math.round(length * SR));
  for (let i = 0; i < wave.length; i++) {
    const t = i / SR, attack = Math.min(1, t / 0.002);
    let v = 0; for (let j = 0; j < modes.length; j++) v += Math.sin(2 * Math.PI * hz(midi) * modes[j][0] * t) * modes[j][1] * Math.exp(-t / decays[j]);
    wave[i] = v * attack * Math.min(1, (length - t) / 0.03);
  }
  return wave;
}
function brush(length, frame) {
  const wave = new Float64Array(Math.round(length * SR)); let soft = 0, slow = 0;
  for (let i = 0; i < wave.length; i++) {
    const t = i / SR; soft += 0.42 * (random() * 2 - 1 - soft); slow += 0.018 * (soft - slow);
    const e = (1 - Math.exp(-t / 0.009)) * Math.exp(-t / (frame ? 0.075 : 0.035));
    const skin = frame ? Math.sin(2 * Math.PI * hz(38) * t) * Math.exp(-t / 0.085) * 0.15 : 0;
    wave[i] = ((soft - slow) * 0.6 * e + skin) * Math.min(1, (length - t) / 0.02);
  }
  return wave;
}
function bone(length, low) {
  const wave = new Float64Array(Math.round(length * SR));
  for (let i = 0; i < wave.length; i++) {
    const t = i / SR, attack = Math.min(1, t / 0.0008);
    wave[i] = attack * (Math.sin(2 * Math.PI * low * t) * Math.exp(-t / 0.014) * 0.52 + Math.sin(2 * Math.PI * low * 2.38 * t) * Math.exp(-t / 0.01) * 0.13) * Math.min(1, (length - t) / 0.008);
  }
  return wave;
}
function brass(midi, length) {
  const wave = new Float64Array(Math.round(length * SR)); let warm = 0;
  for (let i = 0; i < wave.length; i++) {
    const t = i / SR, f = hz(midi);
    const breath = Math.min(1, t / 0.09) * Math.min(1, (length - t) / 0.26) * Math.exp(-t / 0.85);
    const horn = Math.sin(2 * Math.PI * f * t) * 0.65 + Math.sin(4 * Math.PI * f * t) * 0.20 + Math.sin(6 * Math.PI * f * t) * 0.08 + Math.sin(10 * Math.PI * f * t) * 0.025;
    warm += 0.12 * (Math.tanh(horn * 0.85) - warm); wave[i] = warm * breath;
  }
  return wave;
}
// A settled, quiet 4-bar accompaniment, varied once and returned to D minor.
const chords = [
  [50,57,62,65], [50,57,60,65], [46,53,57,62], [50,57,64,65],
  [45,52,55,60], [50,57,62,65], [48,55,62,64], [50,57,60,65],
  [50,57,62,65], [50,57,60,65], [46,53,57,62], [50,57,64,65], [50,57,62,65],
];
for (let bar = 0; bar < chords.length; bar++) {
  const c = chords[bar], b = bar * 4;
  for (const [offset, index, gain] of [[0,0,0.091],[0.5,1,0.052],[1.5,2,0.055],[2,0,0.065],[2.75,3,0.043],[3.5,1,0.050]]) {
    if (b + offset >= 50) continue;
    add(pluck(c[index], index ? 1.4 : 1.9, true), b + offset, gain * (0.96 + random() * 0.08), -0.18, 'nylon accompaniment', [c[index]]);
  }
  for (const offset of [0, 2]) if (b + offset < 50) add(brush(0.3, true), b + offset, 0.10, 0.03, 'brushed frame drum');
  for (const offset of [0.5,1.5,2.5,3.5]) if (b + offset < 50) add(brush(0.14, false), b + offset, (offset === 1.5 ? 0.026 : 0.019), 0.30, 'soft dry shaker');
  if (bar % 2 === 1) for (const offset of [1,3]) if (b + offset < 50) add(bone(0.07, 680 + random() * 85), b + offset, 0.035, -0.08, 'bone and wood contact');
}
// The exact D–A–C–D identity, programmed as three sparse phrases at 0,9.6,19.2s.
for (const phrase of [0,16,32]) {
  const notes = [62,69,72,74], offsets = [0,1,2.5,3.5], gains = [0.085,0.074,0.071,0.077];
  for (let i = 0; i < notes.length; i++) add(pluck(notes[i], 2.1, false), phrase + offsets[i], gains[i], 0.09, 'nylon D-A-C-D motif', [notes[i]]);
  add(modal(74, 0.8, [[1,0.42],[2.01,0.1],[3.93,0.026],[5.4,0.009]], [0.24,0.15,0.09,0.055]), phrase + 3.5, 0.019, 0.22, 'damped warm bell', [74]);
}
for (const [beat, midi] of [[4,38],[20,45],[36,38]]) add(brass(midi,1.15),beat,0.032,-0.02,'low muted brass',[midi]);
// Small room reflections from this original mix only; no long cinematic wash.
for (let i = FRAMES - 1; i >= 0; i--) {
  const l = i >= 1931 ? left[i-1931]*0.045 : 0, r = i >= 2387 ? right[i-2387]*0.04 : 0;
  left[i] += r; right[i] += l;
}
let dcL = 0, dcR = 0, peak = 0;
for (let i = 0; i < FRAMES; i++) {
  dcL += 0.001 * (left[i] - dcL); dcR += 0.001 * (right[i] - dcR);
  const fade = Math.min(1, i / (SR * 0.008), (FRAMES - 1 - i) / (SR * 0.07));
  left[i] = (left[i] - dcL) * fade; right[i] = (right[i] - dcR) * fade;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
function wavFloat32(file, l, r, gain = 1) {
  const bytes = FRAMES * 8, buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF',0);buf.writeUInt32LE(bytes+36,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(3,20);buf.writeUInt16LE(2,22);buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*8,28);buf.writeUInt16LE(8,32);buf.writeUInt16LE(32,34);buf.write('data',36);buf.writeUInt32LE(bytes,40);
  for(let i=0;i<FRAMES;i++){buf.writeFloatLE(l[i]*gain,44+i*8);buf.writeFloatLE(r[i]*gain,48+i*8);}
  fs.writeFileSync(file,buf);return crypto.createHash('sha256').update(buf).digest('hex');
}
const source = path.join(DIR,'samples/originals/music_base.local-original.wav');
const master = path.join(DIR,'samples/masters/music_base.wav');
const audition = path.join(DIR,'samples/auditions/music_base.mp3');
const sourceHash = wavFloat32(source,left,right,0.4/peak);
function execute(exe,args) {const r=spawnSync(exe,args,{encoding:'utf8',maxBuffer:1048576});if(r.status!==0)throw Error('audio_process_failed');return r;}
function meter(file){const r=execute('/opt/homebrew/bin/ffmpeg',['-hide_banner','-nostdin','-i',file,'-af','loudnorm=I=-24:TP=-3:LRA=7:print_format=json','-f','null','-']);const j=r.stderr.match(/\{[\s\S]*?\}/g);const x=JSON.parse(j[j.length-1]);return{integratedLufs:Number(x.input_i),truePeakDbtp:Number(x.input_tp),loudnessRangeLu:Number(x.input_lra),thresholdLufs:Number(x.input_thresh)};}
const before=meter(source), gain=Math.min(-24-before.integratedLufs,-3.15-before.truePeakDbtp);
execute('/opt/homebrew/bin/ffmpeg',['-y','-hide_banner','-nostdin','-v','error','-i',source,'-af',`volume=${gain}dB,apad,atrim=duration=30`,'-ar','48000','-ac','2','-c:a','pcm_s24le',master]);
execute('/opt/homebrew/bin/ffmpeg',['-y','-hide_banner','-nostdin','-v','error','-i',master,'-c:a','libmp3lame','-b:a','192k',audition]);
const measured=meter(master), mp3Measured=meter(audition);
function probe(file){return JSON.parse(execute('/opt/homebrew/bin/ffprobe',['-v','error','-show_entries','format=duration,size:stream=codec_name,sample_rate,channels,bits_per_sample,duration_ts,time_base','-of','json',file]).stdout);}
const masterProbe=probe(master);
if(masterProbe.streams[0].duration_ts!==1440000||Math.abs(measured.integratedLufs+24)>0.15||measured.truePeakDbtp>-3)throw Error('music_master_not_at_approved_target');
const provenance={id:'music_base',provider:'Original local composition',sourceType:'Programmed composition and physical/modal synthesized instruments; no live recordings; no ElevenLabs music',authoringDate:new Date().toISOString(),key:'D minor',bpm:BPM,meter:'4/4',motif:'D-A-C-D',seconds:SECONDS,beats:50,bars:12.5,seamlessLoop:false,source,sourceHash,master,audition,modelledInstruments:['Karplus-Strong nylon string','damped warm modal bell','bone/wood modal contacts','filtered brushed-noise percussion','soft shaker','low muted harmonic brass'],copyrightSource:'Newly authored score using user-approved four-note identity. No copied or licensed stock sound material; no provider-music license fee.',generator:path.join(DIR,'music-base-composition.cjs'),events,mastering:{fixedGainDb:gain,measured,mp3Measured,masterProbe,sourceProbe:probe(source),sourceFadeOutSeconds:0.07,sourceQuality:'Original authored 48-kHz stereo float32 WAV; final 24-bit WAV and MP3 derived locally.'},listeningReview:'Pending user audition; instrument models are synthetic and are not claimed as live nylon/brass performances.'};
fs.writeFileSync(path.join(DIR,'samples/music-base-provenance.json'),JSON.stringify(provenance,null,2)+'\n');
console.log(JSON.stringify({source,master,audition,seconds:30,measured,mp3Measured,events:events.length}));
