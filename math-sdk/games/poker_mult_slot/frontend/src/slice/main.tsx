import { createRoot } from "react-dom/client";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameStage } from "../components/GameStage";
import { CosmicBackground } from "../components/CosmicBackground";
import { SidePanels } from "../components/SidePanels";
import { BottomHud, HudWinFace } from "../components/BottomHud";
import { SlotGame, type GodotWinLine, type SlotGameHandle } from "../components/SlotGame";
import { WinLineLabels } from "../components/WinLineLabels";
import { BigWinOverlay } from "../components/BigWinOverlay";
import { buildCopy, detectLang } from "../i18n";
import { isSocialMode } from "../game/social";
import { applyLiteFxClass } from "../game/fxMode";
import { audio } from "../game/audio";
import { fixture, payload, type FixtureName } from "./fixtures";
import "../index.css";
import "../noir.css";
import "../vibrant.css";
import "./slice.css";

// Lazy load: Godot comparison route pays zero Pixi download/initialization cost.
const PixiSlot = lazy(() => import("./PixiSlot").then(m=>({default:m.PixiSlot})));
applyLiteFxClass();
const params = new URLSearchParams(location.search);
const renderer = params.get("renderer") ?? "compare";
type Trace = { event: string; t: number; rev?: number; [key: string]: unknown };
declare global { interface Window { __sliceTrace: Trace[]; __sliceFrames: number[]; __slicePayload: ReturnType<typeof payload> } }
window.__sliceTrace=[];window.__sliceFrames=[];

