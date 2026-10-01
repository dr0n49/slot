// Stage 1b: review compositions only. Reuse the approved shell, HUD lettering and icons.
const fs=require('node:fs'),path=require('node:path');
const {P,defs,rect,text,line,g,pip,flower,skull,ornament,card,hud,payboard,names,flag}=require('./build-direction.cjs');
const dir=__dirname+'/review-1b';fs.mkdirSync(dir,{recursive:true});
const data={},manifest={scope:'Stage 1b review only',sizes:{desktop:[1920,1080],portrait:[390,844]},screens:[],native:[],backgrounds:[],motion:[],approvedShell:'build-direction.cjs card, no frame/index/pip edits',approvedHud:'build-direction.cjs hud; only real captured amounts replaced'};
const bytes=p=>fs.readFileSync(p).toString('base64');
function figure(id,set='queen-a'){
 const href='data:image/webp;base64,'+bytes(dir+`/illustrations/${set}/${id}-render.webp`);
 if(set==='earlier')return `<image x="25" y="5" width="70" height="160" preserveAspectRatio="none" href="${href}"/>`;
 const half=`<image x="23" y="4" width="74" height="78" href="${href}" preserveAspectRatio="none"/>`;
 return half+`<g transform="translate(120 170) rotate(180)">${half}</g>`+line(28,85,92,85,P.gold,.6);
}
function shell(c,x,y,w,h,winning=false,set='queen-a') {let face=card(c,x,y,w,h,winning,false,!c.golden&&['J','Q','K'].includes(c.rank)?figure(c.rank+c.suit,set):'');if(winning)face=face.replace('stroke="'+P.orange+'"','stroke="url(#metal)"');return face}
const svg=(W,H,body,state='idle')=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img"><title>Muerta Poker — Stage 1b review, not production</title>${defs(state)}${extraDefs()}${body}</svg>`;
function extraDefs(){return `<defs>
<linearGradient id="skyA" x2=".15" y2="1"><stop stop-color="#472d6c"/><stop offset=".32" stop-color="#552f69"/><stop offset=".68" stop-color="#32233f"/><stop offset="1" stop-color="#241d30"/></linearGradient>
<linearGradient id="skyB" x2=".2" y2="1"><stop stop-color="#22323d"/><stop offset=".45" stop-color="#27303c"/><stop offset="1" stop-color="#161e27"/></linearGradient>
<linearGradient id="skyC" x2=".1" y2="1"><stop stop-color="#553274"/><stop offset=".32" stop-color="#443253"/><stop offset=".67" stop-color="#252d38"/><stop offset="1" stop-color="#1b232c"/></linearGradient>
<radialGradient id="mist"><stop stop-color="#bcaacb" stop-opacity=".24"/><stop offset=".45" stop-color="#a9a9c1" stop-opacity=".09"/><stop offset="1" stop-color="#a9a9c1" stop-opacity="0"/></radialGradient>
<radialGradient id="amber"><stop stop-color="#efb86e" stop-opacity=".55"/><stop offset=".3" stop-color="#ec9e65" stop-opacity=".25"/><stop offset="1" stop-color="#de9a74" stop-opacity="0"/></radialGradient>
<linearGradient id="stone" x2=".2" y2="1"><stop stop-color="#a4988a"/><stop offset=".12" stop-color="#736b69"/><stop offset=".65" stop-color="#403e45"/><stop offset="1" stop-color="#242830"/></linearGradient>
<linearGradient id="cloth" x2="1" y2="1"><stop stop-color="#754d62"/><stop offset=".3" stop-color="#3c2e41"/><stop offset=".53" stop-color="#725365"/><stop offset=".56" stop-color="#463449"/><stop offset="1" stop-color="#262932"/></linearGradient>
<linearGradient id="letterMetal" x2=".2" y2="1"><stop stop-color="#fff1c8"/><stop offset=".24" stop-color="#e5c68a"/><stop offset=".48" stop-color="#c79251"/><stop offset=".5" stop-color="#8a5833"/><stop offset=".77" stop-color="#e0b574"/><stop offset="1" stop-color="#8d5338"/></linearGradient>
<radialGradient id="badge"><stop stop-color="#97523f"/><stop offset=".62" stop-color="#552b2c"/><stop offset=".88" stop-color="#351c22"/><stop offset="1" stop-color="#a77046"/></radialGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".055"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
<filter id="paperGrain" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".45" numOctaves="2" seed="14"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".18"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter>
<mask id="edgeCut"><rect x="-38" y="0" width="76" height="94" fill="white"/>${Array.from({length:9},(_,i)=>`<circle cx="${-28+i*7}" cy="78" r="1.25" fill="black"/>`).join('')}<path d="M-29 15V67M29 15V67" stroke="black" stroke-width="1.2" stroke-dasharray="2 4"/></mask>
<mask id="fineCut"><rect x="-38" y="0" width="76" height="94" fill="white"/><path d="M-20 41Q-23 18 0 18Q23 18 20 41L15 52 11 52V65H-11V52L-15 52Z" fill="black"/><g fill="white"><ellipse cx="-8" cy="37" rx="5.5" ry="6"/><ellipse cx="8" cy="37" rx="5.5" ry="6"/><path d="M0 45L-3 51H3Z"/><path d="M-9 55H9M-6 55V64M0 55V64M6 55V64" stroke="white" stroke-width="1.5"/><circle cy="25" r="2.7"/></g>${Array.from({length:9},(_,i)=>`<circle cx="${-28+i*7}" cy="10" r="1.2" fill="black"/><circle cx="${-28+i*7}" cy="77" r="1.4" fill="black"/>`).join('')}<path d="M-29 18V67M29 18V67" stroke="black" stroke-width="1.2" stroke-dasharray="2 4"/><path d="M-24 25L-20 29-24 33-28 29ZM24 25L28 29 24 33 20 29Z" fill="black"/></mask>
</defs>`}
const flagPath='M-35 0H35V79L28 88 21 82 14 91 7 85 0 94-7 85-14 91-21 82-28 88-35 79Z';
function papel(x,y,s,color,variant='B',i=0,motion=false){
 if(variant==='A')return g(x,y,s,flag(0,0,1,color),motion?'class="flag-sway" style="--delay:'+(-i*.9)+'s"':'');
 let body=`<path d="${flagPath}" fill="${color}" opacity="${variant==='B'?.84:1}" mask="url(#${variant==='B'?'fineCut':'edgeCut'})" ${variant==='B'?'filter="url(#paperGrain)"':''}/>`;
 if(variant==='B')body+=`<path d="M-32 3H32M-32 4V72" stroke="#fff1dc" opacity=".35" fill="none" stroke-width=".7"/><path d="M-29 72Q0 65 29 72" stroke="#160c23" opacity=".23" fill="none" stroke-width="1"/>`;
 else body+=g(0,42,.66,skull(0,0,1).replace('fill="'+P.bone+'"','fill="#211b29"').replaceAll('fill="'+P.black+'"','fill="'+color+'"'));
 return g(x,y,s,`<g ${motion?'class="flag-sway" style="--delay:'+(-i*.9)+'s"':''}>${body}</g>`);
}
function garland(W,H,mobile,v='B',motion=false){let s='';const spans=mobile?[[-25,415]]:[[-45,600],[1320,1960]];
 for(const [a,b]of spans){s+=`<path d="M${a} 8Q${(a+b)/2} ${mobile?36:75} ${b} 8" fill="none" stroke="#302634" stroke-width="${mobile?2:4}"/><path d="M${a} 6Q${(a+b)/2} ${mobile?34:73} ${b} 6" fill="none" stroke="#d3b98a" stroke-width="${mobile?.7:1.4}"/>`;for(let i=0;i<(mobile?7:6);i++){if(mobile&&i>=2&&i<=4)continue;let xx=a+45+i*(mobile?61:106),yy=12+(mobile?9:27)*Math.sin(i/(mobile?6:5)*Math.PI);s+=papel(xx,yy,mobile?.42:1,[P.pink,P.orange,P.teal][i%3],v,i,motion)}}return s;
}
// Hand-authored tattoo letter paths (not a converted or typeset font).
const glyph={
 M:'M0 62L5 0 17 3 28 32 40 0 53 4 58 63 44 59 41 25 30 54 24 54 13 25 12 60Z',
 U:'M0 0L14 3 13 40Q13 57 25 57Q36 57 35 38L35 3 49 0 48 42Q47 70 23 68Q0 67 1 41Z',
 E:'M3 0L45 4 43 16 16 13 15 28 39 27 38 40 14 40 13 55 45 52 43 67 0 69Z',
 R:'M2 2Q23-2 38 5Q55 16 44 32L33 38 54 66 36 63 17 40 14 64 0 67ZM16 14L15 28Q36 30 34 19Q31 12 16 14Z',
 T:'M0 4L53 0 54 14 34 17 33 63 18 67 19 16 0 18Z',
 A:'M19 3L34 0 56 65 40 64 34 47 18 49 14 66 0 67ZM24 18L21 36 31 35Z',
 P:'M1 1Q32-4 43 7Q56 24 40 36Q30 42 16 39L14 67 0 63ZM17 13L17 27Q37 29 35 18Q33 11 17 13Z',
 O:'M24 0Q49 0 49 34Q49 68 23 69Q-2 65 0 33Q1 1 24 0ZM23 14Q13 13 14 35Q13 56 24 56Q36 54 35 34Q36 13 23 14Z',
 K:'M1 1L16 4 15 25 35 0 53 3 29 31 56 65 36 66 16 40 14 63 0 67Z'};
