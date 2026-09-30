# Muerta Poker — Queen anchor approval

30 September 2026. Art candidates only. No frontend, math, Godot export, wallet, or production assets were edited. Generation stops here until the Queen anchor is approved.

Recommend **Queen B**. Its crown has three clear points, with fewer small gold ornaments and cleaner robe seams. At 86×121 it reads more decisively than A; at 60×85 the difference is modest, so the native-size view is the approval reference. Both preserve the same skeletal Queen, rose, crown, dark hair, bone hands, oxblood ink and worn gold. B remains in the same engraver family rather than changing character or technique.

Open [the fixed-size proof](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/native-size-proof.html) at **100% browser zoom**. Desktop cards are exactly **86×121 CSS px** and portrait cards exactly **60×85 CSS px**. The [native contact sheet](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/native-size-proof.png) places those same pixel exports beside the current Queen, Reaper and shared paper. Display that PNG at 100% to preserve its 1× scale; a chat preview may fit it to the available width.

![Native 1× card proof](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/native-size-proof.png)

## What changed in the candidates

- **A:** more small crown ornaments, richer robe filigree. Engraving texture is attractive enlarged but several tiny shapes merge at portrait size.
- **B:** simpler three-point crown, fewer robe seams, slightly broader face structure. The crown, pale skull and rose give a more stable small-scale hierarchy. Fine hair and tooth engraving still disappears at 1×; this proof does not claim otherwise.
- **Reaper:** the existing black hood, skeletal hands, gold scythe and gold eyes are retained in the common engraving treatment. No dealer or mascot was introduced. This is a static illustration candidate, not a completed animation rig. The skull and scythe read at portrait size; the JOKER word is secondary.
- **Material:** a shared opaque bone-paper substrate, with restrained fibers at final size. It contains no ranks, indices, pips, border, character or lettering.

## Sources and composition

Built-in `image_gen` created only **four layers**: Queen A, Queen B, card material and Reaper. The original direction proof was inspected first; the current Grim Reaper was also used as an identity reference. No ace, other court, frame, prop, background or further candidate was generated.

Queen A and B each have **1024×1536 RGBA** source pixels. Reaper is **1024×1536 RGBA**. The paper is **1058×1487 RGB**; these are the actual returned dimensions, not the dimensions requested in the prompt. It exceeds the 2× requirement for the 512×720 template. Original generations are preserved without enlargement.

The double-headed courts use the same deterministic upper-bust crop and exact 180° duplication. A fine central seam and common thin border are vector geometry. The corner **Q and heart are explicit SVG paths**, with the opposite index duplicated exactly at 180°. No AI-generated rank, suit, pip or index is used. The JOKER label is live SVG font text, also outside the generated art. The assembled card masters export at **512×720** and are then downsampled once to the exact requested display sizes.

Sources:

- [Queen A illustration](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/sources/queen-a-illustration.png)
- [Queen B illustration](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/sources/queen-b-illustration.png)
- [Grim Reaper illustration](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/sources/reaper-illustration.png)
- [Shared card material](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/sources/card-material.png)
- [Vector Q/heart indices](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/vectors/queen-indices.svg)

[The prompt set](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/generation-prompts.json) records the exact generation requests. [The asset manifest](/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot/reports/phase1-art-anchor-2026-09-30/asset-manifest.json) records source and export sizes and SHA-256 hashes. Every written source, vector, export, manifest and proof was read back from disk; assembled cards and the native comparison were visually inspected.

Approval needed: **A, B, or a specific change to the Queen anchor**. After approval, the selected Queen illustration becomes the reference for every subsequent court. No additional art generation is authorized before that decision.
