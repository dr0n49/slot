import { useEffect, useRef } from "react";
import { Application, Container } from "pixi.js";
import { loadSymbolPaint, makeSymbolPaint, updateSymbolPaint } from "../spine/paintedSymbol";
import { ART, idlePose, popPose, restPose, winPose, winReact } from "../spine/symbolMotion";

/** Contact sheet of the actual board paintings, frozen at common points in their animations. */
const SYMS = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "S"];
const MOMENTS: [string, number][] = [["idle", 0], ["idle", 1], ["win", 0.1], ["win", 0.25], ["win", 0.7], ["pop", 0.2]];
const CELL = Math.max(40, Math.min(320, Number(new URLSearchParams(location.search).get("cell")) || 150));

export default function SymbolsQA() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let app: Application | undefined;
    void (async () => {
      const textures = await Promise.all(SYMS.map(loadSymbolPaint));
      if (!active) return;
      const a = new Application();
      await a.init({ background: "#3c194b", width: SYMS.length * CELL, height: MOMENTS.length * CELL,
        resolution: Math.min(window.devicePixelRatio || 1, 3), autoDensity: true, autoStart: false, preference: "webgl" });
      if (!active) { a.destroy(true); return; }
      app = a;
      host.current!.appendChild(a.canvas);
      MOMENTS.forEach(([anim, t], row) => SYMS.forEach((sym, col) => {
        const paint = makeSymbolPaint(textures[col]);
        const cell = new Container(), reaction = new Container();
        const pose = restPose();
        if (anim === "win") {
          winPose(sym, t, 0, pose);
          const r = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1 };
          winReact(sym, t, r);
          reaction.rotation = r.rot;
          reaction.scale.set(r.sx, r.sy);
          reaction.position.set(r.dx * ART, r.dy * ART);
        } else if (anim === "pop") popPose(sym, t, pose);
        else if (t > 0) idlePose(sym, t, 0, 0.6, pose);
        updateSymbolPaint(sym, paint, pose);
        cell.scale.set(CELL * 0.8 / ART);
        cell.position.set((col + 0.5) * CELL, (row + 0.5) * CELL);
        cell.addChild(reaction);
        reaction.addChild(paint);
        a.stage.addChild(cell);
      }));
      a.render();
      document.body.dataset.qaReady = "1";
    })();
    return () => { active = false; app?.destroy(true, { children: true }); delete document.body.dataset.qaReady; };
  }, []);
  return <div ref={host} />;
}
