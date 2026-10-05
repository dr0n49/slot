# P3-0 — pivots, Editor weights and visual QA

2026-10-05 · `codex/character-a-p3` · P2 base `4de89353ced49aa0ab6b55e62bd0ec694ccea3a4`.

**Pivots and the seven cloth meshes have been processed. Native Editor QA is captured. Full P3-0 acceptance has not passed: large rotations expose artwork cutouts.** No animations were created.

## Current files

- `../../character-a-p3.spine`: genuine Spine Professional 3.8.75 project, opened and saved in the Editor and re-exported by its CLI. One skeleton, 45 bones, 30 slots, four skins, zero animations.
- `../../character-a-p3-setup.json` and `../../character-a-setup.json`: exact corrected source coordinates and weights.
- `../../character-a-p3-editor.json`: import copy with native skin `BASE` corresponding to runtime `default`. The other three skins remain `fs`, `idle`, `fs_idle`. Linked FS meshes point to BASE in this copy. Renaming the implicit default skin makes all four skins selectable in Editor 3.8.75.
- `../../character-a-setup-backup.json`: immutable original P2 setup.
- `native-export/character-a.json`: actual export from the saved project, retaining its 3.8.75 stamp and native coordinate rounding.
- `editor-autoweights.json`: actual Editor export after weighting, before the native BASE alias. This is the provenance input for `tools/sync-p3-weights.cjs`.
- `editor-weight-transfer.json`: six Auto operations and the right sleeve smoothing, transferred to default/idle matching geometry. FS linked meshes inherit these weights.
- `roundtrip-verification.json`: final structure, texture hashes, normalized weights, geometry, pivots and 36 temporary pose/skin checks.
- `json-verification.json`: historical pivot-only report, before Editor weighting. Its corrected-source hash belongs to that earlier stage; the final source/project hashes are in the roundtrip report.

## Exact pivots and preserved setup

| Bone | P2 local X / Y | P3 local X / Y | Target in original artwork, px |
|---|---|---|---|
| left_wrist | 545.238 / 0 | -191.225 / -253.891 | 191 / 857 |
| right_wrist | 378.720 / 0 | 328.374 / -10.508 | 731 / 1182 |

These use the revised requested local coordinates. The earlier 470px/31px values are image-space distances, not local-X increments. Both setup anchors are within 0.0003 original pixels of their targets.

Moving the wrists required compensating 38 descendant region attachments. Explicit region scaling preserves PNG physical sizes in 3.8.75 import. Mesh edges are restored from original triangles. Only the two wrist bone definitions changed. PNG pixels, slots and IK are unchanged. Final source setup vertex drift is below 0.001 world units, from Float32 rounding. The native export rounds numeric fields by approximately 0.005 world units.

## Weight operations in the real Editor

`cape`, `chest`, `hood_back`, `hood_front`, `face_neck` and `left_sleeve`: **Update Bindings, then Auto**.

`right_sleeve`: **Update Bindings**, Auto returned “Sorry, weights could not be computed.”, then **Smooth** was applied to the mesh. This is manual smoothing, not a successful seventh Auto operation or a claim of hand-painted per-vertex weights.

Editor weights are transferred to the exact original setup geometry with each bone's inverse bind transform. This avoids accumulating the Editor's export rounding. Both default and idle copies are updated; the two FS skins use linked meshes. The formerly flipped triangles at left forearm −45° are gone: all 36 saved-skin pose checks have finite vertices and zero flipped triangles. Both sleeves move with their forearms.

## Genuine Editor captures

These are direct 1920×1080 screenshots of the native Spine window. The capture tool returned JPEG data; it was stored as the requested PNG with identical decoded pixels, without crops, overlays or retouching. `native-screenshot-provenance.json` records the pixel hashes:

