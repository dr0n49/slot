import { describe, expect, it } from "vitest";
import { LandingMotion } from "./landingMotion";

function harness(reduced=false) {
  const collisions:Array<{column:number;joker:boolean;offset:number;t:number}>=[];
  const prepares:Array<{column:number;offset:number;t:number}>=[];
  let settled=0,time=0;
  const motion=new LandingMotion({wrap:()=>{},prepare:column=>prepares.push({column,offset:motion.reels[column].offset,t:time}),
    collision:(column,joker)=>collisions.push({column,joker,offset:motion.reels[column].offset,t:time}),settled:()=>settled++},reduced);
  return {motion,collisions,prepares,get settled(){return settled},tick(t:number){time=t;motion.tick(t)}};
}

describe("real-target landing contract",()=>{
  it("carries the wallet feedback into the same live phase, including a boundary wrap",()=>{
    let wraps=0;const motion=new LandingMotion({wrap:()=>wraps++,prepare:()=>{},collision:()=>{},settled:()=>{}});
    motion.begin(0,false);motion.carryFeedback(200);motion.carryFeedback(12);
    expect(wraps).toBe(5);expect(motion.reels.map(r=>r.offset)).toEqual([7,7,7,7,7]);
    motion.reveal(0,[0,0,0,0,0]);motion.carryFeedback(20);
    expect(motion.reels.map(r=>r.offset)).toEqual([7,7,7,7,7]);
  });
  it("keeps travelling beyond a wallet delay; snap cannot invent a result, cancellation does not settle",()=>{
    const h=harness();h.motion.begin(0,false);
    for(let t=16;t<1250;t+=16)h.tick(t);
    expect(h.prepares).toHaveLength(0);expect(h.collisions).toHaveLength(0);expect(h.settled).toBe(0);
    expect(h.motion.snap()).toBe(false);expect(h.motion.cancel()).toBe(true);
    expect(h.motion.reels.every(r=>r.phase==="rest"&&r.offset===0)).toBe(true);
    h.tick(2000);expect(h.settled).toBe(0);
  });
  it("approaches from the live phase, collides once per column, and settles only after the last overshoot",()=>{
    const h=harness();h.motion.begin(0,false);h.motion.reveal(0,[0,0,0,0,1]);
    for(let t=13;t<=1700;t+=13){
      h.tick(t);
      for(const p of h.prepares){const r=h.motion.reels[p.column];
        if(r.approachAt===t)expect(r.offset).toBe(p.offset)}
      if(h.collisions.length<5)expect(h.settled).toBe(0);
    }
    expect(h.prepares.every(p=>p.offset>0&&p.offset<205)).toBe(true);
    expect(h.collisions.map(c=>c.column)).toEqual([0,1,2,3,4]);
    expect(h.collisions.every(c=>c.offset===0)).toBe(true);
    expect(h.collisions.map(c=>c.joker)).toEqual([false,false,false,false,true]);
    expect(h.settled).toBe(1);
    expect(h.motion.reels.every(r=>r.phase==="rest"&&r.offset===0)).toBe(true);
    h.tick(3000);expect(h.settled).toBe(1);
  });
  it("handles a delayed turbo target and a snap without stale collisions or a second settle",()=>{
    const h=harness();h.motion.begin(0,true);
    for(let t=17;t<1200;t+=17)h.tick(t);
    h.motion.reveal(1200,[0,0,0,0,0]);
    for(let t=1207;t<1250;t+=7)h.tick(t);
    expect(h.motion.cancel()).toBe(false);expect(h.motion.snap()).toBe(true);
    h.tick(2200);expect(h.collisions).toHaveLength(0);expect(h.settled).toBe(0);
    h.motion.begin(2300,true);h.motion.reveal(2300,[0,0,0,0,0]);
    for(let t=2311;t<2900;t+=11)h.tick(t);
    expect(h.collisions.map(c=>c.column)).toEqual([0,1,2,3,4]);expect(h.settled).toBe(1);
  });
  it("reduced motion retains every collision and final result with no squash",()=>{
    const h=harness(true);h.motion.begin(0,false);h.motion.reveal(0,[0,1,0,0,0]);
    h.tick(119);expect(h.settled).toBe(0);h.tick(120);
    expect(h.collisions).toHaveLength(5);expect(h.settled).toBe(1);
    expect(h.motion.squash(1,2,150)).toEqual([1,1]);
  });
  it("starts anticipation at the second-joker brake, slows only future reels, and ends once after the last settle",()=>{
    const events:Array<{active:boolean;t:number;ms:number}>=[];let time=0,settled=0;
    const motion=new LandingMotion({wrap:()=>{},prepare:()=>{},collision:()=>{},settled:()=>settled++,anticipation:(active,ms)=>events.push({active,t:time,ms})});
    motion.begin(0,false);motion.reveal(0,[1,1,0,0,1]);
    for(time=10;time<=700;time+=10)motion.tick(time);
    expect(events).toHaveLength(0);expect(motion.reels[4].speedK).toBe(1);
    time=710;motion.tick(time);expect(events[0]).toEqual({active:true,t:710,ms:2160});
    expect(motion.anticipation.shadedAt.slice(0,2)).toEqual([710,710]);
    for(time=720;time<=1100;time+=10)motion.tick(time);
    expect(motion.reels[0].speedK).toBe(1);expect(motion.reels[4].speedK).toBeCloseTo(.55);
    expect(motion.pulseElapsed(0,1159)).toBe(-1);expect(motion.pulseElapsed(0,1160)).toBe(0);
    for(time=1110;time<=3200;time+=10)motion.tick(time);
    expect(settled).toBe(1);expect(events.map(e=>e.active)).toEqual([true,false]);
    expect(motion.anticipation.active).toBe(false);expect(motion.reels.every(r=>r.speedK===1)).toBe(true);
  });
  it("does not tease when the second joker is in the final column, or in reduced motion",()=>{
    for(const reduced of [false,true]){
      const events:boolean[]=[];const motion=new LandingMotion({wrap:()=>{},prepare:()=>{},collision:()=>{},settled:()=>{},anticipation:active=>events.push(active)},reduced);
      motion.begin(0,false);motion.reveal(0,reduced?[1,1,0,0,1]:[0,0,0,1,1]);
      for(let t=10;t<2000;t+=10)motion.tick(t);
      expect(events).toEqual([]);expect(motion.reels[4].stopAt).toBe(reduced?120:1270);
    }
  });
  it("a snap clears an active tease and its delayed pulse without replay in the next wallet wait",()=>{
    const events:boolean[]=[];const motion=new LandingMotion({wrap:()=>{},prepare:()=>{},collision:()=>{},settled:()=>{},anticipation:active=>events.push(active)});
    motion.begin(0,true);motion.reveal(0,[1,1,0,0,1]);for(let t=10;t<230;t+=10)motion.tick(t);
    expect(events).toEqual([true]);expect(motion.snap()).toBe(true);expect(events).toEqual([true,false]);
    motion.begin(240,true);for(let t=250;t<1700;t+=10)motion.tick(t);
    expect(events).toEqual([true,false]);expect(motion.pulseElapsed(0,1700)).toBe(-Infinity);
  });
});
