import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text, Texture, Rectangle } from "pixi.js";
import { LINES } from "../game/engine";
import paperUrl from "../slice/assets/paper.webp";
import queenUrl from "../slice/assets/queen-proof.webp";
import reaperUrl from "../slice/assets/reaper-proof.webp";
import cornerUrl from "../slice/assets/corner-proof.webp";
import { cardFaceUrl } from "../game/assets";
import { isLiteFx } from "../game/fxMode";
import { audio } from "../game/audio";
import { LANDING, LandingMotion } from "../game/pixi/landingMotion";
import type { RevealPayload, SlotGameHandle, SlotGameProps, GodotWinLine } from "./SlotGame";

const W = 800, H = 1146, CW = 134, CH = 188, DX = 146, DY = LANDING.cell, X = 40, Y = 72;
type Card = RevealPayload["cards"][number];
type Reel = { node: Container; cards: Container[] };
type Scene = { begin: () => void; cancel: () => void; reveal: (p: RevealPayload) => void;
  snap: () => void; skip: () => void; turbo: (v: boolean) => void; sound: (v: boolean) => void };

function pip(suit: string, size: number, color: number) {
  const g = new Graphics();
  if (suit === "H") g.moveTo(0, 10).bezierCurveTo(-30,-8,-26,-32,-10,-28)
    .bezierCurveTo(0,-28,0,-17,0,-17).bezierCurveTo(0,-17,0,-28,10,-28)
    .bezierCurveTo(26,-32,30,-8,0,10).fill(color);
  else if (suit === "D") g.poly([0,-30,21,-8,0,15,-21,-8]).fill(color);
  else if (suit === "C") {
    g.circle(0,-24,12).circle(-12,-7,12).circle(12,-7,12).poly([-6,0,6,0,11,15,-11,15]).fill(color);
  } else {
    g.moveTo(0,-33).bezierCurveTo(-9,-20,-29,-12,-20,1).bezierCurveTo(-14,10,-5,5,0,0)
      .bezierCurveTo(5,5,14,10,20,1).bezierCurveTo(29,-12,9,-20,0,-33)
      .poly([-5,0,5,0,11,15,-11,15]).fill(color);
  }
  g.scale.set(size / 48);
  return g;
}
const pips: Record<number, [number, number][]> = {
  2:[[0,-1],[0,1]],3:[[0,-1],[0,0],[0,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],
  5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],
  6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]],
  7:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1],[0,-.5]],
  8:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1],[0,-.5],[0,.5]],
  9:[[-1,-1],[1,-1],[-1,-.33],[1,-.33],[-1,.33],[1,.33],[-1,1],[1,1],[0,0]],
  10:[[-1,-1],[1,-1],[-1,-.33],[1,-.33],[-1,.33],[1,.33],[-1,1],[1,1],[0,-.66],[0,.66]],
};
const label = (text: string, size: number, fill: number, family = "Oswald") =>
  new Text({text, resolution: 2, style:{fontFamily:family,fontSize:size,fontWeight:"700",fill}});

