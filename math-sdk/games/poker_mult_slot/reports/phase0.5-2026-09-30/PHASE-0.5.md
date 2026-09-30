# Phase 0.5 — restore and protect

Branch: codex/phase-0-5-restore-protect. No engine, par sheet or mathConfig changes.

## Reviewable diffs

The starting uncommitted App removed GLM's presentationHoldMs/holdPresentation, revealWin state and skip catcher, while adding resultReady, closeRevealGate, settlement flushing and loader/retry work. The ordinary ante, wallet and demo paths again waited beamRevealHoldMs both before and after the reward/count handoff.

Compare the original working file: [vs 1992b17](baseline/app-working-vs-1992b17.diff), [vs 04a9902](baseline/app-working-vs-04a9902.diff), [vs HEAD 258a1b7](baseline/app-working-vs-head.diff). The last diff isolates the uncommitted resultReady/closeRevealGate revision against its actual parent, including its other loader/retry edits. [Restoration against that working file](baseline/app-restoration-only.diff). [Final vs 1992b17](baseline/app-restored-vs-1992b17.diff), [final vs 04a9902](baseline/app-restored-vs-04a9902.diff).

The final ordinary flow is: real rev-stamped settle → one presentationHoldMs (900 ms single soft win; 1350 ms four hands) → optional big-win tier. HUD mounts on the explicit win event and resultReady must already be true. The recovery timer requests snapRound; it cannot close the gate or reveal a guessed value. Removed the extra CSS fade over the 600/220 ms counter. Restored the existing portrait win position below the frame; only the visible counter mounts, avoiding duplicate count audio. Space/board tap snaps exact values and all labels, retains a short resolved hold, and is consumed without another debit. The existing free-spins timing and big-win ladder are not ported in this phase.

## Measured timings

Source: Chrome headless on this Mac, 30 Sep 2026, fresh desktop 1440×900 and portrait 390×844 contexts. Engine seeds 1 and 6 produced 0.25× one hand and 1× four hands. No production debug hook was added. These are measured session timings, not guarantees on a physical phone.

- desktop-one-hand: accepted press → settle 1427.3 ms; press → available Spin 2345.5 ms; first visible counter 1544.9 ms at 0.00, ending 0.25.
- desktop-four-hand: accepted press → settle 1428.9 ms; press → available Spin 2795.1 ms; first visible counter 1542.9 ms at 0.00, ending 1.00.
- portrait-one-hand: accepted press → settle 1432.7 ms; press → available Spin 2358.3 ms; first visible counter 1569.2 ms at 0.00, ending 0.25.
- portrait-four-hand: accepted press → settle 1427 ms; press → available Spin 2796.2 ms; first visible counter 1557.6 ms at 0.00, ending 1.00.
- mobile-lite-one-hand: accepted press → settle 1431.6 ms; press → available Spin 2347.3 ms; first visible counter 1552.2 ms at 0.00, ending 0.25.
- mobile-lite-four-hand: accepted press → settle 1424 ms; press → available Spin 2791.6 ms; first visible counter 1539.9 ms at 0.00, ending 1.00.

Counter traces show multiple intermediate numbers while fully visible on all three layouts. Every current-round HUD count starts after its actual settle. Skip reaches exactly 1.00, and the next paid spin is not launched by that gesture. [Raw trace](verification.json), [summary](timing-summary.json).

## Wallet-wait feedback and protection

With a 1200 ms mocked wallet response, the first changed rendered board raster was **49.17 ms** after accepted click. Initial attempts measured 51.60 and 53.35 ms; those misses caused an 8 local px immediate Godot strip advance plus a reversible 4 px host card-surface shift while the independent iframe render loop catches up. No frame, stake, target or payout is invented; previous real cards move. Real reel travel continues until the actual payload arrives. cancelTravel restores the exact prior faces/multipliers and host position after refusal.

At ~850 ms pending, there was no reveal payload, win or settle. Payload arrives only after the mocked reply. React made authenticate/play/end calls; Godot spin/buyBonus/ante probes produced no additional requests. These deliberate disabled-entry probes log six expected Godot warning lines through console.error; normal round paths had zero console errors and zero failed assets.

The Web PCK has **no RgsClient autoload, source, remap or compiled transport**. 178 inspected resources. SHA256 de6ef8a12038fc6930fde9ec91b36926ff36ed01d695bc9752f1257a13d68c1e; 12,231,044 bytes. [Godot source report](GODOT-SAFETY.md), [focused patch against preexisting edits](godot-phase05-only.patch), [manifest](godot-export-manifest.json). Native contract harness passes waiting, immediate movement, rollback, pre-result snap guard and exactly one real rev-stamped settle.

## Verification and evidence

TypeScript passed; 31 tests across four existing suites passed; production build passed (existing >500 kB bundle warning). [Desktop recording](desktop-restored.mp4), [desktop GIF](desktop-restored.gif), [portrait recording](portrait-restored.mp4), [portrait GIF](portrait-restored.gif), [lite recording](mobile-lite-restored.mp4), [lite GIF](mobile-lite-restored.gif). Recordings preserve capture timestamps; 8–10 fps screencast is illustrative and is not the performance measurement.

Before: [Phase 0 desktop](../phase0-2026-09-30/evidence/desktop-session.mp4), [portrait](../phase0-2026-09-30/evidence/portrait-session.mp4). After count still: [desktop](desktop-four-hand-count.png), [portrait](portrait-four-hand-count.png). No release was submitted or published.
