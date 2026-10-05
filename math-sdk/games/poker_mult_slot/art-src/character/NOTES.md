# Reaper Dealer — P2 rebuild from the original

2026-10-05 · branch `codex/character-a-p2-rebuild` · target **Spine Professional 3.8.75**.
The original card-holding pose and visible silhouette are restored. This is an art slicing and
setup delivery, with **no animation keys**. Existing bone coordinates and IK were preserved
exactly as requested; this limits animation readiness, described below.

## Source and approved exceptions

The authoritative source is `source/user-wearability-reference.png`, **930×1691**.
Andrii explicitly chose this native file without enlargement. The former 1634×2800 master was
the rejected reconstructed character, not the original. That package is retained under
`_archive/p2-before-rebuild/`; it must not be used as the visual authority.

Every visible BASE slice contains original RGBA pixels at integer offsets. There is no visible
repainting, limb repositioning, silhouette reshaping, texture simplification or image upscale.
The original lower crop remains. Colour tags are sRGB, PNGs have transparent irregular bounds.

The original is not opaque: **1,131,741 pixels have alpha 253/255**. Andrii explicitly selected
**separate hidden painting, disabled in setup**, rather than normalising the original alpha.
This supersedes the requirement to put opaque underpaint inside each visible PNG. Turning every
hidden layer on would change the slightly transparent original, even with perfect placement.

## Deliverables

- `character-a-master-sliced.png` — exact original-pixel reconstruction, native 930×1691.
- `character-a-master.png` — same current BASE reference; the rejected master is archived.
- `character-a-fs.png` — current FS colour reference, same coverage/geometry as BASE.
- `character-a-setup.json` — hand-authored Spine 3.8 Import Data, setup only.
- `layers/` — 19 original visible slices and 7 optional prior hand-pose drawings.
- `layers/underpaint/` — 9 deformation buffers plus 2 hidden gesture backfills.
- `layers/fs/` — corresponding 37 PNGs in the FS colour treatment.
- `character-a-sliced-base.ora`, `character-a-sliced-fs.ora` — placed OpenRaster documents for
  Krita: 19 visible layers, 11 hidden layers, native offsets, 100% opacity, normal blend.
- `character-a-p2-rebuild.zip` — portable PNG/JSON/ORA/notes/proof package for another device.
- `previews/index.html` → `rebuild.html` — original vs saved-layer composite, skins, hand swaps,
  hidden paint, mesh/bone overlays and individual pieces.
- `qa/rebuild/before-after.png` — required before/after screenshot.
- `qa/rebuild/pixel-verification.json` — authoritative pixel and placement checks.
- `source/layer-registration.json` — native offsets and renderer registration.

## Visible layer list, back to front

1. `cape` — original cloak and lower front panels, one mesh texture.
2. `left_sleeve` — original far sleeve in the raised/bent arm pose.
3. `right_sleeve` — original near sleeve.
4. `hood_back` — original inner/back wrap.
5. `face_neck` — original skull and neck; sockets separate.
6. `chest` — original collar and waistcoat, continuous mesh texture.
7. `hood_front` — original calm crown-to-shoulder front panel.
8. `left_wrist`, `right_wrist` — original cuffs.
9. `left_card` — original raised card, beneath the gripping fingers.
10. `deck` — original full-size deck, beneath the supporting fingers.
11. `left_hand_card` — original raised hand, **default**, never a generated substitute.
12. `right_hand_deck` — original supporting hand, **default**.
13. `marigold_leaves`, `ribbon_left`, `ribbon_right`, `marigold` — original lapel ornament.
14. `left_eye`, `right_eye` — original socket pixels; no eye FX in the default image.

These visible textures form an exclusive partition: each original visible pixel is present
once. They are intentionally incomplete where the original part was occluded. Separate hidden
paint supplies those overlap areas; it is not mixed into locked visible pixels.

## Hidden paint

