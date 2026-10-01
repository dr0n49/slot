// Only items 8 / 9. Review compositions, no Phase 2 production integration.
const fs=require('node:fs');
const {P,rect,text,line,g,defs,hud,payboard,flag,pip}=require('./build-direction.cjs');
const {svg,board}=require('./build-review-1b.cjs');
const root=__dirname,dir=root+'/review-1c';fs.mkdirSync(dir,{recursive:true});
const fixture=(p,s)=>JSON.parse(fs.readFileSync(root+`/review-1b/current-${p}-${s}.json`));
const A={
 M:['M-2 11L7 5H22L35 54L50 5H67L76 11L67 15V77Q67 83 77 85V92H43V86L50 81V28L37 71H29L14 27V79L21 85V92H-3V85L5 80V15Z',81],
 U:['M-1 11L9 4H28V11L22 16V60Q22 80 39 82Q53 83 53 61V16L45 11V5H64L73 12L61 16V61Q61 91 35 94Q6 91 6 62V16Z',78],
 E:['M-2 11L9 4H63L72 30L62 25Q56 14 45 13H24V41H43L53 34V62L44 55H24V81H48Q61 80 65 68L77 62L69 94H9L-2 87L7 80V55L0 49L7 41V17Z',82],
 R:['M-2 11L9 4H39Q72 4 72 29Q71 48 47 52Q54 67 65 79L80 85L70 96Q55 95 47 82L31 57H24V80L33 86V93H0V86L8 80V17ZM24 13V47H36Q55 46 55 29Q55 13 36 13Z',85],
 T:['M0 6Q37 2 75 6L84 32L71 24Q68 16 49 15V79L60 86V94H17V86L29 79V15Q10 16 7 24L-7 32Z',88],
 A:['M27 6L42 2Q51 43 72 81L83 87L73 95H45V87L52 81L44 64H22L16 81L24 87V94H-3V87L6 81Q18 45 27 6ZM25 55H40L31 29Z',88],
 P:['M1 4H38Q69 4 69 28Q69 52 36 52H23V81H33V88H1V81H8V10H1ZM23 12V44H35Q51 44 51 28Q51 12 35 12Z',73],
 O:['M35 2Q68 2 69 46Q69 90 35 90Q1 90 1 46Q1 2 35 2ZM35 11Q18 11 18 47Q18 81 36 81Q55 81 54 46Q53 11 35 11Z',75],
 K:['M1 4H32V10H23V43L50 14Q53 10 47 10H44V4H70V10H65L38 41 65 79Q68 82 73 82V88H47V81H51L23 52V81H32V88H1V81H8V10H1Z',78]
};
const B={
 M:['M2 9L16 2 37 48 56 2 72 9 65 20V78L74 87 58 96 45 87 51 78V34L37 72H32L15 35V78L22 88 7 96 0 88 6 79V20Z',80],
 U:['M0 12L13 2 28 11 22 20V69L36 84 52 71V20L46 12 58 2 72 11 65 21V72L37 96 7 78V22Z',78],
 E:['M2 12L16 2H65L72 22 57 18H25V41H51L59 35V60L51 54H25V80H56L72 71 64 94H14L2 85 8 76V23Z',78],
 R:['M0 12L14 2H42L67 15V40L47 52 66 77 78 85 62 96 47 84 27 57H23V78L32 87 16 96 2 87 8 78V22ZM24 18V42H39L50 34V24L38 18Z',82],
 T:['M1 3H75L80 23 62 17H47V77L57 87 38 98 20 87 30 78V17H14L-3 25Z',83],
 A:['M31 2L45 8 67 77 79 86 61 97 45 87 48 78 44 62H21L16 79 23 87 7 96-3 86 5 77 25 18ZM24 51H39L30 26Z',83],
 P:['M1 12L14 2H43L70 18V41L45 57H23V78L31 87 14 96 1 87 8 78V22ZM23 17V43H40L53 35V25L39 17Z',78],
 O:['M33 1L63 12 72 47 59 82 35 97 8 80 0 45 9 15ZM32 17L22 25 19 65 36 82 49 67 51 30Z',78],
 K:['M1 12L14 2 30 11 24 20V42L52 14 46 7 65 2 79 14 66 20 41 44 68 78 81 86 62 97 45 86 48 79 24 56V78L33 87 16 97 2 87 8 78V22Z',86]
};
function word(label,v){const glyph=v==='A'?A:B;let x=0,s='';for(const [i,c]of [...label].entries()){const [d,w]=glyph[c],dy=(Math.abs(i-(label.length-1)/2))**1.5*(v==='A'?2.2:1.2);s+=g(x,dy,1,`<path d="${d}" fill-rule="evenodd" data-letter="${c}"/>`);x+=w+5}return{s,w:x-5}}
function lettering(x,y,w,v='A'){const main=word('MUERTA',v),sub=word('POKER',v),W=main.w;let b='';
 // The ribbon is behind POKER. Fold faces and returns are deliberate closed shapes.
 const front=v==='A'?'url(#ribbonWine)':'url(#ribbonBone)',ink=v==='A'?P.bone:P.black;
 b+=`<path d="M25 129L-14 123-2 151-20 178 37 171V142ZM${W-25} 129L${W+14} 123 ${W+2} 151 ${W+20} 178 ${W-37} 171V142Z" fill="${v==='A'?'#462331':'#876445'}" stroke="${P.black}" stroke-width="2"/>`;
 b+=`<path d="M35 139L25 168 47 184V150ZM${W-35} 139L${W-25} 168 ${W-47} 184V150Z" fill="#37252c" stroke="${P.black}" stroke-width="1.5"/>`;
 b+=`<path d="M35 114Q${W/2} 126 ${W-35} 114L${W-25} 179Q${W/2} 193 25 179Z" fill="${front}" stroke="${P.black}" stroke-width="2.8"/><path d="M41 120Q${W/2} 132 ${W-41} 120M32 172Q${W/2} 185 ${W-32} 172" fill="none" stroke="${P.gold}" stroke-width="1.4"/>`;
 for(const [dy,fill,stroke,sw]of [[4,'#33212a',P.black,3.4],[1.7,P.gold,'#694329',1.3],[0,v==='A'?'url(#tattooGold)':'url(#letterBone)',P.black,1.7]])b+=g(0,dy,1,main.s,`fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`);
 const ss=.58,xx=(W-sub.w*ss)/2;b+=g(xx,122,ss,sub.s,`fill="${ink}" stroke="${v==='A'?P.black:'#a07849'}" stroke-width="1" stroke-linejoin="round"`);
 return g(x,y,w/W,b,`data-logo="${v}"`);
}
function artDefs(){return `<defs>
<linearGradient id="tattooGold" x2=".18" y2="1"><stop stop-color="#f3dfaf"/><stop offset=".32" stop-color="#e2c28c"/><stop offset=".66" stop-color="#be9158"/><stop offset="1" stop-color="#8a623d"/></linearGradient>
<linearGradient id="letterBone" x2=".13" y2="1"><stop stop-color="#f6e8c7"/><stop offset=".45" stop-color="#dfca9e"/><stop offset=".48" stop-color="#c9ac7c"/><stop offset="1" stop-color="#b69263"/></linearGradient>
<linearGradient id="ribbonWine" x2=".1" y2="1"><stop stop-color="#854355"/><stop offset=".35" stop-color="#583044"/><stop offset="1" stop-color="#362432"/></linearGradient>
<linearGradient id="ribbonBone" x2=".3" y2="1"><stop stop-color="#f0dfb5"/><stop offset=".7" stop-color="#c5a979"/><stop offset="1" stop-color="#997442"/></linearGradient>
<linearGradient id="mahogany" x2="1" y2=".3"><stop stop-color="#73413b"/><stop offset=".2" stop-color="#47282b"/><stop offset=".75" stop-color="#352631"/><stop offset="1" stop-color="#1c1b28"/></linearGradient>
<linearGradient id="limestone" x2=".6" y2="1"><stop stop-color="#aaa194"/><stop offset=".2" stop-color="#68626d"/><stop offset="1" stop-color="#292936"/></linearGradient>
<linearGradient id="ceramic" x2="1" y2=".6"><stop stop-color="#fff0ce"/><stop offset=".35" stop-color="#e3cba1"/><stop offset=".75" stop-color="#b09a7d"/><stop offset="1" stop-color="#807065"/></linearGradient>
<linearGradient id="waxStill" x2="1" y2=".1"><stop stop-color="#f6e6bf"/><stop offset=".25" stop-color="#d9c391"/><stop offset="1" stop-color="#85694e"/></linearGradient>
<linearGradient id="portraitPaper" x2=".6" y2="1"><stop stop-color="#998a75"/><stop offset=".55" stop-color="#625557"/><stop offset="1" stop-color="#352e3b"/></linearGradient>
<radialGradient id="marigold"><stop stop-color="#ffd173"/><stop offset=".4" stop-color="#eea329"/><stop offset="1" stop-color="#a45126"/></radialGradient>
<radialGradient id="warmSpill"><stop stop-color="#efad62" stop-opacity=".35"/><stop offset=".45" stop-color="#e58e59" stop-opacity=".14"/><stop offset="1" stop-color="#e58e59" stop-opacity="0"/></radialGradient>
<linearGradient id="altarCloth" x2="1" y2=".4"><stop stop-color="#604559"/><stop offset=".26" stop-color="#3c2c42"/><stop offset=".4" stop-color="#765064"/><stop offset=".42" stop-color="#4e364c"/><stop offset=".8" stop-color="#322b3d"/><stop offset="1" stop-color="#1f2431"/></linearGradient>
<linearGradient id="columnStone" x2="1" y2=".13"><stop stop-color="#443949"/><stop offset=".21" stop-color="#887885"/><stop offset=".46" stop-color="#a09296"/><stop offset=".7" stop-color="#665562"/><stop offset="1" stop-color="#302737"/></linearGradient>
<radialGradient id="sepiaBone" cx=".31" cy=".22" r=".9"><stop stop-color="#e2caa0"/><stop offset=".45" stop-color="#bca17c"/><stop offset="1" stop-color="#6a5148"/></radialGradient>
<radialGradient id="stillCandleLight"><stop stop-color="#ffd996" stop-opacity=".23"/><stop offset=".32" stop-color="#ffd996" stop-opacity=".09"/><stop offset="1" stop-color="#eea54f" stop-opacity="0"/></radialGradient>
<radialGradient id="alcoveLight" cx=".38" cy=".35" r=".67"><stop stop-color="#a5737b" stop-opacity=".46"/><stop offset=".54" stop-color="#795171" stop-opacity=".19"/><stop offset="1" stop-color="#37213d" stop-opacity="0"/></radialGradient>
<radialGradient id="fogVeil"><stop stop-color="#ac8eae" stop-opacity=".08"/><stop offset="1" stop-color="#877792" stop-opacity="0"/></radialGradient>
</defs>`}
function bloom(x,y,s=1,v=0){let b='<ellipse cy="10" rx="28" ry="23" fill="#231c2c" opacity=".32"/>';const n=v===2?12:18;for(let i=0;i<n;i++){const a=i*360/n;b+=`<path d="M-3-7Q-13-15-7-24L-5-28-2-25 0-30 3-25 6-27Q13-16 4-7Z" transform="rotate(${a})" fill="${v===1?'#b45477':'url(#marigold)'}" stroke="#633624" stroke-width=".65"/><path d="M0-12Q-1-21 1-25" transform="rotate(${a})" fill="none" stroke="${v===1?'#d87999':'#f6c568'}" stroke-width=".65" opacity=".55"/>`}
 for(let i=0;i<9;i++)b+=`<ellipse cx="0" cy="-8" rx="3.2" ry="7" transform="rotate(${i*40})" fill="${v===1?'#db8ca1':'#cc7a25'}" stroke="#793e24" stroke-width=".55"/>`;b+=`<circle r="5.5" fill="#834c2d"/><path d="M-3-2L0-4 3-1 1 3-3 2Z" fill="${v===1?'#e1a0b1':'#e4a243'}"/>`;return g(x,y,s,b);
}
function ceramicSkull(x,y,s=1){let b=`<ellipse cy="30" rx="32" ry="7" fill="#201b27" opacity=".63"/><path d="M-29-15Q-33-52 0-55Q33-52 29-15L23-1 18 4 17 22Q0 33-17 22L-18 4-23-1Z" fill="url(#ceramic)" stroke="#3b2931" stroke-width="1.8"/><path d="M-20-38Q-11-48 2-48M-26-20Q-30-5-17 0M26-20Q30-5 17 0" fill="none" stroke="#6f5749" stroke-width=".8"/><path d="M-25-28Q-26-44-12-48M-26-6L-18 2M-12 25Q0 30 12 25" fill="none" stroke="#fff1d4" stroke-width="1.2" opacity=".65"/><path d="M23-35Q29-6 13 4L14 22" fill="none" stroke="#70564d" stroke-width="1.2" opacity=".4"/>`;
 for(const xx of [-13,13]){for(let i=0;i<8;i++)b+=`<ellipse cx="${xx}" cy="-26" rx="3" ry="5.6" transform="rotate(${i*45} ${xx} -18)" fill="${P.pink}" stroke="#653544" stroke-width=".7"/>`;b+=`<ellipse cx="${xx}" cy="-18" rx="7" ry="8" fill="#241d29"/><ellipse cx="${xx-2}" cy="-20" rx="2.5" ry="3" fill="#665153"/>`}
 b+=`<path d="M0-11L-5-1 0 2 5-1Z" fill="#2c2130"/><path d="M-19 5Q0 15 19 5M-18 21Q0 28 18 21" fill="none" stroke="#5b403d" stroke-width="1"/>`;
 for(let i=0;i<6;i++)b+=rect(-15+i*5.1,10,4.6,11,'#ead5ae',1,'stroke="#5b403d" stroke-width=".75"');b+=`<path d="M0-46L-4-40 0-34 4-40ZM-21-3Q-18 1-13 0M21-3Q18 1 13 0" fill="${P.teal}" stroke="#3d5353" stroke-width=".7"/>`+bloom(0,-40,.20);return g(x,y,s,b);
}
function candle(x,y,h=100,w=25){return g(x,y,1,`<ellipse cy="${-h-18}" rx="90" ry="112" fill="url(#stillCandleLight)"/><ellipse cy="2" rx="${w*.86}" ry="6" fill="#1a1723" opacity=".65"/><path d="M${-w/2} ${-h}H${w/2}V0Q0 8 ${-w/2} 0Z" fill="url(#waxStill)" stroke="#66503e" stroke-width="1"/><ellipse cy="${-h}" rx="${w/2}" ry="3.5" fill="#f1ddb1"/><ellipse cy="${-h}" rx="${w*.36}" ry="1.8" fill="#8c6a40"/><path d="M${-w*.3} ${-h}V${-h+18}Q${-w*.1} ${-h+31} ${-w*.12} ${-h+39}" fill="none" stroke="#eddbb1" stroke-width="2"/><path d="M${w*.24} ${-h+7}V${-h+24}Q${w*.4} ${-h+28} ${w*.34} ${-h+36}" fill="none" stroke="#b99467" stroke-width="1"/><path d="M${-w*.1} ${-h+54}Q${-w*.15} ${-h+72} ${-w*.1} -4" fill="none" stroke="#f1ddb1" stroke-opacity=".3" stroke-width=".8"/><path d="M0 ${-h-4}C-11 ${-h-15}-5 ${-h-25} 1 ${-h-35}C4 ${-h-19} 10 ${-h-13} 0 ${-h-4}Z" fill="#efa934"/><path d="M0 ${-h-5}C-5 ${-h-12}-3 ${-h-18} 1 ${-h-23}C4 ${-h-12} 4 ${-h-8} 0 ${-h-5}Z" fill="#ffe0a0"/><path d="M0 ${-h}V${-h-8}" stroke="#2a2028" stroke-width="1.2"/>`, 'data-static-candle="true"')}
function remembrance(person){let b=`<path d="M-43 92L-36 54Q-29 37-14 34L14 34Q29 37 36 54L43 92Z" fill="#302831" stroke="#b29776" stroke-width="1.1"/><path d="M-35 54L-25 44-18 42-8 75-27 85ZM35 54L25 44 18 42 8 75 27 85Z" fill="#5c4548" stroke="#ad916e" stroke-width=".8"/><path d="M-15 34L0 64 15 34 9 31H-9Z" fill="#baa07e" stroke="#574037" stroke-width="1"/><path d="M-10 42L0 55 10 42M-6 46L0 62 6 46M0 63V90" fill="none" stroke="#4e3739" stroke-width=".7"/><path d="M-7 28V36Q0 41 7 36V28" fill="url(#sepiaBone)" stroke="#5c4238" stroke-width="1"/><path d="M-7 31H7M-7 35H7" stroke="#63463a" stroke-width=".6"/>`;
 b+=`<path d="M-19-6Q-22-32 0-35Q22-32 19-6L17 7 13 13 12 26Q0 35-12 26L-13 13-17 7Z" fill="url(#sepiaBone)" stroke="#402c2d" stroke-width="1.15"/><path d="M-16-18Q-10-29 1-30M-17-3Q-14 5-9 6M17-3Q14 5 9 6M-13 24Q0 29 13 24" stroke="#e1c5a0" stroke-opacity=".7" stroke-width=".75" fill="none"/><path d="M-17-10Q-11-21-4-15L-3-8Q-6 3-14 0ZM17-10Q11-21 4-15L3-8Q6 3 14 0Z" fill="#362830" stroke="#866553" stroke-width=".7"/><path d="M-15-14Q-9-21-3-16M15-14Q9-21 3-16M-15 3L-11 10-5 12M15 3L11 10 5 12" fill="none" stroke="#7c5b4c" stroke-width="1.2"/><path d="M0 2L-5 12Q0 15 5 12Z" fill="#38292e"/><path d="M-9 18Q0 15 9 18L8 26Q0 29-8 26Z" fill="#d4b990" stroke="#604334" stroke-width=".8"/>`;
 for(let i=0;i<6;i++)b+=`<path d="M${-7.5+i*3} 18V25" fill="none" stroke="#73503c" stroke-width=".7"/>`;
 b+=`<path d="M-10 19L-15 15M10 19L15 15M-10 28Q0 33 10 28" stroke="#785443" stroke-width=".7" fill="none"/>`;
 if(person==='mother'){
   b+=`<path d="M-19 12Q-29-12-20-30Q-13-44 0-43Q13-44 20-30Q29-12 19 12L20-12Q15-31 0-35Q-15-31-20-12ZM-19 4Q-29 18-27 52L-17 44Q-22 23-17 11ZM19 4Q29 18 27 52L17 44Q22 23 17 11Z" fill="#34252d" stroke="#9f7d5e" stroke-width=".7"/>`;
   for(let i=0;i<6;i++){const x=18+i*.9;b+=`<path d="M${-x} ${-22+i*5}Q${-28-i*.6} ${-4+i*5} ${-20-i} ${24+i*4}M${x} ${-22+i*5}Q${28+i*.6} ${-4+i*5} ${20+i} ${24+i*4}" fill="none" stroke="#967056" stroke-width=".48"/>`}
   b+=bloom(-17,-26,.22,1)+bloom(-7,-36,.25)+bloom(7,-37,.25,1)+bloom(18,-27,.22);
   b+=`<path d="M-18 10V25M18 10V25" stroke="#b99c71" stroke-width="1"/><ellipse cx="-18" cy="27" rx="2.5" ry="4" fill="#c8a876"/><ellipse cx="18" cy="27" rx="2.5" ry="4" fill="#c8a876"/>`;
 }else{
   b+=`<path d="M-20-30L-18-43Q0-52 18-43L20-30Q39-26 35-19Q0-10-35-19Q-39-26-20-30Z" fill="#3a2930" stroke="#bca17a" stroke-width="1"/><path d="M-18-32Q0-36 18-32V-28Q0-32-18-28Z" fill="#9a7860"/><path d="M-34-22Q0-16 34-22M-16-42Q0-48 16-42" fill="none" stroke="#d2b28b" stroke-width=".55"/><path d="M-2 14Q-6 11-11 14Q-15 17-12 19Q-7 20-2 17M2 14Q6 11 11 14Q15 17 12 19Q7 20 2 17" fill="#37272c" stroke="#957254" stroke-width=".5"/>`;
 }
 for(const side of [-1,1])for(let i=0;i<4;i++){const x=side*(22+i*.8),y=51+i*8;b+=`<path d="M${x} ${y}Q${x+side*8} ${y-7} ${x+side*11} ${y}Q${x+side*5} ${y+5} ${x} ${y}M${x} ${y}Q${x-side*5} ${y-7} ${x-side*7} ${y}" fill="none" stroke="#a38a68" stroke-width=".55"/>`}
 return b;
}
function portrait(x,y,w=110,h=150,person='mother'){let b=rect(0,0,w,h,'url(#metal)',3,'stroke="#3c282c" stroke-width="2"')+rect(6,6,w-12,h-12,'#24202a',2,`stroke="${P.highlight}" stroke-width="1"`)+rect(12,12,w-24,h-24,'url(#portraitPaper)',1);
 const cid='portrait-'+person+'-'+x+'-'+y;b+=`<defs><clipPath id="${cid}"><rect x="12" y="12" width="${w-24}" height="${h-24}"/></clipPath></defs><g clip-path="url(#${cid})">${g(w/2,h*.44,w/108,remembrance(person))}</g>`;b+=line(7,7,w-8,7,'#e4c79a',1)+line(7,7,7,h-7,'#e4c79a',1);for(const [xx,yy]of[[3,3],[w-7,3],[3,h-7],[w-7,h-7]])b+=rect(xx,yy,4,4,'#cea876',1,'stroke="#543932" stroke-width=".4"');return g(x,y,1,b,'data-remembrance-portrait="'+person+'"');
}
function tier(x,y,w,h){let b=`<path d="M${x} ${y}L${x+19} ${y-16}H${x+w+14}L${x+w} ${y}Z" fill="#b99e78" stroke="#64505a" stroke-width="1"/><path d="M${x+w} ${y}L${x+w+14} ${y-16}V${y+h-9}L${x+w} ${y+h}Z" fill="#1c1c2a"/>`+rect(x,y,w,h,'url(#mahogany)',2,'stroke="#1f1a28" stroke-width="1.4"')+rect(x+3,y+5,w-6,8,'url(#metal)',1);
 b+=rect(x+7,y+16,w-14,h-21,'#231d2a',2)+rect(x+12,y+17,w-24,h-32,'url(#mahogany)',2,'stroke="#8d6660" stroke-width=".7"');
 b+=`<path d="M${x+18} ${y+15}H${x+w-18}V${y+h-24}Q${x+w*.75} ${y+h-8} ${x+w*.5} ${y+h-25}Q${x+w*.25} ${y+h-42} ${x+18} ${y+h-22}Z" fill="url(#altarCloth)" stroke="#796075" stroke-width=".8"/><path d="M${x+26} ${y+19}Q${x+w*.33} ${y+3} ${x+w*.5} ${y+23}T${x+w-26} ${y+19}M${x+34} ${y+23}L${x+39} ${y+h-29}M${x+w-34} ${y+23}L${x+w-40} ${y+h-31}" fill="none" stroke="#b4828d" stroke-width="1" opacity=".38"/>`;
 for(let i=0;i<5;i++)b+=`<path d="M${x+13} ${y+h-9-i*1.6}Q${x+w*.22} ${y+h-10-i*1.9} ${x+w*.45} ${y+h-9-i*1.6}T${x+w-13} ${y+h-10-i*1.5}" fill="none" stroke="#ae8269" stroke-width=".35" opacity=".34"/>`;
 for(const xx of [x+25,x+w-25])b+=`<path d="M${xx} ${y+25}V${y+h-31}M${xx-2} ${y+27}V${y+h-34}" fill="none" stroke="#c9a882" stroke-width=".55" opacity=".3"/>`;
 // Horizontal engraved rails, no diagonal hatching.
 b+=line(x+16,y+h-9,x+w-16,y+h-9,'#a78b70',1,'opacity=".5"');return b;
}
function ofrenda(x=0,y=0,s=1){let b='';
 b+=`<ellipse cx="302" cy="705" rx="293" ry="253" fill="url(#warmSpill)"/><path d="M103 794V425Q103 235 301 228Q499 235 499 425V794Z" fill="url(#limestone)" opacity=".78" stroke="#685872" stroke-width="2"/><path d="M119 779V421Q122 255 301 247Q480 255 483 421V779" fill="none" stroke="#c5b29f" opacity=".4" stroke-width="1"/><path d="M144 769V421Q149 285 301 277Q453 285 457 421V769Z" fill="#241e32"/><ellipse cx="292" cy="488" rx="160" ry="207" fill="url(#alcoveLight)"/>`;
 for(const xx of [103,460]){b+=rect(xx,428,39,348,'url(#columnStone)',2);for(let i=0;i<4;i++)b+=`<path d="M${xx+7+i*7} 440V762" stroke="#2c2436" stroke-width="2" opacity=".5"/><path d="M${xx+5+i*7} 440V762" stroke="#c6aa9c" stroke-width=".6" opacity=".3"/>`;b+=rect(xx-3,417,45,10,'url(#limestone)',2,'stroke="#998393" stroke-width=".5"')+rect(xx-4,767,47,14,'url(#limestone)',2)}
 for(let i=-4;i<=4;i++){const a=i*18*Math.PI/180;const xx=301+197*Math.sin(a),yy=425-197*Math.cos(a),ix=301+159*Math.sin(a),iy=425-149*Math.cos(a);b+=line(xx,yy,ix,iy,'#2c2338',1.5,'opacity=".6"')+line(xx+1.5,yy+1.2,ix+1.5,iy+1.2,'#b49c97',.6,'opacity=".5"')}
 b+=`<path d="M98 425Q100 227 301 220Q502 227 504 425" fill="none" stroke="#3a2b40" stroke-width="5"/><path d="M102 424Q105 231 301 225Q497 231 500 424" fill="none" stroke="#b29aa0" stroke-width="1" opacity=".45"/><ellipse cx="290" cy="703" rx="270" ry="170" fill="url(#fogVeil)"/>`;
 b+=tier(181,484,231,103)+tier(110,623,382,110)+tier(49,772,500,142);
 b+=portrait(246,307,112,171,'mother');b+=portrait(141,505,84,115,'father')+portrait(374,505,91,119,'mother');
 b+=candle(196,479,100,26)+candle(389,479,136,29)+candle(161,618,76,21)+candle(465,618,91,22);
 b+=ceramicSkull(295,592,1.15)+ceramicSkull(181,735,.94)+ceramicSkull(424,738,.92);
 b+=candle(91,770,110,28)+candle(509,770,94,26)+candle(70,901,120,34)+candle(121,899,87,29)+candle(467,898,130,35)+candle(523,896,77,27);
 for(const [xx,yy,ss,v]of [[217,482,.60,0],[367,480,.63,0],[242,485,.47,1],[329,483,.44,1],[247,619,.65,0],[279,622,.59,0],[313,620,.68,0],[347,620,.51,1],[230,769,.78,0],[268,774,.76,0],[309,771,.88,0],[350,772,.76,0],[387,770,.64,1],[164,895,.73,0],[204,906,.91,0],[251,915,.86,0],[293,912,.72,1],[336,918,.98,0],[380,907,.80,0],[421,902,.71,0]])b+=bloom(xx,yy,ss,v);
 // A vertical flower chain joins the upper niche to the lower tiers.
 for(let i=0;i<8;i++){b+=bloom(117-i*3,349+i*48,.32+(i%3)*.07,i%4===3?1:0)+bloom(482+i*2,370+i*46,.34+(i%3)*.07,0)}
 b+=`<path d="M43 923Q280 948 562 921" fill="none" stroke="#786470" stroke-width="1.5" opacity=".6"/>`;return g(x,y,s,b,'data-ofrenda="three-tiers"');
}
function bunting(m,animated=true){let b='';for(const [a,z]of(m?[[-25,415]]:[[-45,600],[1320,1960]])){b+=`<path d="M${a} 8Q${(a+z)/2} ${m?35:75} ${z} 8" fill="none" stroke="#bba17e" stroke-width="${m?1:1.6}"/>`;for(let i=0;i<(m?7:6);i++){if(m&&i>=2&&i<=4)continue;const xx=a+45+i*(m?61:106),yy=12+(m?9:27)*Math.sin(i/(m?6:5)*Math.PI);b+=g(xx,yy,m?.42:1,`<g ${animated?'class="flag-sway"':''} style="animation-delay:${-i*1.2}s">${flag(0,0,1,[P.pink,P.orange,P.teal][i%3])}</g>`,'data-flat-flag="true"')}}return b;
}
function motionCss(){return `<style>.flag-sway{transform-box:fill-box;transform-origin:50% 0;animation:flagSway 11s ease-in-out infinite}.petal-drift{animation:petalDrift 18s ease-in-out infinite;animation-delay:var(--delay)}@keyframes flagSway{0%,100%{transform:rotate(-1.5deg)}50%{transform:rotate(1.5deg)}}@keyframes petalDrift{0%,100%{transform:translate(0,0) rotate(-8deg)}50%{transform:translate(9px,13px) rotate(18deg)}}.reduced .flag-sway,.reduced .petal-drift{animation:none!important}.lite .flag-sway{animation-duration:16s}.lite .extra-petal{display:none}@media(prefers-reduced-motion:reduce){.flag-sway,.petal-drift{animation:none!important}}</style>`}
function scene(m,v='A',{logo=true,mode='full',clean=false}={}){const W=m?390:1920,H=m?844:1080;let s=rect(0,0,W,H,'url(#skyA)');
 s+=`<path d="M0 ${H*.49}Q${W*.24} ${H*.34} ${W*.51} ${H*.53}T${W} ${H*.45}V${H}H0Z" fill="#4d3c56" opacity=".25"/><path d="M0 ${H*.67}Q${W*.3} ${H*.48} ${W*.63} ${H*.68}T${W} ${H*.56}V${H}H0Z" fill="#202735" opacity=".64"/><ellipse cx="${W*.22}" cy="${H*.48}" rx="${W*.39}" ry="${H*.43}" fill="url(#mist)"/><ellipse cx="${W*.87}" cy="${H*.46}" rx="${W*.28}" ry="${H*.43}" fill="url(#mist)"/><path d="M0 ${H*.79}Q${W*.47} ${H*.7} ${W} ${H*.8}V${H}H0Z" fill="#27262f"/>`;
 if(!m)s+=ofrenda(0,0,1);else s+=ofrenda(-36,168,.76);
 // Only petals, subtle and outside the board area in the desktop composition.
 for(let i=0;i<(m?4:8);i++){const xx=m?14+(i*118)%376:50+i*65,yy=m?650+i%2*44:300+(i%4)*130;s+=g(xx,yy,m?.6:1,`<g class="petal-drift ${i>=2?'extra-petal':''}" style="--delay:${-i*2.3}s"><path d="M-3 0Q-2-9 4-5Q8 1 1 4Z" fill="${P.orange}" opacity=".23"/></g>`)}
 s+=bunting(m,!clean);if(logo)s+=m?lettering(129,8,132,v):lettering(112,144,370,v);return s;
}
function stakeScene(W,H){const scale=Math.min(W/600,H/954)*.94;let b=rect(0,0,W,H,'url(#skyA)');b+=`<path d="M0 ${H*.65}Q${W*.28} ${H*.53} ${W*.6} ${H*.66}T${W} ${H*.6}V${H}H0Z" fill="#252735" opacity=".64"/><ellipse cx="${W*.3}" cy="${H*.44}" rx="${W*.7}" ry="${H*.5}" fill="url(#mist)"/>`;b+=g((W-600*scale)/2,H*.025,scale,ofrenda());b+=`<ellipse cx="${W*.5}" cy="${H*.95}" rx="${W*.45}" ry="${H*.14}" fill="url(#fogVeil)"/>`;for(let i=0;i<11;i++)b+=bloom(W*(.16+i*.068),H*(.935+Math.sin(i*.85)*.025),W/600*(.6+(i%3)*.15),i%5===0?1:0);b+=g(0,0,W/390,bunting(true,false));return b;}
function largeBank(m,stage){const val=stage==='start'?3:10,left=stage==='retrigger'?14:9;let s='';
 if(m){for(const [xx,txt,n,color]of [[2,'BANK','×'+val,P.bone],[248,'FS LEFT',String(left),P.orange]])s+=`<path d="M${xx} 27Q${xx} 2 ${xx+70} 2Q${xx+140} 2 ${xx+140} 27V81H${xx}Z" fill="url(#limestone)" stroke="${P.gold}" stroke-width="1.4"/>${rect(xx+6,25,128,52,'url(#enamel)',5)}${text(xx+70,23,txt,12,P.highlight,'Oswald','text-anchor="middle"')}${text(xx+70,73,n,50,color,'Oswald','text-anchor="middle"')}`;
 }else{s+=g(93,333,1,`<path d="M0 98Q0 0 188 0Q376 0 376 98V524H0Z" fill="url(#limestone)" stroke="${P.gold}" stroke-width="3"/>${rect(13,112,350,394,'url(#enamel)',8,`stroke="${P.gold}" stroke-width="1.5"`)}${ceramicSkull(188,84,.58)}${text(188,157,'BONUS BANK',24,P.teal,'Oswald','text-anchor="middle"')}${text(188,262,'×'+val,96,P.bone,'Oswald','text-anchor="middle"')}${line(43,287,333,287,P.gold,1.5)}${text(188,341,'FREE SPINS LEFT',24,P.highlight,'Oswald','text-anchor="middle"')}${text(188,450,String(left),72,P.orange,'Oswald','text-anchor="middle"')}`)}
 if(stage==='retrigger')s+=g(m?195:960,m?64:100,m?.55:1,rect(-65,-21,130,42,'url(#enamel)',6,`stroke="${P.teal}" stroke-width="1.2"`)+text(0,7,'+5 FREE SPINS',18,P.bone,'Oswald','text-anchor="middle"'));return s;
}
function correctedBoard(m,state,d){let s=board(m,state,d,{courts:'queen-a',winStyle:'improved',badge:'C',dim:'deep'});
 // Fixed title/amount baselines. Neither the fill nor the stroke bounds overlap.
 const q=m?[[13.5,-8,-13],[28,12,31]]:[[24,-15,-22],[48,21,52]];
 const ys=[];for(const old of d.labels)ys.push((m?122.5:52.5)+(m?45:78.5)+((old.ny*1146-72-94)/205)*(m?97:173));
 for(const cy of ys)for(const [size,oldOff,newOff]of q)s=s.replace(`y="${cy+oldOff}" fill=`, `y="${cy+newOff}" fill=`);
 return s;
}
function full(p,state,v='A',mode='full',bankStage='start'){const m=p==='portrait',d=fixture(p,state);let s=scene(m,v,{logo:state!=='fs',mode})+(!m?payboard(d.target,state):'')+correctedBoard(m,state,d)+(state==='fs'?largeBank(m,bankStage):'');let h=hud(m,state,d.target);if(state==='fs')h=h.replaceAll('2.25',d.amount);s+=h;
 return svg(m?390:1920,m?844:1080,artDefs()+s+motionCss(),state).replace('<svg xmlns=',`<svg class="${mode}" xmlns=`);
}
function run(){const manifest={scope:'only revisions 8 / 9 shown; accepted selections are fixed, production untouched',screens:[],logos:[]};
 for(const p of ['desktop','portrait'])for(const v of ['A','B'])for(const st of ['idle','win','fs']){const file=`context-${v}-${p}-${st}.svg`;fs.writeFileSync(dir+'/'+file,full(p,st,v));manifest.screens.push({file,profile:p,logo:v,state:st,fixture:`../review-1b/current-${p}-${st}.json`})}
 for(const p of ['desktop','portrait'])for(const v of ['A','B'])for(const st of ['idle','win','fs'])for(const mode of ['reduced','lite'])fs.writeFileSync(dir+`/context-${v}-${p}-${st}-${mode}.svg`,full(p,st,v,mode));
 for(const v of ['A','B']){const file=`logo-${v}.svg`;fs.writeFileSync(dir+'/'+file,svg(900,420,artDefs()+rect(0,0,900,420,'url(#skyA)')+lettering(70,55,760,v)));manifest.logos.push(file)}
 fs.writeFileSync(dir+'/ofrenda-detail.svg',svg(600,954,artDefs()+rect(0,0,600,954,'url(#skyA)')+ofrenda()+bunting(false,false)));
 for(const p of ['desktop','portrait'])fs.writeFileSync(dir+`/background-${p}.svg`,svg(p==='portrait'?390:1920,p==='portrait'?844:1080,artDefs()+scene(p==='portrait','A',{logo:false,clean:true})));
 for(const [W,H,label]of [[1200,1600,'3x4'],[1080,1920,'9x16']])fs.writeFileSync(dir+`/stake-A-${label}.svg`,svg(W,H,artDefs()+stakeScene(W,H)));
 fs.writeFileSync(dir+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log({contexts:manifest.screens.length,logos:2,ofrenda:true});
}
if(require.main===module)run();module.exports={run,full,scene,lettering,artDefs};