function Comparison() {
  const [mobile,setMobile]=useState(false);
  const replay=(name:FixtureName)=>document.querySelectorAll<HTMLIFrameElement>(".slice-compare iframe")
    .forEach(f=>f.contentWindow?.postMessage({type:"slice-replay",name},location.origin));
  return <div className="slice-comparison">
    <header><h1>Muerta renderer proof</h1><p>Same engine board · fixed stake 1 · visual audition</p>
      <div className="slice-actions"><button onClick={()=>replay("multi")}>1× · four hands</button>
        <button onClick={()=>replay("nice")}>NICE</button><button onClick={()=>replay("art")}>Ace · Queen · Reaper</button>
        <button onClick={()=>setMobile(v=>!v)}>{mobile?"Desktop":"390 × 844"}</button></div>
    </header>
    <div className={`slice-compare ${mobile?"is-mobile":""}`}>
      {["godot","pixi"].map(name=><section key={name}><h2>{name==="godot"?"Current Godot":"Pixi proof"}</h2>
        <iframe title={name} src={`./renderer-slice.html?renderer=${name}&embedded=1${params.get("device")==="mobile"?"&device=mobile":""}`} />
      </section>)}
    </div>
    <p className="slice-note">Only Queen of Hearts has proof illustration. Other courts use vector monograms. No bonus, sound-bank or full-deck migration.</p>
  </div>;
}
function Single() {
  const copy=useMemo(()=>buildCopy(detectLang(),isSocialMode()),[]),slot=useRef<SlotGameHandle>(null);
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[name,setName]=useState<FixtureName>("art"),
    [lines,setLines]=useState<GodotWinLine[]>([]),
    [win,setWin]=useState<{key:number;amount:number;instant?:boolean}|null>(null),[nice,setNice]=useState(false),
    [turbo,setTurbo]=useState(false),[muted,setMuted]=useState(false);
  const portrait=innerHeight>innerWidth,rev=useRef(0),active=useRef<FixtureName>("art"),
    landed=useRef(false),timers=useRef<number[]>([]),busyRef=useRef(false),
    winLines=useRef<GodotWinLine[]|null>(null),skipPending=useRef(false);
  const trace=(event:string,extra:Record<string,unknown>={})=>window.__sliceTrace.push({event,t:performance.now(),rev:rev.current,...extra});
  const later=(fn:()=>void,ms:number)=>timers.current.push(window.setTimeout(fn,ms));
  const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[]};
  const run=useCallback((next:FixtureName)=>{
    if(!slot.current||busyRef.current)return;
    clear();rev.current++;active.current=next;landed.current=false;busyRef.current=true;
    winLines.current=null;skipPending.current=false;
    setName(next);setBusy(true);setLines([]);setWin(null);setNice(false);
    window.__sliceTrace=[];window.__sliceFrames=[];
    const p=payload(fixture(next),rev.current);window.__slicePayload=p;trace("accepted",{fixture:next,payload:p});
    slot.current.beginTravel();slot.current.reveal(p);
  },[]);
  const finish=()=>{busyRef.current=false;setBusy(false);trace("presentation_end")};
  const skip=()=>{
    if(!landed.current||!winLines.current){skipPending.current=true;if(!landed.current)slot.current?.snapRound();return}
    skipPending.current=false;clear();slot.current?.continueRound();setLines(winLines.current);
    setWin({key:rev.current,amount:fixture(active.current).spinWinX,instant:true});
    if(active.current==="nice"&&renderer==="pixi")setNice(true);
    trace("skip_final");later(()=>{setNice(false);finish()},350);
  };
  useEffect(()=>{slot.current?.setTurbo(turbo)},[turbo,ready]);
  useEffect(()=>{slot.current?.setVolume(muted?0:1)},[muted,ready]);
  useEffect(()=>{
    const message=(e:MessageEvent)=>{if(e.origin===location.origin&&e.data?.type==="slice-replay"&&
      ["multi","nice","art"].includes(e.data.name))run(e.data.name)};
    const key=(e:KeyboardEvent)=>{if(e.code==="Space"){e.preventDefault();if(busyRef.current)skip();else run(name)}};
    window.addEventListener("message",message);window.addEventListener("keydown",key);
    return()=>{window.removeEventListener("message",message);window.removeEventListener("keydown",key)};
  });
  useEffect(()=>{if(ready)run("art")},[ready,run]);
  useEffect(()=>{let id=0,last=0;function frame(t:number){if(last&&busyRef.current)window.__sliceFrames.push(t-last);last=t;id=requestAnimationFrame(frame)}id=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(id);clear()}},[]);
  const settled=(r?:number)=>{
    if(r!==rev.current||landed.current)return;landed.current=true;trace("reels_settled");
    const isNice=active.current==="nice";
    if(isNice)later(()=>setNice(true),950);
    later(()=>{setNice(false);finish()},isNice?(renderer==="pixi"?2200:2450):950);
  };
  const onWin=(values:GodotWinLine[],x:number,r?:number)=>{
    if(r!==rev.current||!landed.current)return;trace("win",{x,lines:values});winLines.current=values;
    if(skipPending.current){skip();return}
    setWin(x>0?{key:rev.current,amount:x}:null);
    if(renderer==="pixi"&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
      const ordered=[...values].sort((a,b)=>b.cents-a.cents);setLines(ordered.slice(0,1));
      later(()=>setLines(ordered.slice(1,2)),250);later(()=>setLines(values),500);
    }else setLines(values);
  };
  const Component=renderer==="pixi"?PixiSlot:SlotGame;
  const hud=win?{...win,mode:"win" as const}:null;
  return <><GameStage><div className="relative flex h-full w-full flex-col overflow-hidden">
    <CosmicBackground bonus={false}/><SidePanels copy={copy} hits={lines.map(l=>({handIndex:l.handIndex,cash:l.cash}))} dealKey={rev.current}/>
    <div className="godot-board-slot relative z-10 flex h-full w-full flex-1 items-center justify-center overflow-visible">
      <div className="card-stage-wrap relative"><div className="playfield-board"><div className="godot-board">
        <Suspense fallback={null}><Component ref={slot} src="./godot-slot/index.html" width="100%" height="100%"
          onReady={()=>setReady(true)} onReelsSettled={settled} onWin={onWin}/></Suspense>
        {lines.length>0&&!nice?<WinLineLabels lines={lines} copy={copy} turbo={turbo} instant={renderer==="pixi"||win?.instant}/>:null}
        {busy?<button className="slice-skip" aria-label="Skip presentation" onClick={skip}/>:null}
      </div></div><div className="stage-win"><HudWinFace win={portrait?hud:null} money={copy.money} formatWin={copy.win} countMs={turbo?220:400}/></div></div>
    </div>
    <BottomHud balance={1000} bet={1} anteBet={null} turbo={turbo} auto={false} autoLeft={0} busy={busy} bonusActive={false} copy={copy}
      win={portrait?null:hud} onMenu={()=>run("art")} onBuyBonus={()=>run("nice")} soundOn={!muted} soundVol={muted?0:1}
      onToggleSound={()=>{setMuted(v=>!v);audio.toggleMasterMute()}} onSoundVolume={audio.setMasterVolume}
      onBetDown={()=>{}} onBetUp={()=>{}} onSpin={()=>run("multi")} onToggleTurbo={()=>setTurbo(v=>!v)} onToggleAuto={()=>{}}/>
  </div></GameStage>
  {!params.has("embedded")?<div className="slice-controls"><span>{renderer==="pixi"?"Pixi proof":"Current Godot"}</span>
    <button disabled={!ready||busy} onClick={()=>run("multi")}>1× · four hands</button>
    <button disabled={!ready||busy} onClick={()=>run("nice")}>NICE</button>
    <button disabled={!ready||busy} onClick={()=>run("art")}>Ace · Queen · Reaper</button></div>:null}
  {nice&&renderer==="godot"?<BigWinOverlay tier="nice" amount={fixture("nice").spinWinX} spinWinX={fixture("nice").spinWinX} copy={copy} onDone={()=>setNice(false)}/>:null}
  <div hidden data-slice-ready={ready} data-slice-busy={busy} data-fixture={name} data-current-rev={rev.current} />
  </>;
}
createRoot(document.getElementById("root")!).render(renderer==="compare"?<Comparison/>:<Single/>);