`cape_underpaint`, `left_sleeve_underpaint`, `right_sleeve_underpaint`,
`hood_back_underpaint`, `face_neck_underpaint`, `chest_underpaint`,
`hood_front_underpaint`, `ribbon_left_underpaint`, `ribbon_right_underpaint`:
**32 native pixels** of extension only into areas occluded by a higher original layer. Their
setup slots have no active attachment. Their meshes use the same weighting rules as the parent.

`left_gesture_underpaint`, `right_gesture_underpaint` cover the full hidden footprints behind
hands/card/deck when those are removed for swaps. These are additional occlusion fills, not
32px buffers. Their BASE/FS attachments have `color: ffffff00`; idle skins use opaque copies.
They are never visible in the original setup. Point/open preview states activate them explicitly.

Hidden paint used built-in **image_gen.imagegen**, only as material/anatomy sources. The retained
original visible PNGs never came from generated outputs. Magenta target bands, clipped masks,
all twelve paint outputs and the full prompts are preserved in `source/rebuild/`.
Nine buffer guides are registered to the target bounds; uncovered guide edges are extended from
nearest valid painted material only inside the hidden mask. No magenta or empty-alpha source
is used as final hidden paint. This edge extension never touches original visible pixels.
Final gesture fills use two registered local crops to continue the waistcoat behind hands and
props. Only the exact occluded footprints are accepted. All generated changes outside them are
discarded. The earlier full-canvas guide is retained as process history.

FS uses a continuous RGB-only colour treatment of the original: oxblood shifts to deep teal/cyan,
bone cools, warm gold and marigold remain. No displacement, new folds or new contours. The
canonical FS original is `source/rebuild/fs-original.png`, established before composite checking.
FS and BASE PNGs have identical alpha values and bounds. FS is a colour variant of the original,
not a claim that a separate matching FS source was supplied by Andrii.

## Hands and skins

- `default`: exact original raised card hand + full-size supporting deck hand.
- `fs`: same original pose in the FS colour treatment.
- `idle`: original body/limbs, prior idle hand drawings retargeted to the original artwork wrists,
  props hidden, hidden backfills exposed. No lowered-arm replacement of the original body.
- `fs_idle`: same idle swaps in FS.

Optional swaps: `left_hand_idle`, `left_hand_point`, `left_hand_open`,
`right_hand_idle`, `right_hand_card`, `right_hand_point`, `right_hand_open`.
These are retained prior pose drawings, not new slices of the original. Their PNGs keep the
prior resolution; registration and uniform renderer size match the original wrist region.
Point/open swaps hide the card and deck and reveal the gesture backfills. The default original
pose never selects these alternative drawings.

## Skeleton and important pivot limit

**45 existing bones, 30 slots, 20 weighted meshes, 4 skins, 0 animations.** Bone definitions and
IK definitions are byte-identical after JSON decoding to the pre-rebuild package. No bones were
reposed to imitate the original. Attachments are registered from original pixel positions into
the retained skeleton coordinate system. PNGs remain native; skeleton world units use a uniform
1.6558249556 scale to preserve the former world-height convention. That is renderer registration,
not an enlargement of the PNG files.

```text
root (0,0; virtual feet below the cropped artwork)
├─ hips
│  ├─ spine_01
│  │  └─ spine_02
│  │     └─ chest
│  │        ├─ neck
│  │        │  └─ head
│  │        │     ├─ jaw
│  │        │     ├─ face_neck
│  │        │     ├─ left_eye
│  │        │     │  └─ left_eye_glow
│  │        │     ├─ right_eye
│  │        │     │  └─ right_eye_glow
│  │        │     └─ hood_front
│  │        │        ├─ hood_left
│  │        │        └─ hood_right
│  │        ├─ hood_back
│  │        ├─ left_shoulder
│  │        │  └─ left_arm
│  │        │     ├─ left_elbow
│  │        │     │  └─ left_wrist
│  │        │     │     └─ left_hand
│  │        │     └─ left_sleeve
│  │        ├─ right_shoulder
│  │        │  └─ right_arm
│  │        │     ├─ right_elbow
│  │        │     │  └─ right_wrist
│  │        │     │     └─ right_hand
│  │        │     │        └─ deck
│  │        │     └─ right_sleeve
│  │        └─ garland_01
│  │           ├─ garland_02
│  │           │  ├─ garland_03
│  │           │  │  └─ ribbon_right
│  │           │  │     └─ ribbon_right_tip
│  │           │  ├─ marigold_leaves
│  │           │  └─ ribbon_left
│  │           │     └─ ribbon_left_tip
│  │           └─ marigold
│  └─ cape
│     ├─ cape_left
│     ├─ cape_center
│     └─ cape_right
├─ left_ik
└─ right_ik
```

