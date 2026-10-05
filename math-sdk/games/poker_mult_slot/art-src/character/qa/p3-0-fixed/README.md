# P3-0 import fix — partial delivery

2026-10-05 · `codex/character-a-p3` · source commit `4de89353ced49aa0ab6b55e62bd0ec694ccea3a4`.

**Wrist correction and native CLI import are complete. Full P3-0 is NOT complete.**
Auto Weight/weight painting, native Editor screenshots and clipping acceptance remain pending.
No animations were added or started.

## Saved files

- `../../character-a-p3.spine`: real project created, reopened and exported by the installed Spine Professional 3.8.75 CLI. It is not an empty file or renamed JSON.
- `../../character-a-p3-setup.json`: corrected hand-authored source; also saved as `../../character-a-setup.json`.
- `../../character-a-setup-backup.json`: exact original P2 setup, retained for comparison and repeatable corrections.
- `../../previews/p3-0.html`: interactive review of the corrected source and the original P2 source. Serve the character directory over localhost.
- `native-export/character-a.json`: untouched export from the real `.spine` project, including its genuine 3.8.75 version stamp.
- `json-verification.json`, `roundtrip-verification.json`, `browser-verification.json`: independent setup, native serialization and browser checks.
- All `runtime-*.png`: screenshots of our **local runtime viewer**, not the Spine Editor. Native Editor screenshot filenames requested in the task have deliberately not been used.

## Pivot changes and artwork preservation

| Bone | Old local X / Y | Corrected local X / Y | Artwork anchor, native px |
|---|---|---|---|
| left_wrist | 545.238 / 0 | -191.225 / -253.891 | 191 / 857 |
| right_wrist | 378.720 / 0 | 328.374 / -10.508 | 731 / 1182 |

These are the exact coordinates in the revised user instruction. The former 470px and 31px figures describe distance to the artwork in image space; they are not increments to local bone X.
The measured setup error after correction is below 0.0003 native pixels on both wrists.

Moving a wrist also moves its descendant attachments. Local offsets of 38 region attachments were compensated so the original setup artwork stays in place, including optional hand swaps and all four skins.
Spine 3.8.75 import replaces region width/height with PNG dimensions. Explicit region scale now preserves the original physical size of cuffs, hands, cards and deck during native import.
Editable mesh edges were restored from existing triangles; triangulation is preserved through import/export, although the Editor changes triangle ordering.
Only the two wrist bone definitions changed. Slots, IK and all PNG pixels are unchanged. Maximum source setup vertex drift is 0.000246 world units, from Float32 rounding.

## Checks and remaining failures

45 bones, 30 slots, 4 skins (`default`, `fs`, `idle`, `fs_idle`), 134 attachments checked, 40 mesh records across default/idle skins (20 meshes per skin), 0 animations.
All referenced PNGs load. Every original mesh influence remains normalized, with valid bone indexes and finite coordinates.
36 temporary pose/skin checks cover forearms ±45°, wrists +45°, chest ±15° and setup. Sleeves respond to forearm rotation, but this does not certify good deformation.

The left forearm at -45° produces **two flipped triangles per skin**. Runtime screenshots also show exposed cutout gaps and overlaps around the hands/card/deck in large rotations, including right +45° and chest +15°. These require weighting, shoulder/elbow review and use of the existing hidden occlusion buffers. The buffers remain disabled in the saved setup, as required by the P2 artwork approval. No clipping-free claim is made.

Weights on `cape`, `hood_back`, `hood_front`, `left_sleeve`, `right_sleeve`, `face_neck` and `chest` were structurally checked, **not recalculated with Spine Auto Weight or painted**. The CLI exposes import/export, not that Editor action. The existing influence values are preserved.

The unchanged official vendored 3.8 runtime explicitly rejects JSON stamped `3.8.75` with `Unsupported skeleton data, please export with a newer version of Spine.` Native serialization was therefore checked as raw data (maximum numeric rounding difference 0.005006), while pose/render checks use the corrected hand-authored source. Neither the native version stamp nor the runtime guard was altered.
For game runtime export, reopen the project in a compatible newer 3.8 patch and re-export. Esoteric staff recommend 3.8.99 for 3.8 runtimes: https://esotericsoftware.com/forum/d/29899-import-issues-ue-4272--spine-38.

Native window access was repeatedly rejected by the Computer Use app approval gate: `Computer Use was not approved to use spine`. This is separate from filesystem access and Windows sandbox mode. CLI import succeeds without administrator elevation.

## Reproduce

Run from the character directory with Node.js:

```powershell
node tools/fix-p3-pivots.cjs
```

Import into a **new output file** using the installed CLI, then export JSON:

```powershell
# Replace $SpineCli and $ExportSettings with paths to your installed Spine.com
# and its examples/export/json.json. Do not import into an existing project:
# Spine adds another skeleton rather than replacing the prior skeleton.
& $SpineCli -i character-a-p3-setup.json -s 1 -o character-a-p3-new.spine -r character-a
# On success, replace character-a-p3.spine with character-a-p3-new.spine.
& $SpineCli -i character-a-p3.spine -o qa/p3-0-fixed/native-export -e $ExportSettings
node tools/verify-p3-pivots.cjs
```

To reproduce runtime screenshots, install Playwright in a separate tool environment (or expose it with `NODE_PATH`), set `P3_CHROME_PATH` to an existing Chrome executable if needed, and run:

```powershell
node tools/capture-p3-review.cjs
```

It starts a temporary localhost server, captures only the review page, then closes the browser/server. Temporary poses create no saved animation keys.

After native app access is available, open `character-a-p3.spine`, finish the seven meshes and verify BASE/FS forearm ±45°, chest deformation and card/deck boundaries. Save genuine Editor screenshots and commit that final verification separately. **Do not begin P3-1 animations before Andrii's OK.**