export const PixiSlot = forwardRef<SlotGameHandle, SlotGameProps & { audition?: boolean; initialCards?: RevealPayload["cards"]; onRendererError?: () => void }>(function PixiSlot(props, ref) {
  const host = useRef<HTMLDivElement>(null), scene = useRef<Scene | null>(null), callbacks = useRef(props);
  callbacks.current = props;
  const pending = useRef<((s: Scene) => void)[]>([]);
  const call = (fn: (s: Scene) => void) => scene.current ? fn(scene.current) : pending.current.push(fn);
  useImperativeHandle(ref, () => ({beginTravel:()=>call(s=>s.begin()),cancelTravel:()=>call(s=>s.cancel()),
    reveal:p=>call(s=>s.reveal(p)),snapRound:()=>call(s=>s.snap()),continueRound:()=>call(s=>s.skip()),
    setTurbo:v=>call(s=>s.turbo(v)),setBet:()=>{},spin:()=>{},setVolume:v=>call(s=>s.sound(v>0)),resumeAudio:audio.unlock}), []);
  useEffect(() => {
    let disposed = false, initialized = false;
    const app = new Application();
    const init = async () => {
      const audition=!!props.audition;
      const lite = isLiteFx(), reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
      await document.fonts.ready;
      const displayScale=(host.current?.getBoundingClientRect().height??H)/H;
      // Rasterize for the displayed size and actual screen density. A fixed
      // 2× design-space buffer wastes ~4× the pixels on a portrait board.
      await app.init({width:W,height:H,resolution:Math.min(2,Math.max(.5,displayScale*devicePixelRatio)),autoDensity:true,backgroundAlpha:0,
        antialias:true,preference:"webgl",powerPreference:"high-performance"});
      initialized=true;
      if (disposed) { app.destroy(true, {children:true}); initialized=false; return; }
      const courtIds=["J","Q","K"].flatMap(rank=>["S","H","D","C"].map(suit=>rank+suit));
      const textures = await Assets.load<Texture>([
        paperUrl,queenUrl,reaperUrl,cornerUrl,...(audition?[]:courtIds.map(id=>cardFaceUrl(id[0],id[1])))]);
      if (disposed) { app.destroy(true, {children:true}); initialized=false; return; }
      const urls: Record<string,string>={paper:paperUrl,"queen-proof":queenUrl,"reaper-proof":reaperUrl,"corner-proof":cornerUrl};
      const tex = (name: string) => textures[urls[name]];
      const legacyCourts:Record<string,Texture>={};
      if(!audition)for(const id of courtIds){const full=textures[cardFaceUrl(id[0],id[1])];
        // Only the existing central illustration: old raster indices are excluded.
        legacyCourts[id]=new Texture({source:full.source,frame:new Rectangle(full.width*.15,full.height*.03,full.width*.70,full.height*.94)});
      }
      app.canvas.style.width="100%";app.canvas.style.height="100%";
      host.current!.appendChild(app.canvas);
      const paintedCards = new WeakMap<Container, Card>();
      function face(card: Card, multiplier = 0) {
        const node = new Container();
        paintedCards.set(node,card);node.pivot.set(CW/2,CH/2);
        const paper = new Sprite(tex("paper"));paper.width=CW;paper.height=CH;node.addChild(paper);
        node.addChild(new Graphics().roundRect(1,1,CW-2,CH-2,5).stroke({color:0x1b1511,width:2})
          .roundRect(5,5,CW-10,CH-10,3).stroke({color:0xa07737,width:1}));
        const ink = card.suit === "H" || card.suit === "D" ? 0x741b1c : 0x171510;
        if (card.golden) {
          const art = new Sprite(tex("reaper-proof"));art.position.set(14,20);art.width=106;art.height=151;node.addChild(art);
          const title=label("JOKER",17,0x171510,"Pirata One");title.anchor.set(.5);title.position.set(CW/2,12);node.addChild(title);
        } else {
          for (const reversed of [false,true]) {
            const index=new Container();const rank=label(card.rank === "T" ? "10" : card.rank ?? "?",23,ink);
            rank.anchor.set(.5,0);index.addChild(rank);const mark=pip(card.suit??"S",17,ink);mark.position.set(0,39);index.addChild(mark);
            index.position.set(reversed?CW-13:13,reversed?CH-10:9);if(reversed)index.rotation=Math.PI;node.addChild(index);
          }
          if (!audition && ["J","Q","K"].includes(card.rank??"")) {
            const art=new Sprite(legacyCourts[card.rank!+card.suit!]);art.position.set(27,9);art.width=80;art.height=170;node.addChild(art);
          } else if (card.rank === "Q" && card.suit === "H") {
            const art=new Sprite(tex("queen-proof"));art.position.set(28,18);art.width=78;art.height=151;node.addChild(art);
          } else if (["J","Q","K"].includes(card.rank??"")) {
            const monogram=label(card.rank!,74,ink,"Pirata One");monogram.anchor.set(.5);monogram.position.set(CW/2,CH/2);node.addChild(monogram);
            node.addChild(new Graphics().poly([CW/2,28,CW-29,CH/2,CW/2,CH-28,29,CH/2]).stroke({color:0xa07737,width:1.5}));
          } else if(card.rank === "A") {
            const mark=pip(card.suit??"S",75,ink);mark.position.set(CW/2,CH/2+14);node.addChild(mark);
            node.addChild(new Graphics().circle(CW/2,CH/2-3,44).stroke({color:0xa07737,width:1}));
          } else for(const [px,py] of pips[card.rank === "T"?10:Number(card.rank)]??[]) {
            const mark=pip(card.suit??"S",20,ink);mark.position.set(CW/2+px*25,CH/2+py*54+4);
            if(py>0)mark.rotation=Math.PI;node.addChild(mark);
          }
          if(multiplier>0) {
            const plate=new Graphics().roundRect(77,CH-32,53,26,4).fill(0x211711).stroke({color:0xc8a052,width:1});node.addChild(plate);
            const t=label("×"+multiplier,19,0xf1ddb2);t.position.set(82,CH-33);node.addChild(t);
          }
        }
        return node;
      }
      const field = new Container();
      const mask=new Graphics().rect(X-2,Y-2,5*DX-10,5*DY-14).fill(0xffffff);app.stage.addChild(mask,field);field.mask=mask;
      const reels: Reel[]=[];
      let current: RevealPayload | null=props.initialCards?{cards:props.initialCards,multipliers:Array(25).fill(0),winIndices:[],lines:[],shownX:0,bet:0}:null,
        target: RevealPayload | null=null, travel=false,
        settledAt=-1, settled=false, fast=false, skipped=false, skippedAt=0, notified=false,
        soundEnabled=true,shakeStrength=0,lastFrameAt=performance.now(),feedbackPending=false;
      const emit=(event:string,extra:Record<string,unknown>={})=>host.current?.dispatchEvent(
        new CustomEvent("pixi-landing",{bubbles:true,detail:{event,t:performance.now(),rev:target?.rev,...extra}}));
      const win = new Container(), nice = new Container();app.stage.addChild(win,nice);
      nice.visible=false;
      const hotFrames=Array.from({length:5},(_,c)=>{
        const g=new Graphics(),left=X+c*DX-9,top=Y-4,height=5*DY-15;
        g.roundRect(left,top,CW+18,height,6).fill({color:0xa91e35,alpha:.06});
        for(let n=0;n<12;n++){
          const alpha=.32*(1-n/12)**2,y=n*12.5;
          g.rect(left+3,top+y,CW+12,12.5).fill({color:0xa91e35,alpha});
          g.rect(left+3,top+height-y-12.5,CW+12,12.5).fill({color:0xa91e35,alpha});
        }
        g.roundRect(left,top,CW+18,height,6).stroke({color:0xd3b165,width:4});
        g.visible=false;app.stage.addChild(g);return g;
      });
      const corners=new Container();app.stage.addChild(corners);
      for(const [x,y,rotation] of [[14,42,0],[786,42,Math.PI/2],[786,1112,Math.PI],[14,1112,-Math.PI/2]]) {
        const s=new Sprite(tex("corner-proof"));s.width=40;s.height=40;s.anchor.set(.5);s.position.set(x,y);s.rotation=rotation;corners.addChild(s);
      }
      function paintColumn(c: number, p: RevealPayload | null) {
        const reel=reels[c];reel.node.removeChildren().forEach(n=>n.destroy({children:true}));reel.cards=[];
        for(let r=-1;r<6;r++) {
          const index=((r+5)%5)*5+c;
          const node=face(p?.cards[index]??{rank:"A",suit:"S"},p?.multipliers[index]??0);
          node.position.set(CW/2,r*DY+CH/2);reel.node.addChild(node);reel.cards.push(node);
        }
        reel.node.y=Y;
      }
      for(let c=0;c<5;c++){const node=new Container();node.x=X+c*DX;field.addChild(node);reels.push({node,cards:[]});paintColumn(c,current)}
      if(current)host.current!.dataset.cards=JSON.stringify(current.cards);
      function wrapColumn(c:number) {
        const reel=reels[c];reel.cards.unshift(reel.cards.pop()!);
        reel.cards.forEach((node,i)=>node.position.set(CW/2,(i-1)*DY+CH/2));
      }
      function prepareColumn(c:number) {
        if(!target)return;
        const reel=reels[c];
        // Entry holds target row 0; visible rows 0..3 hold target rows 1..4.
        // The next continuous wrap installs all five rows at collision.
        for(let row=0;row<5;row++){
          const i=row*5+c,old=reel.cards[row],node=face(target.cards[i],target.multipliers[i]);
          node.position.copyFrom(old.position);reel.node.removeChild(old);old.destroy({children:true});
          reel.node.addChild(node);reel.cards[row]=node;
        }
        emit("landing_prepare",{column:c,offset:motion.reels[c].offset});
      }
      const motion=new LandingMotion({wrap:wrapColumn,prepare:prepareColumn,
        collision:(column,joker)=>{
          const strength=reduced?0:joker?LANDING.shakeJoker:column===4?LANDING.shakeLast:LANDING.shakeSmall;
          shakeStrength=Math.max(shakeStrength,strength);
          if(soundEnabled){audio.playReelStop(column);if(joker)audio.playJokerLand()}
          if(column===4)audio.stopReelSpinLoop(0);
          emit("landing_collision",{column,joker,offset:motion.reels[column].offset,shake:strength,soundEnabled});
        },anticipation:(active,ms)=>{
          callbacks.current.onAnticipation?.(active,ms);
          emit("anticipation",{active,ms,column:motion.anticipation.column});
        },settled:()=>finalise()},reduced);
      const points=(id:number)=>LINES[id].map(i=>[X+(i%5)*DX+CW/2,Y+Math.floor(i/5)*DY+CH/2]);
      function paintWins(time:number) {
        win.removeChildren().forEach(n=>n.destroy({children:true}));if(!target)return;
        const ordered=[...target.lines].sort((a,b)=>b.win_x-a.win_x);
        const active=skipped||reduced||time>=600?ordered:ordered.slice(time>=350?1:0,time>=350?2:1);
        for(const line of active) {
          const g=new Graphics();for(const i of LINES[line.id])
            g.roundRect(X+(i%5)*DX-2,Y+Math.floor(i/5)*DY-2,CW+4,CH+4,5).stroke({color:0xd3b165,width:2.5});
          const pts=points(line.id);g.moveTo(pts[0][0],pts[0][1]);pts.slice(1).forEach(([x,y])=>g.lineTo(x,y));g.stroke({color:0xc2a15c,width:1.5,alpha:.72});win.addChild(g);
        }
      }
      function finalise(snap=false) {
        if(!target||settled)return;
        if(snap){for(let c=0;c<5;c++)paintColumn(c,target);audio.stopReelSpinLoop(0);shakeStrength=0;app.stage.position.set(0)}
        current=target;settled=true;travel=false;settledAt=performance.now();
        const visible=Array.from({length:25},(_,i)=>paintedCards.get(reels[i%5].cards[Math.floor(i/5)+1]));
        host.current!.dataset.settledRev=String(target.rev);host.current!.dataset.cards=JSON.stringify(visible);
        emit("landing_settled",{snap});
        callbacks.current.onReelsSettled?.(target.rev);
      }
      const word=label("NICE",126,0xf1dfb9,"Pirata One");word.anchor.set(.5);word.position.set(W/2,480);
      const amount=label("0.00",70,0xdfba70);amount.anchor.set(.5);amount.position.set(W/2,593);
      const plate=new Graphics();
      nice.addChild(new Graphics().rect(0,0,W,H).fill({color:0x0b0a08,alpha:.3}),
        plate,word,amount);
      function layoutNice() {
        const rect=host.current!.getBoundingClientRect(),scale=rect.height/H;
        // Match the existing CSS celebration's viewport anchors on both
        // orientations: word center h/2−103.2; amount center h/2+47.4.
        const cx=(innerWidth/2-rect.x)/scale;
        word.position.set(cx,(innerHeight/2-103.2-rect.y)/scale);
        amount.position.set(cx,(innerHeight/2+47.4-rect.y)/scale);
        word.style.fontSize=96/scale;amount.style.fontSize=60/scale;
        plate.clear().roundRect(cx-168/scale,amount.y-100.8/scale,336/scale,201.6/scale,8/scale)
          .fill(0x19140e).stroke({color:0xa98742,width:2/scale});
      }
      layoutNice();
      const flecks=new Container();nice.addChild(flecks);
      if(!reduced)for(let i=0;i<(lite?4:8);i++){
        const g=new Graphics().poly([-3,0,0,-7,3,0,0,7]).fill(0xcba75a);g.position.set(130+i*77,410+(i%3)*85);flecks.addChild(g);
      }
      const api:Scene={
        begin:()=>{if(travel)return;target=null;travel=true;settled=false;settledAt=-1;notified=false;skipped=false;nice.visible=false;delete host.current!.dataset.beat;
          win.removeChildren().forEach(n=>n.destroy({children:true}));motion.begin(performance.now(),fast);
          feedbackPending=true;host.current!.style.transform="translate3d(0,4px,0)";
          for(let c=0;c<5;c++)reels[c].node.y=Y+motion.reels[c].offset;
          // First composite the existing real board's reversible CSS nudge.
          // A new WebGL submission can otherwise delay that first visible frame.
          app.ticker.stop();requestAnimationFrame(()=>requestAnimationFrame(()=>{if(!disposed&&feedbackPending)app.ticker.start()}));
          if(soundEnabled)audio.startReelSpinLoop();emit("travel_begin");callbacks.current.onPhase?.("SPIN_START")},
        cancel:()=>{if(!motion.cancel())return;travel=false;shakeStrength=0;app.stage.position.set(0);
          feedbackPending=false;host.current!.style.transform="translate3d(0,0,0)";
          for(let c=0;c<5;c++)paintColumn(c,current);app.render();audio.stopReelSpinLoop(0);emit("travel_rollback")},
        reveal:p=>{if(target&&!settled)return;if(!travel)api.begin();
          if(feedbackPending){motion.carryFeedback(4*H/host.current!.getBoundingClientRect().height);
            feedbackPending=false;host.current!.style.transform="translate3d(0,0,0)";
            for(let c=0;c<5;c++)reels[c].node.y=Y+motion.reels[c].offset;app.render()}
          target=p;
          app.ticker.start();
          motion.reveal(performance.now(),Array.from({length:5},(_,c)=>p.cards.filter((card,i)=>i%5===c&&card.golden).length));layoutNice();emit("target_received",{cards:p.cards,multipliers:p.multipliers})},
        snap:()=>{if(motion.snap())finalise(true)},skip:()=>{if(settled){skipped=true;skippedAt=performance.now()}},turbo:v=>{fast=v},
        sound:v=>{soundEnabled=v;if(!v)audio.stopReelSpinLoop(0)},
      };
      scene.current=api;pending.current.splice(0).forEach(fn=>fn(api));
      app.ticker.add(()=>{
        const now=performance.now();
        motion.tick(now);
        for(let c=0;c<5;c++){
          reels[c].node.y=Y+motion.reels[c].offset;
          const hot=motion.anticipation,shade=hot.active&&Number.isFinite(hot.shadedAt[c]);
          const pulseElapsed=motion.pulseElapsed(c,now);
          hotFrames[c].visible=hot.active&&c>hot.column&&motion.reels[c].phase==="travel";
          // Godot's hot-frame opacity breathes 0.7→1→0.7 every 420 ms.
          hotFrames[c].alpha=.85-.15*Math.cos((now-hot.startedAt)*Math.PI*2/420);
          for(let row=0;row<5;row++){
            const node=reels[c].cards[row+1],joker=!!paintedCards.get(node)?.golden;
            node.tint=shade&&!joker?0xbcbcbc:0xffffff;
            const [sx,sy]=motion.squash(c,row,now);
            let pulse=1;
            if(shade&&joker&&pulseElapsed>=0){
              if(pulseElapsed<90)pulse=1+.06*(1-(1-pulseElapsed/90)**3);
              else if(pulseElapsed<250)pulse=1+.06*(1-(Math.min(1,(pulseElapsed-90)/160)))**3;
              else pulse=1+.04*(1-Math.cos((pulseElapsed-250)*Math.PI/350));
            }
            node.scale.set(sx*pulse,sy*pulse);
          }
        }
        const delta=Math.max(0,(now-lastFrameAt)/1000);lastFrameAt=now;
        if(shakeStrength>.01){const angle=Math.random()*Math.PI*2;app.stage.position.set(-Math.cos(angle)*shakeStrength,-Math.sin(angle)*shakeStrength);
          shakeStrength*=Math.max(0,1-LANDING.shakeDecay*delta)}else{shakeStrength=0;app.stage.position.set(0)}
        host.current!.dataset.landing=JSON.stringify({hasTarget:!!target,reels:motion.reels,anticipation:motion.anticipation,
          scales:reels.map(r=>r.cards.slice(1,6).map(n=>[n.scale.x,n.scale.y])),shake:shakeStrength});
        if(settled&&target){const t=now-settledAt;
          if(!notified&&t>=100){notified=true;
            const totalCents=Math.round(target.shownX*target.bet*100),sum=target.lines.reduce((v,l)=>v+l.win_x,0);
            const cents=target.lines.map(l=>Math.floor(totalCents*l.win_x/sum));let remainder=totalCents-cents.reduce((a,b)=>a+b,0);
            const order=target.lines.map((l,i)=>({i,f:totalCents*l.win_x/sum-cents[i]})).sort((a,b)=>b.f-a.f);
            for(let i=0;i<remainder;i++)cents[order[i].i]++;
            const lines:GodotWinLine[]=target.lines.map((l,i)=>{const p=points(l.id);let anchor=l.id<5?p[2]:[(p[0][0]+p[1][0])/2,(p[0][1]+p[1][1])/2];
              return{lineId:l.id,handIndex:l.hand_index,hand:"",multFactor:l.mult_factor,cents:cents[i],cash:cents[i]/100,nx:anchor[0]/W,ny:anchor[1]/H}});
            callbacks.current.onWin?.(lines,target.shownX,target.rev);callbacks.current.onRoundEnd?.("external",target.rev);
          }
          // Only three scene changes: first focus, second focus, final all.
          const beat=skipped||reduced?3:t<350?0:t<600?1:2;
          if(host.current!.dataset.beat!==String(beat)){host.current!.dataset.beat=String(beat);paintWins(t)}
          nice.visible=audition&&target.shownX>=20&&target.shownX<=50&&
            (skipped?now-skippedAt<350:t>=950&&t<2200);
          if(nice.visible){const u=skipped||reduced?1:Math.min(1,(t-950)/800);
            amount.text=(target.shownX*target.bet*(1-(1-u)**3)).toFixed(2);word.scale.set(reduced||skipped?1:Math.min(1,.96+(t-950)/4500));
            flecks.children.forEach((g,i)=>{g.rotation=(t-950)*.00015*(i%2?1:-1)});
          }
        }
      });
      callbacks.current.onLoaderDone?.();callbacks.current.onReady?.();
    };
    init().catch(e=>{console.warn("Pixi initialization",e);host.current?.setAttribute("data-error",String(e));callbacks.current.onRendererError?.()});
    return()=>{disposed=true;scene.current=null;audio.stopReelSpinLoop(0);if(initialized)app.destroy(true,{children:true})};
  }, []);
  return <div ref={host} data-renderer="pixi" style={{width:"100%",height:"100%",willChange:"transform",transform:"translate3d(0,0,0)"}} />;
});
