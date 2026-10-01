// Stage 1 only: complete screen proposals, not production art or a deck export.
const fs=require('node:fs'),path=require('node:path');
const root=__dirname,project=path.resolve(root,'../..');
fs.mkdirSync(root+'/mockups',{recursive:true});fs.mkdirSync(root+'/fonts',{recursive:true});
for(const file of ['barrio-latin-400-normal.woff2','oswald-latin-600-normal.woff2'])fs.copyFileSync(project+'/frontend/src/fonts/'+file,root+'/fonts/'+file);
const font=(name,file)=>`@font-face{font-family:${name};src:url(data:font/woff2;base64,${fs.readFileSync(root+'/fonts/'+file).toString('base64')}) format('woff2');font-weight:${name==='Barrio'?400:600};}`;
const fonts=font('Barrio','barrio-latin-400-normal.woff2')+font('Oswald','oswald-latin-600-normal.woff2');
const P={night:'#10171B',velvet:'#142C2B',black:'#050708',metalDark:'#5C391F',gold:'#B98643',highlight:'#E4C77A',bone:'#F0DFB5',orange:'#F59A22',pink:'#CF3C78',teal:'#2CADA6'};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const rect=(x,y,w,h,fill,rx=0,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const text=(x,y,s,size=22,fill=P.bone,family='Oswald',extra='')=>`<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" ${extra}>${esc(s)}</text>`;
const line=(x1,y1,x2,y2,color=P.gold,width=1,extra='')=>`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const g=(x,y,s,body,extra='')=>`<g transform="translate(${x} ${y}) scale(${s})" ${extra}>${body}</g>`;
const suitPaths={
 H:'M0 16C-4 12-19 2-19-9C-19-23-5-23 0-14C5-23 19-23 19-9C19 2 4 12 0 16Z',
 D:'M0-23L17-3 0 18-17-3Z',
 S:'M0-24C-5-17-20-6-20 3C-20 15-8 15-3 8L-4 14-10 19H10L4 14 3 8C8 15 20 15 20 3C20-6 5-17 0-24Z',
 C:'M-4 8C-17 17-27 0-16-8C-12-11-8-10-6-9C-13-24 12-27 10-12L6-8C19-16 29 5 15 10L4 9 5 14 11 19H-10L-4 13Z'
};
function pip(suit,x,y,size,color){return g(x,y,size/44,suit==='C'?`<g fill="${color}"><circle cy="-14" r="10"/><circle cx="-11" cy="1" r="10"/><circle cx="11" cy="1" r="10"/><path d="M-4 3H4V10Q4 16 11 19H-11Q-4 16-4 10Z"/></g>`:`<path d="${suitPaths[suit]}" fill="${color}"/>`)}
function flower(x,y,size=1,color=P.orange){let petals='';for(let i=0;i<10;i++)petals+=`<ellipse cx="0" cy="-13" rx="5.3" ry="10" transform="rotate(${i*36})" fill="${color}" stroke="${P.metalDark}" stroke-width="1"/>`;return g(x,y,size,petals+`<circle r="8" fill="${P.metalDark}"/><circle cx="-1" cy="-2" r="4.5" fill="${P.highlight}"/>`)}
function skull(x,y,s=1){return g(x,y,s,`<path d="M-21-7C-24-36 23-36 21-7L17 1 14 10 10 11 10 19H-10V11L-14 10-17 1Z" fill="${P.bone}" stroke="${P.black}" stroke-width="2"/><path d="M-17-12Q-10-18-4-10L-6-3Q-15 1-17-7ZM17-12Q10-18 4-10L6-3Q15 1 17-7ZM0-3L-4 6H4Z" fill="${P.black}"/><path d="M-11-24Q-7-27-1-27M-10 11H10M-6 12V18M0 12V19M6 12V18" fill="none" stroke="${P.black}" stroke-width="1"/>`)}
function ornament(x,y,s=1){return g(x,y,s,`<path d="M0 62V0H62L44 8H12V42L0 62Z" fill="url(#metal)" stroke="${P.metalDark}" stroke-width="2"/><path d="M6 45Q30 45 34 25Q35 12 23 12Q13 12 16 22Q19 30 25 23M10 7H49M7 10V48" fill="none" stroke="${P.highlight}" stroke-width="2"/><path d="M10 38Q4 23 12 18M34 14Q51 5 43 25M16 36Q32 40 42 35" fill="none" stroke="${P.metalDark}" stroke-width="2"/><path d="M17 35Q39 34 40 9Q42 35 60 42Q31 43 22 54Z" fill="${P.gold}" stroke="${P.metalDark}" stroke-width="1"/>`)}
function defs(state='idle'){return `<defs>
 <linearGradient id="sky" x2=".6" y2="1"><stop stop-color="${state==='fs'?P.velvet:P.night}"/><stop offset=".6" stop-color="${P.night}"/><stop offset="1" stop-color="${P.black}"/></linearGradient>
 <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${P.highlight}"/><stop offset=".22" stop-color="${P.gold}"/><stop offset=".6" stop-color="${P.metalDark}"/><stop offset=".85" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.metalDark}"/></linearGradient>
 <linearGradient id="paper" x2=".7" y2="1"><stop stop-color="${P.bone}"/><stop offset="1" stop-color="${P.bone}" stop-opacity=".94"/></linearGradient>
 <linearGradient id="enamel" x2=".55" y2="1"><stop stop-color="${P.teal}"/><stop offset=".2" stop-color="${P.velvet}"/><stop offset="1" stop-color="${P.black}"/></linearGradient>
 <linearGradient id="hud" x2=".7" y2="1"><stop stop-color="${P.night}"/><stop offset=".32" stop-color="${P.black}"/><stop offset="1" stop-color="#000"/></linearGradient>
 <linearGradient id="wax" x2="1" y2=".2"><stop stop-color="${P.bone}"/><stop offset=".4" stop-color="${P.highlight}"/><stop offset="1" stop-color="${P.metalDark}"/></linearGradient>
 <radialGradient id="table"><stop stop-color="${P.velvet}"/><stop offset="1" stop-color="${P.black}"/></radialGradient>
 <linearGradient id="rose" x2=".8" y2="1"><stop stop-color="${P.pink}"/><stop offset="1" stop-color="${P.metalDark}"/></linearGradient>
 <mask id="paperCut"><rect x="-38" y="0" width="76" height="94" fill="white"/><g fill="black"><path d="M-19 44C-19 20 19 20 19 44L15 55 10 55V64H-10V55L-15 55Z"/><circle cx="-10" cy="38" r="5"/><circle cx="10" cy="38" r="5"/><path d="M0 44L-4 51H4Z"/></g><g fill="white"><ellipse cx="-8" cy="40" rx="4.5" ry="5.8"/><ellipse cx="8" cy="40" rx="4.5" ry="5.8"/><path d="M0 47L-3 53H3Z"/><path d="M-8 57V62M-3 57V63M3 57V63M8 57V62" stroke="white" stroke-width="1.5"/></g>${Array.from({length:6},(_,i)=>`<circle cx="${-26+i*10.4}" cy="10" r="2" fill="black"/><circle cx="${-26+i*10.4}" cy="77" r="2" fill="black"/>`).join('')}<path d="M-29 24V68M29 24V68" stroke="black" stroke-width="2" stroke-dasharray="3 6"/></mask>
 </defs><style>${fonts} text{font-weight:600}text[font-family="Barrio"]{font-weight:400}</style>`}
function flag(x,y,s,color,angle=0){return g(x,y,s,`<g transform="rotate(${angle})"><path d="M-35 0H35V79L28 88 21 82 14 91 7 85 0 94-7 85-14 91-21 82-28 88-35 79Z" fill="${color}" mask="url(#paperCut)"/><path d="M-34 2H34" stroke="${P.bone}" stroke-opacity=".42" stroke-width="1"/></g>`)}
function candle(x,y,s=1,h=92){return g(x,y,s,`<ellipse cy="8" rx="21" ry="7" fill="${P.black}"/><path d="M-18 -${h}H18V0Q0 10 -18 0Z" fill="url(#wax)" stroke="${P.metalDark}" stroke-width="1"/><ellipse cy="-${h}" rx="18" ry="5" fill="${P.bone}"/><ellipse cy="-${h}" rx="13" ry="3" fill="${P.gold}"/><path d="M-13 -${h}V-${h-17}Q-8 -${h-26} -9 -${h-35}" fill="none" stroke="${P.bone}" stroke-width="3"/><path d="M0 -${h+9}C-15 -${h+17} -9 -${h+33} 0 -${h+43}C5 -${h+26} 12 -${h+17} 0 -${h+9}Z" fill="${P.orange}"/><path d="M0 -${h+10}C-7 -${h+14} -5 -${h+23} 0 -${h+28}C4 -${h+22} 5 -${h+14} 0 -${h+10}Z" fill="${P.bone}"/><path d="M0 -${h}V-${h+10}" stroke="${P.black}" stroke-width="2"/>`)}
function cathedral(x,y,s=1){return g(x,y,s,`<g fill="${P.black}" stroke="${P.velvet}" stroke-width="2"><path d="M-96 0V-191L-78-191-78-260-62-285-46-260V-191H-29V-151L0-181 29-151V-191H46V-260L62-285 78-260V-191H96V0Z"/><path d="M-5-184V-207H5V-184M-13-200H13"/><path d="M-11 0V-61Q0-89 11-61V0M-75-122V-167Q-62-189-49-167V-122M49-122V-167Q62-189 75-167V-122" fill="${P.velvet}"/></g>`)}
function scenery(W,H,mobile,state){let s=rect(0,0,W,H,'url(#sky)');const fsMode=state==='fs';
 if(!mobile){s+=`<g opacity="${fsMode?.48:.3}">${cathedral(318,785,1.6)}${cathedral(1640,890,.72)}</g><path d="M0 760Q280 680 610 770V955H0ZM1310 740Q1690 688 1920 785V955H1310Z" fill="${P.velvet}" opacity=".45"/>`;
  for(const [start,end]of [[-40,635],[1285,1960]]){s+=`<path d="M${start} 16Q${(start+end)/2} 78 ${end} 8" fill="none" stroke="${P.gold}" stroke-width="2"/>`;for(let i=0;i<6;i++){let x=start+50+i*116,y=20+32*Math.sin(i/5*Math.PI);s+=flag(x,y,.9,[P.teal,P.pink,P.orange][i%3],(i-2.5)*-2)}}
  s+=rect(0,866,W,89,'url(#table)');s+=`<path d="M0 902Q315 857 615 920M1315 920Q1590 854 1920 894" stroke="${P.teal}" opacity=".11" fill="none" stroke-width="2"/>`;
  s+=candle(205,897,1.3,88)+candle(283,907,1.55,122)+candle(363,910,1,78);
  for(const [x,y,z]of [[117,913,.82],[155,900,1.0],[189,929,1.1],[388,929,1.1],[426,907,.85],[465,933,.72],[1510,924,.72],[1592,923,1],[1684,922,.82],[1778,918,1],[1870,919,.9]])s+=flower(x,y,z);
  s+=candle(1690,925,.74,112)+candle(1800,932,.88,78);
  s+=g(280,fsMode?575:268,1,flower(0,-110,1)+text(0,0,'MUERTA',79,P.bone,'Barrio','text-anchor="middle"')+text(0,53,'POKER',35,P.highlight,'Barrio','text-anchor="middle"')+line(-114,70,114,70,P.gold,1)+`<path d="M-128 71Q-100 80-85 75M128 71Q100 80 85 75" stroke="${P.gold}" fill="none" stroke-width="1"/>`);
 }else{
  s+=`<g opacity=".32">${cathedral(45,749,.7)}${cathedral(361,753,.46)}</g>`;
  s+=`<path d="M-20 7Q195 46 410 7" stroke="${P.gold}" fill="none" stroke-width="1"/>`;for(let i=0;i<8;i++)s+=flag(-1+i*56,12+10*Math.sin(i/7*Math.PI),.37,[P.orange,P.teal,P.pink][i%3],4-i);
  if(!fsMode)s+=text(195,72,'MUERTA POKER',22,P.bone,'Barrio','text-anchor="middle"');
  s+=rect(0,701,390,143,'url(#table)');s+=candle(31,701,.36,66)+candle(362,700,.4,89)+flower(52,716,.47)+flower(341,718,.39);
 }
 return s;
}
// The small court studies describe the future manual redraw. They are not 12 final courts.
function court(rank,suit){
 const red=suit==='H'||suit==='D',accent=red?'url(#rose)':'url(#enamel)';
 let body=`<path d="M-12 38Q-26 37 -30 48L-33 78H33L30 48Q26 37 12 38L8 32H-8Z" fill="${P.night}" stroke="${P.metalDark}" stroke-width="2"/>
 <path d="M-28 44Q-22 47 -17 56L-11 77H-31ZM28 44Q22 47 17 56L11 77H31Z" fill="${accent}" stroke="${P.metalDark}" stroke-width="2"/>
 <path d="M-15 42L0 61 15 42 8 36Q0 39 -8 36Z" fill="${P.gold}" stroke="${P.metalDark}" stroke-width="2"/>
 <path d="M-10 45Q0 49 10 45M-8 50Q0 54 8 50M0 39V57" stroke="${P.bone}" stroke-width="2" fill="none"/>
 <path d="M-29 45Q-23 54 -19 76M29 45Q23 54 19 76M-29 70Q-23 69 -18 64M29 70Q23 69 18 64M-5 64V75M5 64V75" stroke="${P.highlight}" stroke-width="1" fill="none"/>
 <path d="M-10 19Q-11 10 -6 7Q0 3 6 7Q11 10 10 19L8 23 6 23V31Q0 34 -6 31V23L-8 23Z" fill="url(#paper)" stroke="${P.black}" stroke-width="2"/>
 <path d="M-8 15Q-4 11 -1 15L-2 20Q-7 22 -8 17ZM8 15Q4 11 1 15L2 20Q7 22 8 17ZM0 20L-2 24H2Z" fill="${P.black}"/>
 <path d="M-5 27H5M-3 27V31M0 27V32M3 27V31M-8 11Q-4 6 2 8M7 22L6 24" stroke="${P.metalDark}" stroke-width="1" fill="none"/>
 <path d="M-3 33V37H3V33" fill="${P.bone}" stroke="${P.black}" stroke-width="1"/>`;
 if(rank==='Q'){
  body+=`<path d="M-15 15Q-15 1 0-5Q15 1 15 15L12 24 11 14 7 5H-7L-11 14-12 24Z" fill="${P.black}" stroke="${P.metalDark}" stroke-width="1"/><path d="M-13 7L-15-4-8 0 0-10 8 0 15-4 13 7Z" fill="url(#metal)" stroke="${P.metalDark}" stroke-width="1"/>`;
  body+=flower(-12,3,.18)+flower(12,3,.18)+flower(0,-3,.2);
  body+=`<path d="M-13 20L-12 31M13 20L12 31" stroke="${P.gold}" stroke-width="2"/><circle cx="-12" cy="32" r="2" fill="${P.gold}"/><circle cx="12" cy="32" r="2" fill="${P.gold}"/>`;
 }else if(rank==='K')body+=`<path d="M-13 8L-17-8-8-3 0-14 8-3 17-8 13 8Z" fill="url(#metal)" stroke="${P.metalDark}" stroke-width="2"/><path d="M-11 4H11" stroke="${P.highlight}" stroke-width="1"/><path d="M0-7L3-3 0 1-3-3Z" fill="${red?P.pink:P.teal}"/>`;
 else body+=`<path d="M-17 7Q-12-15 8-11L20 3 10 1Q1-5-8 0L-10 7Z" fill="${accent}" stroke="${P.metalDark}" stroke-width="2"/><path d="M9-10Q10-31 21-20Q13-19 14-11Z" fill="${P.gold}" stroke="${P.metalDark}" stroke-width="1"/>`;
 body+=`<path d="M-25 49Q-18 49 -11 54L6 68-1 73-19 64-28 61Z" fill="${accent}" stroke="${P.metalDark}" stroke-width="2"/><path d="M-9 56L6 68 12 68 9 64-4 53Z" fill="${P.bone}" stroke="${P.metalDark}" stroke-width="1"/><path d="M-2 59L9 68M-5 60L6 69M-7 62L3 70" stroke="${P.metalDark}" stroke-width="1"/>
 <path d="M24 51Q17 49 13 52L3 56-1 61 11 60 21 60Z" fill="${P.bone}" stroke="${P.metalDark}" stroke-width="1"/><path d="M5 55L16 54M3 57L14 56M3 59L11 58" fill="none" stroke="${P.metalDark}" stroke-width="1"/><path d="M24 48L28 59 21 64 17 50Z" fill="url(#metal)" stroke="${P.metalDark}" stroke-width="1"/>
 <path d="M-33 78H33" stroke="${P.gold}" stroke-width="2"/>`;
 return body;
}
function reaper(){return `<path d="M-43 50Q-45-36 0-44Q42-32 44 50L38 104 51 138Q27 130 15 140L0 134-19 140-46 136-39 101Z" fill="${P.night}" stroke="${P.gold}" stroke-width="3"/><path d="M-20 27Q-29-14 0-29Q29-14 20 27" fill="${P.black}"/>${skull(0,2,.78)}<path d="M-12 37L-24 105M12 37L26 100M-34 49L-8 65 7 57 33 45M-5 41L0 84 8 116M-35 112L-23 124M25 113L38 124" fill="none" stroke="${P.gold}" stroke-width="2"/><path d="M29 122L35-58" stroke="${P.metalDark}" stroke-width="6"/><path d="M35-58L32 122" stroke="${P.highlight}" stroke-width="2"/><path d="M35-58Q-31-69-54-9Q-42-40 35-46Z" fill="url(#metal)" stroke="${P.black}" stroke-width="2"/><path d="M12 69L33 55 37 64 17 79Z" fill="${P.bone}" stroke="${P.black}" stroke-width="2"/>${flower(-22,127,.25)}`}
const positions={2:[[0,-1],[0,1]],3:[[0,-1],[0,0],[0,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],7:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1],[0,-.5]],8:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1],[0,-.5],[0,.5]],9:[[-1,-1],[1,-1],[-1,-.33],[1,-.33],[-1,.33],[1,.33],[-1,1],[1,1],[0,0]],10:[[-1,-1],[1,-1],[-1,-.33],[1,-.33],[-1,.33],[1,.33],[-1,1],[1,1],[0,-.66],[0,.66]]};
function card(c,x,y,w,h,win=false,dim=false,illustration=''){
 const cw=120,ch=170,ink=c.suit==='H'||c.suit==='D'?'color-mix(in srgb, '+P.pink+' 75%, '+P.black+')':P.black;
 let s=rect(0,0,cw,ch,'url(#paper)',4,`stroke="${win?P.orange:P.metalDark}" stroke-width="${win?3:2}"`)+rect(3,3,cw-6,ch-6,'none',3,`stroke="${win?P.highlight:P.gold}" stroke-width="1"`)+`<path d="M7 163V7H112" stroke="${P.bone}" fill="none" stroke-width="1"/>`;
 if(c.golden){s=rect(0,0,cw,ch,'url(#enamel)',4,`stroke="${P.gold}" stroke-width="3"`)+g(60,55,.73,reaper());}
 else{
  const rank=c.rank==='T'?'10':c.rank;
  const rankColor=ink;
  const indices=text(16,29,rank,29,rankColor,'Barrio','text-anchor="middle"')+pip(c.suit,16,44,16,rankColor);
  s+=indices+`<g transform="translate(120 170) rotate(180)">${indices}</g>`;
  if(illustration)s+=illustration;
  else if(['J','Q','K'].includes(c.rank)){const half=court(c.rank,c.suit);s+=g(60,18,.88,half)+`<g transform="translate(60 152) rotate(180) scale(.88)">${half}</g>`;}
  else if(c.rank==='A'){s+=pip(c.suit,60,89,63,ink);s+=`<path d="M36 126Q60 135 84 126M41 136H79" stroke="${P.gold}" fill="none" stroke-width="1"/>`;}
  else for(const [px,py]of positions[Number(rank)]||[])s+=pip(c.suit,60+px*24,85+py*44,21,rankColor);
 }
 if(win)s+=`<path d="M7 48V7H48" stroke="${P.bone}" fill="none" stroke-width="3"/><path d="M113 122V163H72" stroke="${P.gold}" fill="none" stroke-width="2"/>`;
 if(dim)s+=rect(0,0,120,170,P.black,4,'opacity=".36"');
 return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 120 170" overflow="visible">${s}</svg>`;
}
const names=['','JACKS OR BETTER','TWO PAIR','THREE OF A KIND','STRAIGHT','FLUSH','FULL HOUSE','FOUR OF A KIND','STRAIGHT FLUSH','ROYAL FLUSH'];
function payboard(target,state){const x=1431,y=170,w=397,h=684;let s=rect(x-18,y-18,w+36,h+36,'url(#metal)',8,`stroke="${P.metalDark}" stroke-width="3"`)+rect(x,y,w,h,'url(#hud)',8,`stroke="${P.gold}" stroke-width="2"`)+line(x+8,y+8,x+w-8,y+8,P.highlight,1);
 for(let i=0;i<15;i++){s+=`<circle cx="${x+8+i*(w-16)/14}" cy="${y-10}" r="4.5" fill="${i%2?P.metalDark:P.highlight}" stroke="${P.metalDark}" stroke-width="1"/><circle cx="${x+8+i*(w-16)/14}" cy="${y+h+10}" r="4.5" fill="${i%2?P.metalDark:P.gold}" stroke="${P.metalDark}" stroke-width="1"/>`;}
 for(let i=1;i<22;i++)for(const xx of [x-10,x+w+10])s+=`<circle cx="${xx}" cy="${y+i*h/22}" r="${i%2?3:4.5}" fill="${i%2?P.metalDark:P.gold}" stroke="${P.metalDark}" stroke-width="1"/>`;
 s+=text(x+w/2,y+62,'Hand pays',39,P.bone,'Barrio','text-anchor="middle"')+line(x+70,y+86,x+w-70,y+86,P.gold,1)+pip('D',x+w/2,y+87,12,P.highlight);
 const pays=['200×','20×','8×','2×','1.5×','1×','0.75×','0.5×','0.25×'];
 for(let i=0;i<9;i++){let yy=y+149+i*59,hit=state!=='idle'&&target?.lines?.some(l=>l.hand_index===9-i);
  s+=rect(x+10,yy-27,w-20,47,hit?P.velvet:P.night,4,`opacity="${hit?1:.44}"`);
  if(hit){s+=rect(x+10,yy-27,w-20,47,'none',4,`stroke="${P.orange}" stroke-width="2"`);for(const xx of [x-10,x+w+10])s+=`<circle cx="${xx}" cy="${yy-4}" r="5.5" fill="${P.orange}"/><circle cx="${xx-1}" cy="${yy-5}" r="2" fill="${P.bone}"/>`;}
  s+=text(x+24,yy,names[9-i],24,hit?P.bone:P.highlight)+text(x+w-22,yy,pays[i],27,hit?P.orange:P.highlight,'Oswald','text-anchor="end"');
 }return s;
}
const arrow=`<path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" d="M20.29 12.29A8.3 8.3 0 0 1 6.55 18.26"/><path fill="currentColor" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" d="M2.53 14.57 7.94 15.62 3.84 19.65z"/><path fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" d="M3.71 11.71A8.3 8.3 0 0 1 17.45 5.74"/><path fill="currentColor" stroke="currentColor" stroke-width="0.7" stroke-linejoin="round" d="M21.47 9.43 16.06 8.38 20.16 4.35z"/>`;
const bolt=`<path fill="currentColor" d="M13.4 1.6 5.2 13.4h5.4L8.3 22.4 19.1 9.5h-5.6L13.4 1.6z"/>`;
const info=`<circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M11.05 10.2h1.9V17.4h-1.9z"/><circle cx="12" cy="7.35" r="1.15" fill="currentColor"/>`;
const speaker=`<path fill="currentColor" d="M3.4 8.6h3.15L10.9 4.8v14.4L6.55 15.4H3.4c-.7 0-1.15-.48-1.15-1.18V9.78c0-.7.45-1.18 1.15-1.18Z"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14.15 9.2a3.15 3.15 0 0 1 0 5.6M16.85 6.85a6.05 6.05 0 0 1 0 10.3"/>`;
function icon(x,y,size,body,color=P.bone){return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" color="${color}">${body}</svg>`}
function button(x,y,size,body){return rect(x,y,size,size,'url(#hud)',4,`stroke="${P.highlight}" stroke-width="1"`)+line(x+4,y+2,x+size-4,y+2,P.bone,1,'opacity=".45"')+icon(x+size*.18,y+size*.18,size*.64,body)}
function hud(mobile,state,target){const balance=state==='idle'?'1000000.00':state==='win'?'999999.00':'999965.00';let s='';
 if(!mobile){const yy=955;s+=rect(0,yy,1920,125,'url(#hud)')+line(0,yy,1920,yy,P.gold,2)+line(0,yy+3,1920,yy+3,P.highlight,1,'opacity=".25"');
  s+=button(39,997,41,info)+button(96,997,41,speaker)+rect(151,989,108,55,P.black,8,`stroke="${P.gold}" stroke-width="2"`)+rect(155,993,100,47,'url(#rose)',4)+text(205,1025,'BONUS',24,P.bone,'Oswald','text-anchor="middle"');
  s+=text(271,1007,'BALANCE',20,P.highlight,'Oswald','letter-spacing="2"')+text(271,1040,balance,31);
  if(state!=='idle')s+=text(960,1007,state==='fs'?'TOTAL WIN':'WIN',20,P.highlight,'Oswald','text-anchor="middle" letter-spacing="2"')+text(960,1040,state==='fs'?'2.25':'1.00',31,P.bone,'Oswald','text-anchor="middle"');
  s+=text(1565,1007,'BET',20,P.highlight,'Oswald','text-anchor="end" letter-spacing="2"')+text(1565,1040,'1.00',31,P.bone,'Oswald','text-anchor="end"');
  s+=button(1586,978,37,'<path d="M5 12H19M12 5V19" stroke="currentColor" stroke-width="3"/>')+button(1586,1020,37,'<path d="M5 12H19" stroke="currentColor" stroke-width="3"/>');
  s+=`<circle cx="1694" cy="1017" r="45" fill="url(#hud)" stroke="${P.bone}" stroke-width="2"/><circle cx="1694" cy="1017" r="41" fill="none" stroke="${P.gold}" stroke-width="1"/>`+icon(1661,984,66,arrow);
  s+=button(1765,991,50,bolt)+button(1829,991,50,arrow);
 }else{
  // Keep the current portrait positions: spin is centered; balances sit in the bottom black strip.
  s+=rect(0,723,390,121,'url(#hud)')+line(0,812,390,812,P.gold,1);
  s+=`<circle cx="54" cy="764" r="20" fill="url(#hud)" stroke="${P.gold}" stroke-width="1"/>`+text(54,767,'BONUS',9,P.bone,'Oswald','text-anchor="middle"');
  s+=`<circle cx="195" cy="760" r="23" fill="url(#hud)" stroke="${P.bone}" stroke-width="1"/>`+icon(179,744,32,arrow);
  s+=button(149,752,17,'<path d="M5 12H19" stroke="currentColor" stroke-width="3"/>')+button(224,752,17,'<path d="M5 12H19M12 5V19" stroke="currentColor" stroke-width="3"/>');
  s+=button(154,789,16,info)+button(176,789,16,speaker)+button(198,789,16,bolt)+button(220,789,16,arrow);
  s+=text(8,824,'BALANCE',8,P.highlight,'Oswald','letter-spacing="1"')+text(8,840,balance,15)+text(382,824,'BET',8,P.highlight,'Oswald','text-anchor="end" letter-spacing="1"')+text(382,840,'1.00',15,P.bone,'Oswald','text-anchor="end"');
  if(state!=='idle')s+=text(195,674,(state==='fs'?'TOTAL WIN ':'WIN ')+(state==='fs'?'2.25':'1.00'),25,P.bone,'Oswald','text-anchor="middle"');
 }return s;
}
function bonus(mobile){if(mobile)return rect(4,13,81,49,'url(#enamel)',8,`stroke="${P.gold}" stroke-width="2"`)+text(44,46,'×3',28,P.highlight,'Oswald','text-anchor="middle"')+rect(316,13,70,49,'url(#enamel)',8,`stroke="${P.gold}" stroke-width="1"`)+text(351,28,'FREE SPINS LEFT',6.7,P.bone,'Oswald','text-anchor="middle"')+text(351,53,'9',24,P.orange,'Oswald','text-anchor="middle"')+text(195,74,'FREE SPINS',17,P.teal,'Barrio','text-anchor="middle"');
 return rect(41,128,225,135,'url(#enamel)',8,`stroke="${P.gold}" stroke-width="3"`)+text(153.5,226,'×3',68,P.highlight,'Oswald','text-anchor="middle"')+rect(25,293,255,170,'url(#enamel)',8,`stroke="${P.gold}" stroke-width="3"`)+text(152,340,'FREE SPINS LEFT',25,P.bone,'Oswald','text-anchor="middle"')+text(152,427,'9',74,P.orange,'Oswald','text-anchor="middle"');
}
function board(mobile,state,cards,target){let x=mobile?0:610,y=mobile?84:0,w=mobile?390:700,h=mobile?555:954;let s=rect(x,y,w,h,'url(#metal)',8,`stroke="${P.metalDark}" stroke-width="2"`)+rect(x+7,y+7,w-14,h-14,'url(#hud)',8,`stroke="${P.highlight}" stroke-width="1"`)+rect(x+17,y+17,w-34,h-34,state==='fs'?'url(#enamel)':P.black,8,`stroke="${state==='fs'?P.teal:P.gold}" stroke-width="${state==='fs'?3:1}"`);
 const cw=mobile?64:112,ch=mobile?90:157,dx=mobile?71:126,dy=mobile?97:173,gx=x+(w-(4*dx+cw))/2,gy=y+(h-(4*dy+ch))/2;
 const winners=new Set();if(state!=='idle')for(const l of target.lines)for(const i of l.id<5?Array.from({length:5},(_,c)=>l.id*5+c):l.id===5?[0,6,12,18,24]:[4,8,12,16,20])winners.add(i);
 for(let i=0;i<25;i++)s+=card(cards[i],gx+(i%5)*dx,gy+Math.floor(i/5)*dy,cw,ch,winners.has(i),state!=='idle'&&!winners.has(i));
 const scale=mobile?.38:.64;s+=ornament(x+8,y+8,scale)+`<g transform="translate(${x+w-8} ${y+8}) scale(-1 1)">${ornament(0,0,scale)}</g><g transform="translate(${x+8} ${y+h-8}) scale(1 -1)">${ornament(0,0,scale)}</g><g transform="translate(${x+w-8} ${y+h-8}) scale(-1 -1)">${ornament(0,0,scale)}</g>`;
 if(state!=='idle')for(const l of target.lines){const cy=gy+l.id*dy+ch*.54,label=names[l.hand_index];s+=rect(x+w/2-(mobile?64:129),cy-(mobile?17:28),mobile?128:258,mobile?34:58,'url(#hud)',4,`stroke="${P.gold}" stroke-width="1"`)+text(x+w/2,cy-(mobile?3:5),label,mobile?10.5:19,P.highlight,'Oswald','text-anchor="middle"')+text(x+w/2,cy+(mobile?11:20),l.win_x.toFixed(2),mobile?17:28,P.bone,'Oswald','text-anchor="middle"');}
 return s;
}
function screen(label,state){const mobile=label==='portrait',W=mobile?390:1920,H=mobile?844:1080,data=JSON.parse(fs.readFileSync(root+`/screenshots/current-${label}-${state}.json`)),target=data.events.filter(e=>e.event==='target_received').at(-1);return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Muerta Poker ${label} ${state} — Stage 1 proposal"><title>Muerta Poker — ${label}, ${state}. Art direction only.</title>${defs(state)}${scenery(W,H,mobile,state)}${state==='fs'?bonus(mobile):''}${!mobile?payboard(target,state):''}${board(mobile,state,data.cards,target)}${hud(mobile,state,target)}</svg>`}
if(require.main===module){
for(const label of ['desktop','portrait'])for(const state of ['idle','win','fs'])fs.writeFileSync(root+`/mockups/proposed-${label}-${state}.svg`,screen(label,state));
// Material studies contain the same manually drawn shapes and directional light as the screens.
const samples={
 metal:`${rect(30,34,380,130,'url(#metal)',8,`stroke="${P.metalDark}" stroke-width="3"`)}${rect(44,48,352,102,P.black,8,`stroke="${P.gold}" stroke-width="2"`)}${line(36,40,401,40,P.highlight,2)}${line(36,40,36,156,P.highlight,2)}${line(409,43,409,159,P.metalDark,3)}${ornament(49,54,.8)}${text(226,114,'MUERTA',33,P.highlight,'Barrio','text-anchor="middle"')}`,
 enamel:`${rect(32,28,376,144,'url(#metal)',8)}${rect(39,35,362,130,'url(#enamel)',8,`stroke="${P.metalDark}" stroke-width="2"`)}${line(48,43,390,43,P.teal,2)}${line(48,43,48,151,P.teal,1)}${text(220,125,'×3',65,P.bone,'Oswald','text-anchor="middle"')}`,
 papel:`<path d="M10 20Q220 66 430 20" stroke="${P.gold}" fill="none" stroke-width="2"/>${flag(99,35,1.3,P.orange,3)}${flag(220,45,1.3,P.pink,-2)}${flag(340,35,1.3,P.teal,-6)}`,
 velvet:`${rect(20,20,400,160,'url(#table)',8)}<path d="M34 164Q120 143 200 161T403 150M34 151Q137 124 235 147T403 140" fill="none" stroke="${P.teal}" stroke-width="1" opacity=".22"/>${candle(83,158,.69,71)}${flower(350,138,.8)}${flower(377,160,.5)}`
};
for(const [id,body]of Object.entries(samples))fs.writeFileSync(root+`/mockups/material-${id}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="440" height="200" viewBox="0 0 440 200">${defs()}${rect(0,0,440,200,P.black)}${body}</svg>`);
for(const [id,c]of Object.entries({ace:{rank:'A',suit:'S'},queen:{rank:'Q',suit:'H'},reaper:{golden:true}}))for(const [w,h]of [[86,121],[60,85]])fs.writeFileSync(root+`/mockups/study-${id}-${w}x${h}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${defs()}${card(c,0,0,w,h)}</svg>`);
fs.writeFileSync(root+'/tokens.json',JSON.stringify({palette:P,fonts:{display:'Barrio',ui:'Oswald'},light:'upper left',strokes:[1,2,3],radii:[4,8],screenSizes:{desktop:[1920,1080],portrait:[390,844]},scope:'Stage 1 proposals only; no production assets integrated'},null,2)+'\n');
console.log('six screens, four material studies, six native-size studies, tokens');
}
module.exports={P,fonts,defs,rect,text,line,g,pip,flower,skull,ornament,card,hud,payboard,names,arrow,bolt,flag,bonus};
