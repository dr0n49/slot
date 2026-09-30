import { Component, forwardRef, lazy, Suspense, useState, type ReactNode } from "react";
import { SlotGame, type SlotGameHandle, type SlotGameProps, type RevealPayload } from "./SlotGame";

const PixiSlot=lazy(()=>import("./PixiSlot").then(m=>({default:m.PixiSlot})));

class PixiBootBoundary extends Component<{children:ReactNode; onError:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true}}
  componentDidCatch(){this.props.onError()}
  render(){return this.state.failed?null:this.props.children}
}

// Opt-in while parity is reviewed. Godot remains the default and is also
// the automatic boot fallback if Pixi cannot initialize on this device.
export const BoardRenderer=forwardRef<SlotGameHandle,SlotGameProps & {initialCards?:RevealPayload["cards"]}>((props,ref)=>{
  const [pixi,setPixi]=useState(()=>new URLSearchParams(location.search).get("renderer")==="pixi");
  return pixi
    ? <PixiBootBoundary onError={()=>setPixi(false)}><Suspense fallback={null}><PixiSlot {...props} ref={ref} onRendererError={()=>setPixi(false)} /></Suspense></PixiBootBoundary>
    : <SlotGame {...props} ref={ref} />;
});