function tattooWord(word){let x=0,s='';for(const [i,ch]of [...word].entries()){const yy=Math.abs(i-(word.length-1)/2)*2.4;s+=g(x,yy,1,`<path d="${glyph[ch]}" fill-rule="evenodd"/>`);x+=ch==='M'?62:55;}return{s,width:x-4}}
function tattoo(x,y,w,mobile=false){const a=tattooWord('MUERTA'),b=tattooWord('POKER');let body='';
 for(const [dy,fill,sw,stroke]of [[6,'#160e1a',5,'#130c17'],[3,'#71422e',2,'#472c27'],[0,'url(#letterMetal)',1.2,'#5d3427']])body+=g(0,dy,1,a.s,`fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`)+g((a.width-b.width*.82)/2,90+dy,.82,b.s,`fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`);
 body+=`<g fill="url(#letterMetal)" stroke="#34222b" stroke-width=".6"><path d="M3 9Q-17 4-20 17Q-17 24-8 19Q-18 37-31 30Q-24 53-3 45L1 28ZM324 8Q343 2 348 13Q342 20 335 15Q349 28 356 18Q360 34 341 35L330 31Z"/><path d="M53 4L48-5 67 0 62 8ZM104 7L110-4 125 1 117 14ZM220 7L222-2 238 1 235 14ZM267 6L277-5 290 0 282 13Z"/></g><path d="M20 15L24 31M67 14Q64 40 70 52M122 17L136 18M179 17Q190 11 197 19M239 19L238 47M293 16L306 49" fill="none" stroke="#fff1cb" stroke-width="1.2" opacity=".6"/><path d="M5 75Q80 89 162 71Q245 85 327 75M4 80Q-22 97 0 99Q11 98 13 91M325 81Q351 102 329 100Q320 99 318 91M33 157Q126 169 164 159Q232 168 300 155" fill="none" stroke="${P.highlight}" stroke-width="1.5"/><path d="M68 165Q123 186 162 168Q220 191 265 162M86 175Q56 191 54 179Q56 166 73 173M244 173Q277 164 279 178Q278 191 261 180" fill="none" stroke="${P.gold}" stroke-width="2"/>`;
 return g(x,y,w/a.width,body);
}
function musician(x,y,s=1,which=0,anim=false){const bones=`<g fill="none" stroke="#c6b6b6" stroke-width="4" stroke-linecap="round"><path d="M0 15V89M-22 31Q0 45 21 31M-25 44Q0 58 25 44M-23 56Q0 70 23 56M-19 68Q0 82 19 68M-9 91L-21 126-12 151M9 91L24 121 33 147M-27 29L-43 62-20 78M27 31L44 56 22 82"/><path d="M-11 84Q0 75 11 84L9 95-9 95Z"/></g>`;
 const guitar=`<path d="M-21 63Q-39 53-43 69Q-46 82-29 87Q-23 109-9 97Q4 90-7 78L38 32 42 36-1 83Q3 66-13 70Z" fill="#50454b" stroke="#ab9691" stroke-width="2"/><path d="M-9 78L38 34M-10 80L39 35" stroke="#e0c6a0" stroke-width=".7"/><circle cx="-19" cy="82" r="5" fill="#2d2835"/>`;
 const hat=`<path d="M-39-14Q-15-7 0-9Q17-6 39-13Q44-3 28 1H-27Q-45-3-39-14ZM-21-12L-13-31Q0-37 13-31L21-12Z" fill="#2c2a3a" stroke="#87727b" stroke-width="2"/>`;
 return g(x,y,s,`<g ${anim?'class="skeleton-dance" style="--delay:'+(-which*3)+'s"':''}>${bones}${skull(0,-4,.67)}${g(0,-18,1,hat)}${guitar}</g>`,'opacity=".4"');
}
function altar(x,y,s=1){let b=`<ellipse cx="0" cy="30" rx="220" ry="31" fill="#080a12" opacity=".35"/>`;
 b+=`<path d="M-182-100L140-125 202 18-167 25Z" fill="url(#stone)" stroke="#514755" stroke-width="2"/><path d="M-182-100L140-125 171-105-159-80Z" fill="#a4978e"/><path d="M-162-88L136-113 170-100 152 15Q95 3 44 21L-156 23Z" fill="url(#cloth)"/><path d="M-145-74L-142 12M-117-81L-111 11M123-98L132 14" fill="none" stroke="#ac7688" opacity=".27" stroke-width="2"/>`;
 b+=`<path d="M-177-97L138-122 145-114-161-89Z" fill="#d2ba9a" opacity=".55"/><path d="M142-123L201 18 169 24 139-102Z" fill="#151925" opacity=".6"/><path d="M-159-83Q-105-92-46-96T137-109" fill="none" stroke="#d5a997" stroke-width="1" opacity=".52"/><path d="M-157 21Q-39 19 38 15T152 17" fill="none" stroke="#c6a188" stroke-width="1.5" opacity=".35"/>`;b+=g(-4,-122,1.45,skull(0,0,1))+flower(-19,-155,.3,P.pink)+flower(20,-150,.3,P.teal);
 b+=`<path d="M-19-125Q-12-120-8-126M8-125Q14-120 20-125M0-144L-4-137 0-132 4-137Z" stroke="${P.orange}" fill="none" stroke-width="2"/>`;
 for(let i=0;i<10;i++)b+=flower(-137+i*29,-78-15*Math.sin(i*.5),.55+i%2*.13,i%3===0?P.pink:P.orange);
 b+=`<path d="M-88-79L-90-143-37-149-34-87Z" fill="#2a2332" stroke="#b28d72" stroke-width="3"/><path d="M-83-136L-43-141-41-91-80-86Z" fill="#51424e"/>${skull(-63,-115,.33)}<path d="M102-80L97-138 148-133 157-78Z" fill="#302734" stroke="#c2a67e" stroke-width="3"/>${flower(124,-110,.7,P.teal)}`;
 return g(x,y,s,b,'filter="url(#grain)"');
}
function scenery(W,H,mobile,{bg='C',flags='B',motion=0,logo=true,deep=true,stake=false}={}){
 // Scene coordinates scale from landscape. Portrait is separately composed, not a crop.
 let s=rect(0,0,W,H,`url(#sky${bg})`);const sx=W/1920,sy=H/1080;
 const layer=mobile?1:sx;
 if(stake){s+=`<ellipse cx="${W*.5}" cy="${H*.30}" rx="${W*.76}" ry="${H*.5}" fill="url(#mist)"/><ellipse cx="${W*.17}" cy="${H*.72}" rx="${W*.7}" ry="${H*.5}" fill="url(#amber)"/>`}
 if(deep){
 s+=`<path d="M0 ${H*.49}Q${W*.24} ${H*.34} ${W*.51} ${H*.53}T${W} ${H*.45}V${H}H0Z" fill="#4d3c56" opacity=".25"/><path d="M0 ${H*.67}Q${W*.3} ${H*.48} ${W*.63} ${H*.68}T${W} ${H*.56}V${H}H0Z" fill="#202735" opacity=".64"/>`;
 const arches=mobile?9:18;for(let i=0;i<arches;i++){const xx=i*W/arches,yy=H*.51+(i%3)*H*.026,ww=W/arches*.78;s+=`<path d="M${xx} ${H*.72}V${yy+ww*.6}Q${xx+ww*.5} ${yy-ww*.15} ${xx+ww} ${yy+ww*.6}V${H*.72}" fill="none" stroke="#aca1b6" stroke-width="${mobile?2:5}" opacity=".1"/>`}
 s+=`<ellipse cx="${W*.22}" cy="${H*.48}" rx="${W*.39}" ry="${H*.43}" fill="url(#mist)"/><ellipse cx="${W*.87}" cy="${H*.46}" rx="${W*.28}" ry="${H*.43}" fill="url(#mist)"/><ellipse cx="${W*.14}" cy="${H*.77}" rx="${W*.32}" ry="${H*.36}" fill="url(#amber)"/>`;
 s+=`<path d="M0 ${H*.79}Q${W*.47} ${H*.7} ${W} ${H*.8}V${H}H0Z" fill="#27262f"/>`;
 for(let i=0;i<7;i++){const yy=H*(.79+i*.031);s+=`<path d="M0 ${yy}Q${W*.45} ${yy-H*.012} ${W} ${yy}" stroke="#9a888c" opacity="${.15+i*.012}" fill="none" stroke-width="${mobile?.6:1.3}"/>`}
 for(let i=0;i<14;i++)s+=line(W*.49,H*.77,(i-2)*W/10,H,'#ada0a0',mobile?.5:1,'opacity=".07"');
 if(!mobile){s+=musician(205*sx,H*.46,1.15*layer,0,motion===1)+musician(452*sx,H*.48,.83*layer,1,motion===1)+altar(290*sx,H*.81,1.2*layer);for(let i=0;i<15;i++)s+=flower((45+i*34)*sx,H*(.88+.035*Math.sin(i)),(.65+i%3*.15)*layer,i%4===0?P.pink:P.orange);s+=g(1770*sx,H*.76,1.1*layer,skull(0,0,1))}
 else{s+=musician(W*.13,H*.32,.55,0,motion===1)+musician(W*.88,H*.28,.45,1,motion===1)+altar(W*.16,H*.81,.43)+g(W*.90,H*.795,.8,skull(0,0,1));for(let i=0;i<10;i++)s+=flower(10+i*42,H*.85+(i%2)*8,.4,i%4===0?P.pink:P.orange)}
 }
 if(!stake)s+=garland(W,H,mobile,flags,motion===2);else{s+=g(0,0,W/390,garland(390,844,true,flags,motion===2))}
 if(motion===3){for(let i=0;i<14;i++){const x=mobile?12+(i*41)%370:(36+i*83)%580,y=H*(.2+(i%7)*.08);s+=g(x,y,mobile?.65:1,`<g class="petal-drift ${i>3?'lite-hide':''}" style="--delay:${-i*1.1}s;--dur:${13+i%5}s">${i%3?`<path d="M-4 0Q0-11 6-4Q10 2 1 5Z" fill="${P.orange}" opacity=".38"/>`:`<path d="M-8-2Q-14-7-14-1Q-15 6-8 3H7Q14 9 14 2Q15-5 8-2Z" fill="${P.bone}" opacity=".23"/>`}</g>`)}}
 if(logo&&!stake)s+=mobile?tattoo(140,10,110,true):tattoo(125*sx,140*sy,315*sx);
 return s;
}
function geometry(m){const x=m?0:610,y=m?84:0,w=m?390:700,h=m?555:954,cw=m?64:112,ch=m?90:157,dx=m?71:126,dy=m?97:173;return{x,y,w,h,cw,ch,dx,dy,gx:x+(w-(4*dx+cw))/2,gy:y+(h-(4*dy+ch))/2}}
function badge(x,y,w,h,v='A',value=3,win=false){let b='',scale=w/120;const fill=win?'url(#metal)':'url(#badge)',fg=win?P.black:P.bone;
 if(v==='A'){b=`<circle cx="92" cy="133" r="21" fill="${fill}" stroke="${P.highlight}" stroke-width="1.6"/><circle cx="92" cy="133" r="17" fill="none" stroke="${P.gold}" stroke-width=".7"/>`+text(92,140,'×'+value,21,fg,'Oswald','text-anchor="middle"')}
 if(v==='B'){b=`<path d="M23 112L103 112 110 132 100 149 24 148 18 130Z" fill="${fill}" stroke="${P.highlight}" stroke-width="1.3"/><path d="M25 115H99" stroke="${P.bone}" opacity=".35"/>`+text(63,138,'×'+value,24,fg,'Oswald','text-anchor="middle"')}
 if(v==='C'){b=`<path d="M67-3L91-3 104 12 104 40 57 40 57 12Z" fill="${fill}" stroke="${P.highlight}" stroke-width="1.3"/><path d="M80-9V7" stroke="${P.bone}" stroke-width="1.5"/><circle cx="80" cy="8" r="3" fill="${P.metalDark}"/>`+text(80,32,'×'+value,23,fg,'Oswald','text-anchor="middle"')}
 if(win)b+=`<path d="M49 115L43 109M107 101L113 95M114 151L120 157" stroke="${P.highlight}" stroke-width="2"/>`;
 return g(x,y,scale,b);
}
function board(m,state,d,opt={}){const q=geometry(m),{x,y,w,h,cw,ch,dx,dy,gx,gy}=q,target=d.target;let s=rect(x,y,w,h,'url(#metal)',8,`stroke="${P.metalDark}" stroke-width="2"`)+rect(x+7,y+7,w-14,h-14,'url(#hud)',8,`stroke="${P.highlight}" stroke-width="1"`)+rect(x+17,y+17,w-34,h-34,state==='fs'?'url(#enamel)':P.black,8,`stroke="${state==='fs'?P.teal:P.gold}" stroke-width="${state==='fs'?3:1}"`);
 const winners=new Set();if(state!=='idle')for(const l of target.lines)for(const i of l.id<5?Array.from({length:5},(_,c)=>l.id*5+c):l.id===5?[0,6,12,18,24]:[4,8,12,16,20])winners.add(i);
 for(let i=0;i<25;i++){const xx=gx+i%5*dx,yy=gy+Math.floor(i/5)*dy,dim=state!=='idle'&&!winners.has(i);let face=shell(d.cards[i],xx,yy,cw,ch,winners.has(i),opt.courts||'queen-a');if(dim)face=`<g style="filter:brightness(${opt.dim==='soft'?.74:.62})">${face}</g>`;s+=`<g data-card-index="${i}" data-rank="${d.cards[i].rank||''}" data-suit="${d.cards[i].suit||''}" data-golden="${!!d.cards[i].golden}">${face}</g>`;
 const val=opt.badgeDemo&&i===9?3:target?.multipliers?.[i];if(val>0&&!d.cards[i].golden&&state!=='fs')s+=badge(xx,yy,cw,ch,opt.badge||'A',val,state!=='idle');}
 const sc=m?.38:.64;s+=ornament(x+8,y+8,sc)+`<g transform="translate(${x+w-8} ${y+8}) scale(-1 1)">${ornament(0,0,sc)}</g><g transform="translate(${x+8} ${y+h-8}) scale(1 -1)">${ornament(0,0,sc)}</g><g transform="translate(${x+w-8} ${y+h-8}) scale(-1 -1)">${ornament(0,0,sc)}</g>`;
 if(state!=='idle')for(const[lidx,l]of target.lines.entries()){
 const old=d.labels[lidx],labelY=old?gy+ch/2+((old.ny*1146-72-94)/205)*dy:gy+l.id*dy+ch*.50,cx=old?gx+cw/2+((old.nx*800-40-67)/146)*dx:x+w/2;
 const current=opt.winStyle==='current';
 s+=(l.id<5?line(gx+cw*.5,gy+l.id*dy+ch*.5,gx+4*dx+cw*.5,gy+l.id*dy+ch*.5,P.gold,m?1:1.5,'opacity=".62"'):'');
 const ns=m?13.5:24,cs=m?28:48;
 s+=`<g class="hand-label line-${lidx}" data-focus="${lidx}" style="paint-order:stroke fill;stroke-linejoin:round">${text(cx,labelY-(m?8:15),names[l.hand_index],ns,current?'#ffd97a':P.highlight,'Oswald',`text-anchor="middle" stroke="#0a0607" stroke-width="${m?(current?5:3.5):(current?8:6)}"`)}${text(cx,labelY+(m?12:21),l.win_x.toFixed(2),cs,current?'#fff7e7':P.bone,'Oswald',`text-anchor="middle" stroke="#0a0607" stroke-width="${m?(current?7:5):(current?12:9)}"`)}</g>`;
 }
 return s;
}
function bank(m,v='A',stage='start',d){const bankVal=stage==='start'?3:10,left=stage==='retrigger'?14:9,plus=stage==='retrigger';let s='';
 if(v==='A'){
 const x=m?49:365,y=m?25:20,w=m?292:240,h=m?50:39;
 s+=rect(x,y,w,h,'url(#enamel)',6,`stroke="${P.highlight}" stroke-width="${m?1.4:2}"`)+text(x+w*.25,y+(m?18:13),'BONUS BANK',m?9:10,P.teal,'Oswald','text-anchor="middle" letter-spacing="1"')+text(x+w*.25,y+(m?43:33),'×'+bankVal,m?24:23,P.bone,'Oswald','text-anchor="middle"')+line(x+w*.47,y+7,x+w*.47,y+h-7,P.gold,1)+text(x+w*.74,y+(m?18:13),'FREE SPINS LEFT',m?8.5:10,P.highlight,'Oswald','text-anchor="middle"')+text(x+w*.74,y+(m?42:33),String(left),m?22:21,P.orange,'Oswald','text-anchor="middle"');
 }else if(v==='B'){
 if(!m){
 s+=g(170,335,1,`<path d="M0 72Q0 0 100 0Q200 0 200 72V225H0Z" fill="url(#stone)" stroke="${P.gold}" stroke-width="3"/>${rect(11,73,178,136,'url(#enamel)',5,`stroke="${P.gold}" stroke-width="1"`)}${skull(100,46,.65)}${text(100,95,'BONUS BANK',12,P.teal,'Oswald','text-anchor="middle" letter-spacing="1"')}${text(100,138,'×'+bankVal,44,P.bone,'Oswald','text-anchor="middle"')}${line(35,150,165,150,P.gold,1)}${text(100,169,'FREE SPINS LEFT',12,P.highlight,'Oswald','text-anchor="middle"')}${text(100,201,String(left),29,P.orange,'Oswald','text-anchor="middle"')}`);

 }else{
 s+=`<path d="M4 25Q4 4 45 4Q86 4 86 25V72H4Z" fill="url(#stone)" stroke="${P.gold}" stroke-width="1.2"/>${rect(8,29,74,38,'url(#enamel)',4)}${skull(45,18,.22)}${text(45,41,'BONUS BANK',8,P.teal,'Oswald','text-anchor="middle"')}${text(45,63,'×'+bankVal,25,P.bone,'Oswald','text-anchor="middle"')}<path d="M304 25Q304 4 345 4Q386 4 386 25V72H304Z" fill="url(#stone)" stroke="${P.gold}" stroke-width="1.2"/>${rect(308,29,74,38,'url(#enamel)',4)}${skull(345,18,.22)}${text(345,41,'FS LEFT',8,P.highlight,'Oswald','text-anchor="middle"')}${text(345,63,String(left),25,P.orange,'Oswald','text-anchor="middle"')}`;
 }
 }else{
 const x=m?4:633,y=m?85:4,w=m?382:653,h=m?31:41;
 s+=rect(x,y,w,h,'url(#enamel)',4,`stroke="${P.teal}" stroke-width="1.5"`)+text(x+10,y+(m?13:15),'BANK',m?9:12,P.teal)+text(x+48,y+(m?24:32),'×'+bankVal,m?23:30,P.bone)+text(x+w-92,y+(m?12:15),'FS LEFT',m?8.5:12,P.highlight)+text(x+w-22,y+(m?24:32),String(left),m?23:30,P.orange,'Oswald','text-anchor="end"');
 }
 if(plus){const xx=m?195:968,yy=m?67:95;s+=g(xx,yy,m?.62:1,rect(-66,-22,132,42,'url(#enamel)',12,`stroke="${P.teal}" stroke-width="2"`)+text(0,8,'+5 FREE SPINS',19,P.bone,'Oswald','text-anchor="middle"'))}
 return s;
}
function screen(profile,state,opt={}){const m=profile==='portrait',W=m?390:1920,H=m?844:1080,d=data[profile+'-'+state];let s=scenery(W,H,m,{...opt,logo:state!=='fs'})+(!m?payboard(d.target,state):'')+board(m,state,d,opt)+(state==='fs'?bank(m,opt.bank||'A',opt.bankStage||'start',d):'');
 let h=hud(m,state,d.target);if(state==='fs')h=h.replaceAll('2.25',d.amount);if(state==='win')h=h.replaceAll('1.00',d.amount);s+=h;
 return svg(W,H,s,state);
}
function emit(name,profile,state,opt){const p=name+'-'+profile+'-'+state+'.svg';fs.writeFileSync(dir+'/'+p,screen(profile,state,opt));manifest.screens.push({file:p,profile,state,options:opt,amount:data[profile+'-'+state].amount,source:`current-${profile}-${state}.json`});}
function motionCss(){return `<style>
.flag-sway{transform-box:fill-box;transform-origin:50% 0%;animation:sway 9s ease-in-out infinite;animation-delay:var(--delay,0s)}
.skeleton-dance{transform-box:fill-box;transform-origin:50% 100%;animation:dance 14s ease-in-out infinite;animation-delay:var(--delay,0s)}
.petal-drift{animation:drift var(--dur,16s) ease-in-out infinite;animation-delay:var(--delay,0s)}
@keyframes sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
@keyframes dance{0%,100%{transform:rotate(-1deg) translateY(0)}50%{transform:rotate(1.5deg) translateY(-3px)}}
@keyframes drift{0%,100%{transform:translate(0,0) rotate(-10deg)}50%{transform:translate(10px,18px) rotate(25deg)}}
.reduced .flag-sway,.reduced .skeleton-dance,.reduced .petal-drift{animation:none!important}
.lite .skeleton-dance{animation:none}.lite .flag-sway{animation-duration:15s}.lite .lite-hide{display:none}
@media(prefers-reduced-motion:reduce){.flag-sway,.skeleton-dance,.petal-drift{animation:none!important}}
</style>`}
function run(){for(const p of ['desktop','portrait'])for(const st of ['idle','win','fs'])data[p+'-'+st]=JSON.parse(fs.readFileSync(dir+`/current-${p}-${st}.json`));
 for(const p of ['desktop','portrait']){
 for(const st of ['idle','win','fs'])for(const bg of ['A','B','C'])emit('background-'+bg,p,st,{bg});
 for(const set of ['queen-a','earlier'])emit('courts-'+set,p,'win',{courts:set});
 for(const v of ['current','improved'])emit('hand-'+v,p,'win',{winStyle:v});
 for(const v of ['A','B','C']){emit('flags-'+v,p,'win',{flags:v});for(const st of ['idle','win'])emit('badge-'+v,p,st,{badge:v,badgeDemo:true});for(const bankStage of ['start','max','retrigger'])emit('bank-'+v+'-'+bankStage,p,'fs',{bank:v,bankStage});}
 for(const dim of ['soft','deep'])emit('dim-'+dim,p,'win',{dim});
 for(let i=1;i<=3;i++)for(const mode of ['full','reduced','lite']){
 let s=screen(p,'win',{motion:i});s=s.replace('</svg>',motionCss()+'</svg>').replace('<svg xmlns=',`<svg class="${mode}" xmlns=`);const f=`motion-${i}-${mode}-${p}.svg`;fs.writeFileSync(dir+'/'+f,s);manifest.motion.push({file:f,profile:p,motion:i,mode});}
 }
 for(const set of ['queen-a','earlier'])for(const id of ['JS','JH','JD','JC','QS','QH','QD','QC','KS','KH','KD','KC'])for(const[w,h]of[[86,121],[60,85]]){let f=`court-${set}-${id}-${w}.svg`;fs.writeFileSync(dir+'/'+f,svg(w,h,shell({rank:id[0],suit:id[1]},0,0,w,h,false,set)));manifest.native.push({file:f,set,id,w,h})}
 for(const v of ['A','B','C'])for(const win of [false,true])for(const[w,h]of[[86,121],[60,85]]){const f=`badge-${v}-${win?'win':'idle'}-${w}.svg`;fs.writeFileSync(dir+'/'+f,svg(w,h,shell({rank:'Q',suit:'H'},0,0,w,h,win)+badge(0,0,w,h,v,3,win)));manifest.native.push({file:f,badge:v,win,w,h})}
 for(const v of ['A','B','C'])for(const[W,H,label]of[[1200,1600,'3x4'],[1080,1920,'9x16']]){const f=`stake-${v}-${label}.svg`;fs.writeFileSync(dir+'/'+f,svg(W,H,scenery(W,H,true,{bg:v,flags:'B',stake:true,logo:false})));manifest.backgrounds.push({file:f,variant:v,format:label,W,H})}
 for(const p of ['desktop','portrait'])for(const v of ['A','B','C']){const m=p==='portrait',W=m?390:1920,H=m?844:1080;fs.writeFileSync(dir+`/background-only-${v}-${p}.svg`,svg(W,H,scenery(W,H,m,{bg:v,logo:false})));}
 fs.writeFileSync(dir+'/logo-lettering.svg',svg(780,420,rect(0,0,780,420,'url(#skyC)')+tattoo(46,28,670)));
 // Same frame/background, three equal garlands, both requested viewport sizes.
 for(const p of ['desktop','portrait']){const m=p==='portrait',W=m?390:1920,H=m?844:1080;let s=scenery(W,H,m,{bg:'C',flags:'A',logo:false});s+=rect(0,0,m?390:600,m?82:190,'url(#skyC)');for(const[v,i]of[['A',0],['B',1],['C',2]]){const xx=i*(m?130:200),yy=m?0:30;s+=text(xx+(m?65:100),yy+(m?12:24),v,m?11:20,P.bone,'Oswald','text-anchor="middle"');for(let j=0;j<3;j++)s+=papel(xx+(m?25+j*40:42+j*59),yy+(m?20:42),m?.48:.73,[P.pink,P.orange,P.teal][j],v,j)}s+=board(m,'win',data[p+'-win'],{});s+=hud(m,'win',data[p+'-win'].target);if(!m)s+=payboard(data[p+'-win'].target,'win');const f=`flags-triptych-${p}.svg`;fs.writeFileSync(dir+'/'+f,svg(W,H,s));}
 fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log({screens:manifest.screens.length,cards:manifest.native.length,motion:manifest.motion.length,stake:manifest.backgrounds.length});}
if(require.main===module)run();module.exports={scenery,geometry,screen,svg,manifest,run};
