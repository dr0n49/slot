# Spine rigs

| rig | project | animations |
|---|---|---|
| character | `character/character.spine` | idle_01, idle_02, spin_ack, small_win, cascade_continue, medium_win, big_win, anticipation, feature_trigger, feature_idle, settle_to_idle |
| symbols | `symbols/symbols.spine` | idle, win_pulse (+ variants), destroy_cloud (+ variants), column_beam, anticipation, halo_anticipation |

Both rigs come from V28 (Spine 4.3, Essential: bones, slots, colour, attachment swaps; no meshes/IK).
`symbols` has one skeleton per board cell; `symbol_slot` holds every symbol image and the game picks one
(H1 wand, H2 harp, H3 chalice, H4 scroll_feather, L1 heart, L2 purple_gem, L3 blue_gem, L4 green_gem, S halo_card).

Workflow: open a `.spine` in the Spine editor, edit, save, then from `frontend/`:

```bash
npm run spine
```

That exports JSON + a packed atlas into `frontend/public/spine/<rig>/`, which the game loads.
Game hooks: `src/spine/SpineCharacter.tsx` (reactions to spin/win/anticipation/feature/big win),
`src/spine/SpineSymbols.tsx` (drop, win, burst, halo). `?nospine` falls back to the static art.
QA in the console: `SkyCharacterQA.names()`, `.play("big_win")`, `.now()`, `.log`.
