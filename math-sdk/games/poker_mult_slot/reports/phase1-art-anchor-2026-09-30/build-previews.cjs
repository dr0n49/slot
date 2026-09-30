const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('/Users/andriinorenko/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = __dirname;
const dst = (name) => path.join(root, name);
const readWritten = (file) => fs.readFileSync(file);
const saveText = (name, value) => { const file = dst(name); fs.writeFileSync(file, value); readWritten(file); };
const encode = (b) => `data:image/png;base64,${b.toString('base64')}`;
const rank = `<g fill="none" stroke="#5A1520" stroke-linecap="square" stroke-linejoin="round"><ellipse cx="67" cy="87" rx="27" ry="39" stroke-width="10"/><path d="M72 106 L101 135" stroke-width="10"/></g>`;
const heart = `<path d="M65 208 C60 201 36 184 36 167 C36 149 58 145 65 159 C72 145 94 149 94 167 C94 184 70 201 65 208Z" fill="#5A1520"/>`;
const queenIndices = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720" viewBox="0 0 512 720">${rank}${heart}<g transform="translate(512 720) rotate(180)">${rank}${heart}</g></svg>`;
saveText('vectors/queen-indices.svg', queenIndices);
const frame = `<rect x="8" y="8" width="496" height="704" rx="15" fill="none" stroke="#B89148" stroke-width="5"/><rect x="17" y="17" width="478" height="686" rx="10" fill="none" stroke="#5B4932" stroke-width="1.2"/>`;
const shell = (contents) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720" viewBox="0 0 512 720"><defs><clipPath id="card"><rect width="512" height="720" rx="20"/></clipPath></defs><g clip-path="url(#card)">${contents}${frame}</g></svg>`;
const cards = [];
(async () => {
  const paper = await sharp(dst('sources/card-material.png')).resize(512,720,{fit:'cover'}).png().toBuffer();
  for (const id of ['queen-a','queen-b']) {
    // The same crop and deterministic 180-degree duplication are used for both candidates.
    const court = await sharp(dst(`sources/${id}-illustration.png`)).extract({left:0,top:0,width:1024,height:1080}).resize(322,340).png().toBuffer();
    const images = `<image href="${encode(paper)}" width="512" height="720"/><image href="${encode(court)}" x="95" y="20" width="322" height="340"/><g transform="translate(512 720) rotate(180)"><image href="${encode(court)}" x="95" y="20" width="322" height="340"/></g><path d="M102 360 H410" stroke="#B89148" stroke-width="2"/>`;
    const svg = shell(images + queenIndices.replace(/^.*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,''));
    saveText(`vectors/${id}-card-master.svg`, svg);
    await sharp(Buffer.from(readWritten(dst(`vectors/${id}-card-master.svg`)))).png().toFile(dst(`previews/${id}-card-512x720.png`));
    await sharp(readWritten(dst(`previews/${id}-card-512x720.png`))).resize(86,121).png().toFile(dst(`previews/${id}-desktop-86x121.png`));
    await sharp(readWritten(dst(`previews/${id}-card-512x720.png`))).resize(60,85).png().toFile(dst(`previews/${id}-portrait-60x85.png`));
    cards.push({id,label:id==='queen-a'?'A · ornate':'B · simpler crown',desktop:`previews/${id}-desktop-86x121.png`,portrait:`previews/${id}-portrait-60x85.png`});
  }
  const reaper = await sharp(dst('sources/reaper-illustration.png')).resize(408,612).png().toBuffer();
  const title = `<text x="256" y="68" text-anchor="middle" font-family="Georgia,serif" font-size="57" font-weight="bold" fill="#11100F" letter-spacing="5">JOKER</text>`;
  const reaperSvg = shell(`<image href="${encode(paper)}" width="512" height="720"/>${title}<image href="${encode(reaper)}" x="52" y="88" width="408" height="612"/>`);
  saveText('vectors/reaper-card-master.svg',reaperSvg);
  await sharp(Buffer.from(readWritten(dst('vectors/reaper-card-master.svg')))).png().toFile(dst('previews/reaper-card-512x720.png'));
  for (const [label,w,h] of [['desktop',86,121],['portrait',60,85]]) {
    await sharp(readWritten(dst('previews/reaper-card-512x720.png'))).resize(w,h).png().toFile(dst(`previews/reaper-${label}-${w}x${h}.png`));
    await sharp(paper).resize(w,h).png().toFile(dst(`previews/material-${label}-${w}x${h}.png`));
    await sharp(path.resolve(root,'../../frontend/public/assets/cards_v2/QH.webp')).resize(w,h).png().toFile(dst(`previews/current-queen-${label}-${w}x${h}.png`));
  }
  cards.unshift({id:'current',label:'Current QH',desktop:'previews/current-queen-desktop-86x121.png',portrait:'previews/current-queen-portrait-60x85.png'});
  cards.push({id:'reaper',label:'Reaper candidate',desktop:'previews/reaper-desktop-86x121.png',portrait:'previews/reaper-portrait-60x85.png'});
  const row = (mode,w,h) => cards.map(c=>`<figure><img src="${c[mode]}" width="${w}" height="${h}" alt="${c.label}"/><figcaption>${c.label}</figcaption></figure>`).join('');
  saveText('native-size-proof.html',`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Muerta court anchor · native display proof</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#11100F;color:#E5D7B3;font:15px/1.5 system-ui,sans-serif}main{max-width:840px}h1{font-size:24px;margin:0 0 8px}h2{font-size:17px;margin:28px 0 12px}p{max-width:680px;margin:8px 0;color:#c4bcae}.row{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}figure{margin:0;width:125px}img{display:block;max-width:none}figcaption{font-size:12px;margin-top:9px}a{color:#B89148}.note{font-size:12px}hr{border:0;border-top:1px solid #4c4233;margin-top:24px}@media(max-width:500px){body{padding:16px}.row{gap:10px}figure{width:86px;font-size:11px}}</style><main><h1>Queen of Hearts · anchor approval</h1><p>Four generated layers only: Queen A, Queen B, shared paper material and Grim Reaper. Candidate B is recommended for its simpler crown and fewer small gold shapes. No art has been installed.</p><p class="note">Native 1× proof: open at 100% browser zoom. The cards below have fixed CSS dimensions; originals are deliberately not enlarged here. Q and heart indices are authored SVG paths. Court mirroring is deterministic, not generated.</p><h2>Desktop · exactly 86×121 CSS px</h2><div class="row">${row('desktop',86,121)}</div><h2>Portrait · exactly 60×85 CSS px</h2><div class="row">${row('portrait',60,85)}</div><h2>Shared material · no generated lettering or pips</h2><div class="row"><figure><img src="previews/material-desktop-86x121.png" width="86" height="121"><figcaption>86×121</figcaption></figure><figure><img src="previews/material-portrait-60x85.png" width="60" height="85"><figcaption>60×85</figcaption></figure></div><hr><p>Sources: Queen/Reaper illustrations 1024×1536 RGBA; paper 1058×1487 RGB. Final template exports 512×720. These are approval candidates, with intentional crop and exact 180° repetition. Tiny crosshatching vanishes at final size; silhouette, skull, crown and vector suit remain the readability targets.</p><p><a href="sources/queen-a-illustration.png">Queen A source</a> · <a href="sources/queen-b-illustration.png">Queen B source</a> · <a href="sources/reaper-illustration.png">Reaper source</a> · <a href="sources/card-material.png">Paper source</a></p><p>STOP: no other court, ace, frame, prop or background will be generated until the Queen anchor is approved.</p></main></html>`);
  const files = [];
  for(const dir of ['sources','previews','vectors']) for (const name of fs.readdirSync(dst(dir))) {
    const file=dst(`${dir}/${name}`); const bytes=readWritten(file);
    const m = name.endsWith('.png') ? await sharp(bytes).metadata() : null;
    files.push({path:`${dir}/${name}`,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...(m?{width:m.width,height:m.height,channels:m.channels}:{} )});
  }
  saveText('asset-manifest.json',JSON.stringify({date:'2026-09-30',state:'Approval candidates only; no runtime assets replaced',method:'Built-in image_gen illustration/material sources; deterministic crop/mirror/template composition; SVG path Q and heart indices; no generated rank/pip/index pixels',recommendation:'Queen B, provisional at 1×; same identity and palette as A, fewer fine gold crown shapes',files},null,2));
  console.log(JSON.stringify({status:'ok',sources:files.filter(f=>f.path.startsWith('sources/')),nativeProof:'native-size-proof.html',files:files.length},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