- `skeleton-tree.png`, `canvas-default.png`, `canvas-fs.png`, `skins-base.png`.
- `left-wrist-coordinates.png`, `right-wrist-coordinates.png`: Parent-axis local coordinates, rounded in the UI.
- `rotate-left-45.png`, `rotate-left-minus45.png`, `rotate-right-45.png`, `rotate-right-minus45.png`: temporary ±45° rotations of the elbow/forearm bones.
- `rotate-chest-15.png`: temporary chest rotation and cloth deformation.
- `weights-left-sleeve.png`: selected left elbow influence and sleeve vertex weights.
- `../p3-0-final-check.png`: saved setup pose with both wrist chains visible in the skeleton tree.
- `../p3-0-before-after-left.png`, `../p3-0-before-after-right.png`: copies of the respective native +45° captures, using the filenames requested in the first prompt; each shows one temporary pose, not a composite or a pre-fix Editor comparison.

Every temporary rotation was undone before saving. BASE was restored after checking FS. Setup rotations in the native export match the corrected source. The Editor was left open for inspection.

All `runtime-*.png` are screenshots of the separate local runtime viewer, **not Editor captures**. `runtime-before-after-*.png` compares P2 and P3 in that viewer. Its hidden-paint checkbox is diagnostic only and does not modify saved source or activate animation keys.

## Remaining acceptance failures

Native screenshots confirm exposed transparent footprints where the hands/card/deck previously occluded the original cloth. These appear at forearm ±45° and chest +15°. Existing hidden buffers reduce the gaps but do not close them completely; attachment seams and overlaps also remain. The original visible PNGs are deliberately incomplete under occlusions.

P2 explicitly approved hidden painting **disabled in setup**, preserving original RGBA/silhouette. That remains in effect. Simply enabling all buffers would change the approved setup, and recalculating visible mesh weights cannot manufacture missing texture pixels. A diagnostic transfer of the new visible weights to the hidden cloth meshes was tried separately; it did not eliminate the cutouts and was not applied to this checkpoint. Further hidden-paint coverage/registration and its activation need resolving before calling this rig animation-ready. **No “no clipping” or full P3-0 completion claim is made.**

The unchanged official vendored Spine 3.8 runtime rejects native data stamped 3.8.75 with `Unsupported skeleton data, please export with a newer version of Spine.` The native export is verified as raw data; rendering uses the corrected hand-authored source. Neither version stamps nor the runtime guard are altered. For game export, reopen/re-export with a compatible newer 3.8 patch. Esoteric staff recommend 3.8.99 for 3.8 runtimes: https://esotericsoftware.com/forum/d/29899-import-issues-ue-4272--spine-38.

## Rebuild and verify

Import the current **Editor copy** into a fresh destination. Importing into an existing `.spine` adds another skeleton instead of replacing it:

```powershell
& $SpineCli -i character-a-p3-editor.json -s 1 -o character-a-p3-new.spine -r character-a
# Replace character-a-p3.spine with this newly created file after success.
& $SpineCli -i character-a-p3.spine -o qa/p3-0-fixed/native-export -e $ExportSettings
node tools/verify-p3-pivots.cjs
```

`$SpineCli` is the installed `Spine.com`; `$ExportSettings` is its `examples/export/json.json`. Use the current `.spine` directly for normal editing.

To reconstruct from P2 in a separate scratch directory without an existing Editor weight-transfer report, first run `node tools/fix-p3-pivots.cjs`, then `node tools/sync-p3-weights.cjs qa/p3-0-fixed/editor-autoweights.json`. The pivot initializer refuses to overwrite a checkpoint that already contains Editor weights.

To refresh viewer captures, expose Playwright with `NODE_PATH`, point `P3_CHROME_PATH` to an installed Chrome if needed, and run `node tools/capture-p3-review.cjs`. It captures 26 temporary scenarios and two comparison sheets, and closes its own browser/server. Existing native captures are not overwritten by this script.

**Do not begin P3-1 animations until Andrii gives OK.**