**The retained pivots are not all anatomically correct for this restored pose.** The former
left wrist maps to roughly (99,1318) in this native artwork; the raised artwork wrist is roughly
(191,857), a **470px** separation. The right wrist is about **31px** off its artwork anchor.
Shoulder/elbow alignment also needs an anatomical review. Correct setup appearance does not
certify a safe joint rotation. P3 must relocate the pivots and rebind weights before animation;
this delivery deliberately honours the instruction to keep their coordinates unchanged.
The preview marks both the retained bones and approximate artwork wrists.

Spine Editor is on another device, and Andrii waived native Spine work here. The unmodified
Spine 3.8 runtime parses and renders this hand-authored import data. There is no fabricated
Editor export stamp. A native 3.8.75 Import Data check remains to be done on that device.

## Verification and how to repeat

Pixel preflight runs before writing the new Spine setup. Independent verification then loads
**the saved PNG files in JSON draw order**, at their native integer offsets and 100% opacity.
The compositor uses libvips with a linear scRGB working pipeline, exported back to sRGB.

Results in `qa/rebuild/pixel-verification.json`:

- BASE vs original: **0 changed visible RGBA pixels**, max channel delta **0**.
- FS vs canonical FS original: **0 changed visible RGBA pixels**, max channel delta **0**.
- Missing or overlapping visible pixels: **0**; source channel drift in visible slices: **0**.
- BASE/FS alpha differences: **0**; visible pixels replaced by hidden buffer paint: **0**.
- Existing bones and IK: unchanged; root remains 0,0; animations: **0**.
- Official Spine 3.8 setup registration error: below **0.00026 world pixels**.
- Browser review: 1920×1080 and 390×844, no missing images or horizontal overflow; skin/swap
  checks preserve wrist bones. See `qa/rebuild/browser-check.json`.

There are 281 zero-alpha pixels with hidden RGB payload in the source. They have no visible
appearance. Full reference exports restore that invisible payload after checking the actual
composite; decoded full RGBA hashes then also equal the respective original. Visible checks
are performed before that restoration, so it cannot hide any visible difference.

Photoshop/Krita are not installed here. **This is not a claim of native editor verification.**
The two ORA files contain the actual placed PNG stack for an independent Krita check. Open the
BASE ORA at 100%, leave the 11 hidden layers off, compare to the original; use the FS original
for FS. Keep matching sRGB profiles and avoid resampling. A low-precision 8-bit compositing path
can round a few RGB channels by one unit on the source's partial alpha; the verified scRGB
working pipeline retains exact values.

```sh
node art-src/character/tools/rebuild-character.cjs
node art-src/character/tools/rebuild-character.cjs --finish
node art-src/character/tools/verify-rebuild.cjs
python3 art-src/character/tools/capture-rebuild.py
python3 art-src/character/tools/package-rebuild.py
```

The old redraw exporter is disabled. Historical scripts, art and QA remain in the archive.
Current authoritative reports are under `qa/rebuild/`; older PASS reports do not certify this
new package. Frontend, UI, cards, game math and smoke shader were not changed.

## Remaining work

Native Krita/Photoshop and Spine Editor checks on the other device; anatomical pivot correction
and weight refinement before animation. No approval of animations or game integration is
implied by this rebuild. The source resolution is the explicitly approved 930×1691.
