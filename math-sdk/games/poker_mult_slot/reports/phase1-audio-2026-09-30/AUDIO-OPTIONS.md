# Muerta Poker — audio options and six-sample audition

Checked 30 September 2026. No pack was purchased and no game audio was replaced. Five ElevenLabs SFX plus original local music are ready; listen in [LISTEN.md](./LISTEN.md).

## Recommendation

Use the six audio auditions to judge the palette before commissioning the whole family. For production, my preference is licensed tactile recordings plus an authored D-minor / 100 BPM score and the shared D-A-C-D motif. A purchased pack supplies material; it does not supply Muerta's coherent identity. The two packs below cost **US$80.40 at the displayed prices**, before any taxes or additional editor seats, and still require composition and sound-design work.

### ElevenLabs generation

The current monthly prices are **Starter US$6**, **Creator US$22 (US$11 first month)**, and **Pro US$99**, excluding taxes. The current API page lists **SFX US$0.12/minute** and **Music US$0.15/minute**: five requested SFX sources totalling 4.10 seconds plus 30 seconds of music give an arithmetic estimate of **US$0.0832** at those headline rates, before tax, any minimum or plan-specific billing. The earlier **1,450-credit** estimate uses approximate Creative-plan rates and is a conservative planning figure, not an API debit quote. Record actual account and billing-header usage. No subscription or credit purchase is authorized here. [Creative pricing](https://elevenlabs.io/pricing), [API pricing](https://elevenlabs.io/pricing/api).

Paid SFX output can be used commercially subject to the service terms, rights and beta exclusions. Music has separate restrictions: the current Music terms exclude monetized games available through multiple platforms from every self-serve plan and Enterprise Music Lite. Full Enterprise Music has broader media rights and custom pricing. Muerta should not ship music under a generic Starter commercial-license assumption; get suitable terms for its distribution. Starter–Pro music enrollment is individual-only; Scale permits organizations with fewer than ten employees. API access does not remove these model-specific rights; the Music API terms supplement them. [SFX commercial use](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform), [Music rights and eligibility](https://elevenlabs.io/eleven-music-model-specific-terms), [Music API terms](https://elevenlabs.io/music-api-terms).

Best use: bespoke paper/bone contacts and fast style auditions. Weaknesses: pitch, motif, transients and tails need editorial checks; separate requests can drift in timbre. Prompted loudness is not measured loudness. Music-loop seams need editing.

### Pack 1 — Epic Stock Media: Board Game Sound Effects Kit

**US$41.40 sale / US$69 list**. Includes 1,203 sounds, with card actions, wooden pieces, buttons, transitions and rewards; 96 kHz / 24-bit WAV is available. This is the best of the researched options for quiet, tangible contacts rather than casino-floor ambience. Use selected paper, wood and restrained metallic elements, then trim and balance them. Reject any bright stock victory jingles that do not fit the approved palette. [Product and on-page demos](https://epicstockmedia.com/product/board-game-sound-effects-kit-for-tabletop-card-and-dice-games/).

The standard license permits perpetual commercial use synchronized into games, with no royalties or attribution. It covers one named human editor; shared source access needs a multi-user license. It prohibits use as input to generative AI without additional permission. Use conventional editing and layering, not model reference uploads. [Publisher EULA](https://epicstockmedia.com/licensing-agreement/).

### Pack 2 — Image Sounds: Nylon Guitar — Latin & Spanish Styles

**US$39** on the opened product page. Contains 676 live four-bar nylon-guitar loops, mic and DI versions, 24-bit / 44.1 kHz, labelled by key and tempo, spanning 93–125 BPM. Its dry DI/mic material is a closer match to the approved nylon palette than a complete Western soundtrack. Select a restrained minor-key accompaniment and arrange it at 100 BPM. Exact D-minor material and the D-A-C-D phrase must be checked in the content before selection. This pack contains guitar only; demo percussion and other instruments are excluded. [Product and demo](https://www.imagesounds.com/produkt/nylon-guitar-latin-spanish-styles).

The license permits indefinite worldwide commercial use when combined or arranged into new music, expressly including computer-game background music. It is non-transferable, prohibits redistribution of raw material, and forbids generative-AI training or analysis uploads. It does not turn an unchanged guitar loop into a finished soundtrack. [Creator license](https://www.imagesounds.com/license-terms).

## Six-sample gate

The exact request bodies and edit targets are in `sample-batch.json`. Only these six items are in scope now: `spin_press` (0.10 s), `reel_stop` (0.13 s), `win_normal` (0.65 s), `big_nice` (1.20 s), `bonus_trigger` (1.25 s), and `music_base` (30.00 s audition).

The SFX API accepts at least 0.5 seconds, so the two short contacts requested 0.5-second isolated sources and were edited to their runtime lengths. [SFX API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert). The initial instrumental [Music API brief](https://elevenlabs.io/docs/api-reference/music/compose) was blocked by the account's Free tier. Following the decision to avoid a purchase, the final music audition is an original local composition using physical/modal instrument models; no provider music or recordings are used.

Thirty seconds at 100 BPM is 50 beats, or 12.5 bars of 4/4. The requested excerpt is therefore **an audition, not a certified seamless production loop**. If approved, the planned base loop remains 16 bars / 38.4 seconds. Nothing is integrated until the samples are listened to and approved.

Acceptance: contacts read immediately and avoid fizz; reward and bonus are distinguishable while sharing timbre; the four motif notes are recognizable; the music leaves room for repeated card stops. Check headphones and a phone speaker, then meter the files after editing. Music target −24 LUFS-I / ≤−3 dBTP; SFX use the approved per-cue targets. The combined runtime master still has a ≤−1 dBTP ceiling, with approved foreground ducking and voice limits. No listening-quality rating is claimed from product descriptions.

## Generation result

All six items are ready: five ElevenLabs Free-plan SFX for this private audition, plus original locally authored 30-second music using physical/modal instrument models. The music is not ElevenLabs output or live recordings and uses no stock recordings. No purchase or game integration occurred. The approved D-minor /100BPM /D-A-C-D score and provenance are preserved; the 30-second excerpt is not a seamless production loop. All six await listening approval; no full-family generation has begun.

The supplied API credential was used through a no-echo TTY in an ephemeral process and was not written to a keyfile, report, environment or repository. Untouched provider SFX exports and the original authored music WAV are preserved beside measured audition masters. Free-provider SFX need suitable commercial rights before production. The original local music has no provider/stock music licensing fee. See [LISTEN.md](./LISTEN.md), `samples/generation-manifest.json` and `samples/music-base-provenance.json`.
