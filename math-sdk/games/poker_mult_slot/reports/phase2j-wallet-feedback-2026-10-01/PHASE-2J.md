# Visible wallet-wait feedback — resumed verification

The user resumed the second checkpoint on 1 October. No renderer, wallet or math implementation changed in this sub-phase: it completes the interrupted audit of the existing reversible travel implementation.

Twelve new browser trials cover desktop 1440×900, portrait 390×844 and `?device=mobile`, two accepted and two rejected wallet responses per profile. Every local wallet response waits 1200 ms. First changed raster is 31.66–49.20 ms after the accepted click; all twelve meet the requested ≤50 ms threshold in this local Chrome run. The measurement compares captured card-region pixels to the last pre-press raster, requiring >2000 pixels with RGB absolute-difference sum >45. Dispatch time and background animation do not count. Click-to-travel dispatch is 0.2–2.1 ms and is reported separately.

During the wait, there is no target, landing collision, settle or positive result. Space cannot settle target-free travel. Each accepted response lands exactly its real 25-card payload and settles once. Every rejection restores the previous actual board exactly. Wallet requests originate in React's top-level page only. `verification.json` preserves all twelve trials; the interrupted six-trial checkpoint and older >50 ms observations remain in their original reports. This is local browser acceptance evidence, not a guarantee about every device or real-phone acceptance.

Two additional accepted-response recordings preserve the complete waiting-to-settle sequence for desktop and portrait. Their first changed raster is 43.14 and 34.45 ms. `recording-verification.json` preserves both measurements, with zero page errors and failed assets. GIF/MP4 capture intervals are preserved; encoding to 30 FPS is not an FPS benchmark.

Before: the interrupted checkpoint had six partial observations, no mobile-lite trials and no completed evidence. After: all three profiles have a complete accepted/rejected audit and both required recordings. Runtime source is identical to the last TypeScript/39-test/production-build pass in Phase 2I; no new source required a repeated build. The existing 4 px compositor feedback, continuous real strip phase, rejection rollback, resultReady/closeRevealGate, visible counter, single hold and React wallet ownership are preserved.

Full Pixi visual parity, remaining bonus presentation beats, approved complete art integration, licensed audio bank and real-phone review remain pending. Godot stays the production default/fallback. No purchase, deployment, resubmission or new art integration.
