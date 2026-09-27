# W6 — VISUAL PRODUCTION POLISH · NITRO VEIN × MUERTA

Ты — senior slot frontend / tech-artist. Я — архитектор проекта. Ниже контракт на W6.
Математика заморожена, геймплей (W5) завершён и покрыт тестами. W6 — только визуал.

```text
GAMEPLAY PROGRESSION = DONE
W6 = PRESENTATION ONLY
≠ NEW MATH / ≠ NEW EVENTS / ≠ NEW OUTCOMES
```

Работай этапами. После **W6.0** остановись и покажи отчёт — дальше не иди без подтверждения.

---

## 1. Где проект и как его запускать

```text
Workspace (pnpm):   ~/slot/ws
Игра:               ~/slot/ws/apps/nitro-vein
Референс арта:      ~/slot/math-sdk/games/poker_mult_slot/frontend   (Muerta Poker)
Отчёты/скрины:      ~/slot/Claude outputs/
```

Установка — только из корня workspace (приложение зависит от 27 пакетов `workspace:*`):

```bash
cd ~/slot/ws && pnpm install
cd apps/nitro-vein
NITRO_MOCK_RGS=1 pnpm vite dev --port 3007
```

```text
https://localhost:3007/?sessionID=dev&rgs_url=localhost:3007/mock-rgs&e2e=1
```

Тесты (сейчас 66/66 зелёные — это baseline):

```bash
cd ~/slot/ws/apps/nitro-vein && npx vitest run
```

Stack: SvelteKit · Svelte 5 runes · PixiJS 8 · собственный движок в `src/game/engine/`.

---

## 2. Hard freeze — что трогать запрещено

### 2.1 Математика

```text
RTP 96.00%          = frozen
PAYTABLE            = frozen
LADDER base         = [1, 2, 3, 5, 10, 20, 50]
LADDER free         = [2, 4, 8, 16, 35, 80, 200]
K-4                 = frozen   (keg поднимает на +1 ступень, выигрыш платится на каждой пройденной)
SCATTERS            = reels 1 / 3 / 5, ровно 3 → 10 FS, retrigger 3 → +5 FS
BUY COST            = 98.5×
WINCAP              = 3000×
BOOKS / LUT / RNG   = untouched
```

### 2.2 Файлы, которые W6 не меняет вообще

Перед началом зафиксируй хеши и сверь в конце — должны совпасть байт в байт:

```bash
cd ~/slot/ws/apps/nitro-vein
shasum -a 256 src/game/mathConfig.generated.ts src/game/config.ts src/game/boardLogic.ts \
  src/game/roundResult.ts src/game/roundFlow.ts src/game/typesBookEvent.ts \
  dev/mock-books.json.gz dev/mockRgs.js
```

Эталон:

```text
d90194319b1d0ced5f407872e3d69ab46b075fb89a5d6a12970dfa31cbc2174f  mathConfig.generated.ts
f9b12798ba68f85148ecb1724f7983f4451c4c5d9bec22973638f3eb00d63170  config.ts
24df1470cabc337627e8f26d95638c6f13d7e5d6fdec7c3be173b2dfb9d1671d  boardLogic.ts
3a63fc0766b1d9b48e1456adb65fd474eea633c1615b0733331b9396fbe40c88  roundResult.ts
b818f6f931fdbc7cdb968181eb705f831764c7131509267d300c04024ddba504  roundFlow.ts
02160a0b7b79d3f6b599d7c288ccd0b97ff3ff4fbf10e0863e0b8782a8006b2a  typesBookEvent.ts
2acde4384b88185548816b16a6ba47f7b5642921a87d95cec2663cc73473f2b8  mock-books.json.gz
91a62936970e3ec79e980482d6ae861c27fc0c45d33fb382b0274eb2abf60873  mockRgs.js
```

Сразу сделай baseline-коммит, чтобы весь W6 был виден одним диффом:

```bash
cd ~/slot/ws && git init -q 2>/dev/null; git add -A && git commit -qm "baseline before W6"
```

### 2.3 Контракты W5, которые нельзя сломать

Эти вещи чинились в W5 по реальным багам. Меняешь визуал вокруг них — сохраняй поведение.

| Где | Контракт |
|---|---|
| `presentationPlan.ts` → `planBlast()` | Ступени берутся из `kegBlast.rungs`, вклад ступени — из `winInfo.ladder.rungs` (через `roundContext.pendingRungs`), итог — из `blast.multiplier`. Фронтенд ничего не складывает и не вычисляет. |
| `presentationPlan.ts` → `tempo()` | Длинный раунд сжимает свои паузы (15 с полного веса → пол 0.3). Худший раунд сейчас 81 с при пороге 90 с. |
| `presentation.ts` → `beat()`, `waitForContinue()` | Все паузы идут через `beat()`/`tempo()`. Гейт не переживает свой раунд: снимается при skip, settle, recover; новый гейт освобождает старый. |
| `presentation.ts` → `requestSkip()` | Skip запрещён во время `bigWin`, `featureIntro`, `featureOutro`. |
| `engine/tween.ts` | Проверка живости цели + `try/catch` вокруг шага задачи: одна сломанная анимация не роняет остальные. |
| `engine/board.ts` | Guard `if (v.removed \|\| v.destroyed) return;` перед записью в `v.y` в анимациях падения. |
| `utils.ts` | Watchdog 90 с (fast-forward) / 120 с (settle). Пороги не поднимать — если не влезаешь, сжимай анимацию. |
| `presentationPlan.ts` → `triggerText()` | Число скаттеров пишется только если оно равно 3. На экране никогда не должно быть «4/5 SCATTERS», «14/18 FREE SPINS». |

**Тайминг-бюджет.** Любая новая или удлинённая анимация в обработчике события обязана:
1. идти через `beat()` / `tempo()` / `scheduler`, а не через голый `setTimeout`;
2. отражаться в таблице `COST` в `src/game/__tests__/pacing.test.ts`;
3. оставлять `pacing.test.ts` зелёным (0 книг выше 90 с).

Если красивая анимация не помещается в бюджет — её укорачивают, а не поднимают порог.

---

## 3. Art direction — «VENA DE LOS MUERTOS»

### 3.1 Идея

Берём **визуальную грамматику Muerta Poker** (готический чёрно-золотой Día de Muertos) и переносим её в **шахту NITRO VEIN**. Не покерный стол в шахте и не шахта с черепами поверх — а одна цельная вселенная:

> Заброшенная золотая шахта, превращённая в ofrenda. Шахтёры ушли, но жила всё ещё горит.
> Динамит расписан как сахарные черепа, по балкам натянуты бумажные гирлянды,
> вместо фонарей — свечи, золотая руда светится как бархатцы. Каждый взрыв — праздник.

Идентичность игры остаётся той же: **NITRO VEIN + BLAST LADDER + взрывной подъём по лестнице.** Muerta даёт ей стиль, а не новую механику.

### 3.2 Палитра (снята с `muerta-bg.svg`)

Оформи как CSS-переменные + TS-константы для Pixi в одном месте (`src/game/theme.ts` или аналог). Никаких хексов, разбросанных по компонентам.

```text
--ink-0      #050203   фон, самые глубокие тени
--ink-1      #0b0406
--ink-2      #1c080d   панели
--ink-3      #3a0b16   подложки, неактивные ступени
--blood      #c8102e   акцент, ставка/опасность, фитиль
--blood-2    #a30f24
--blood-3    #7d0a1a
--gold       #e2b04a   основной золотой (обводки, цифры)
--marigold   #f0a534   бархатцы — позитивный акцент, частицы
--ember      #e2892a   огонь/взрыв
--gold-dim   #8a7a58   состаренное золото, неактивный текст
--bone       #fff3e0   «кость» — главный светлый, текст
--bone-2     #d8c9a4
```

Правило: чёрный доминирует, золото — структура, кровь — только акцент, бархатцы/огонь — только для событий. Экран в idle должен быть спокойным и тёмным.

### 3.3 Типографика

Уже лежат в `static/assets/fonts/` и self-hosted (Stake CSP блокирует внешние шрифты):

```text
Pirata One   — заголовки, слова выигрыша (BIG / MEGA / MASSIVE), FREE SPINS
Oswald 500–700 — все цифры: баланс, ставка, выигрыш, множители ступеней
Rubik (+cyr) — мелкий текст, InfoDialog, кириллица
```

`Barrio` из Muerta можно добавить как редкий декоративный акцент (OFL 1.1, self-host) — но не для цифр.

### 3.4 Приёмы, которые переносим из Muerta

Они уже реализованы в Muerta (`vibrant.css`, `godot-slot/shaders/symbol_fx.gdshader`, `~/slot/Claude outputs/muerta-poker-visual-polish.diff`) — изучи и адаптируй под Pixi 8:

1. **Двойной обод «золото + чернила»** — рамка борда, панель лестницы, кнопка спина: `2px gold` снаружи `5px ink`. Главная рамочная подпись стиля.
2. **Техника «ink-outline / bone-fill / blood-red accent»** — как в `calavera.svg`, `star-ink.svg`: жирный чернильный контур, заливка цвета кости, одна красная деталь.
3. **Медленное «дыхание» idle** — аура за кнопкой спина и рамкой, период 6–9 с, малая амплитуда. Отключается в `prefers-reduced-motion`.
4. **Одноразовый диагональный отблеск (sheen)** по символу/ступени при событии — снизу-слева вверх-вправо, по альфе объекта.
5. **Dim не-выигравших** — при показе выигрыша остальные символы десатурируются и затемняются, но не больше ~0.82 (символ остаётся читаемым, не силуэт).
6. **Impact flash** — короткий аддитивный бело-золотой всплеск в момент удара/применения множителя, гаснет за несколько кадров.
7. **Idle-свечение особых символов** — Keg, Scatter: тихое, ровное, чтобы не читалось как «сейчас выигрывает».
8. **Калавера по бокам слова выигрыша** — только на MASSIVE / MAX.
9. **Золотой луч по строке**, когда она «загорается».

### 3.5 Мотивы → элементы игры

| Элемент | Как выглядит в новом стиле |
|---|---|
| Фон base | Штрек шахты в глубоком чёрно-бордовом, балки, свечи в нишах, тонкие золотые прожилки руды в породе |
| Фон Deep Vein (FS) | Та же шахта, но жила «вскрыта»: больше золота и бархатцев, тёплый свет снизу, гирлянды papel picado по балкам |
| Рамка борда | Двойной обод gold+ink, углы — кованые скобы шахтной крепи |
| Blast Ladder | Вертикальный ствол-подъёмник: 7 ступеней как кованые платформы, между ними фитиль. Верхняя ступень — MAX с калаверой |
| `K` Nitro Keg | Бочка TNT, расписанная как сахарный череп (узор кости + красный фитиль) |
| `S` Scatter (dynamite) | Связка динамита с лентами papel picado — самый «праздничный» символ |
| `W` Wild | Золотой звёздно-крестовый знак (адаптация `star-ink`) |
| `H1–H4` relics | Шахтёрские реликвии в ink-технике: каска-свеча, кирка, вагонетка, самородок |
| `L1–L5` gems | Самоцветы, огранка чистая, заливка насыщенная, контур чернильный — самые «тихие» символы |
| `R` bedrock | Мёртвая порода: тёмная, матовая, без золота. Должна мгновенно читаться как «не играет» |
| Частицы | Лепестки бархатцев, золотая пыль, искры фитиля, каменная крошка. Не конфетти |

### 3.6 Что брать из Muerta можно, а что нельзя

Смотри `~/slot/math-sdk/games/poker_mult_slot/ASSETS_LICENSE.md`.

```text
МОЖНО копировать/адаптировать (project-original, без ограничений):
  frontend/public/assets/ui/ink-plate.svg
  frontend/public/assets/ui/star-ink.svg
  frontend/public/assets/ui/calavera.svg
  шрифты Pirata One / Barrio / Oswald (OFL 1.1)
  CSS-техники, шейдерные идеи, тайминги — это код, не ассеты

НЕЛЬЗЯ копировать в nitro-vein (лицензия не задокументирована):
  cards_v2/*.webp, card_back.png   — колода Muerta
  ui/catrina.png                   — портрет катрины
  bunting/papel-*.webp             — гирлянды (перерисовать своими SVG)
  assets/sounds/*                  — кроме того, что уже есть в nitro-vein
```

Нарисованное с нуля в том же стиле — можно. Скопированное — нет. Никаких персонажей/логотипов чужих игр и брендов.

---

## 4. W6.0 — аудит и style frame (без правок кода игры)

Изучи и составь карту:

```text
src/game/engine/   scene.ts  board.ts  symbolView.ts  layout.ts  particles.ts
                   textures.ts  tween.ts  perf.ts
src/game/          presentation.ts  presentationPlan.ts  bookEventHandlerMap.ts
                   assets.ts  sfx.ts  stateGame.svelte.ts  stateLayout.ts
src/components/    Game.svelte  LadderPanel.svelte
                   hud/Hud.svelte  hud/TopBar.svelte
                   overlays/BigWin.svelte  FeatureOverlay.svelte  Banner.svelte
                   Popups.svelte  RightRail.svelte  InfoDialog.svelte  BuyBonusDialog.svelte
static/assets/     img/bg.jpg  img/symbols/*.png  fonts/  sounds/
```

Найди: переиспользуемые Pixi-компоненты, систему частиц и её лимиты, загрузчик текстур, layout-абстракции, систему переходов, где живут цвета/шрифты сейчас.

**Выход W6.0 (и стоп):**

1. Карта модулей: что за что отвечает, что переиспользуем, что заменяем.
2. Asset inventory (раздел 14) — что есть, что перерисовать, что новое.
3. `theme.ts` с палитрой и шрифтами (единственное изменение кода на этом этапе).
4. **Style frame** — один статичный экран idle в новом стиле (фон + рамка + лестница + 3–4 символа), 1920×1080 и портрет 1080×1920. Можно как отдельную HTML/Pixi-страницу в `dev/`, не трогая игру.
5. Список рисков: где визуал может упереться в тайминг-бюджет или производительность.

Покажи — и жди подтверждения.

---

## 5. Иерархия экрана

```text
BOARD            — главный объект, всегда
  ↓
WIN / K-4 event  — временно поднимается над всем
  ↓
LADDER           — постоянно видна, отдельна от сетки
  ↓
HUD / side info  — спокойная, не спорит с бордом
```

Лестница визуально не сливается с сеткой, но в момент бласта связь «keg на борде → ступень» должна быть физически видна (фитиль / искра / луч от бочки к ступени).

Геометрия только из `GAME.numReels` / `GAME.numRows` / `layout.ts`. Никаких литералов `5`, `6`, `30` в новом коде.

---

## 6. Символы

- Крупные, контрастные, одинакового визуального веса внутри своего класса (L < H < special).
- Силуэт узнаётся за 150 мс без цвета — проверь в grayscale.
- Никакого постоянного glow. FX — только когда символ участвует в событии.
- Исключение — тихое idle-свечение `K` и `S` (приём 3.4.7).
- `R` — самый тусклый объект на борде.
- Мастера в SVG (`static/assets/img/src/`), в игру — PNG/WebP @2x в атласе через существующий `textures.ts`. Размеры и anchor не менять без правки `symbolView.ts`.

---

## 7. Blast Ladder — центральный визуальный элемент

Состояния ступени:

```text
idle → active (текущая) → keg impact → rung ignition → paid (вклад ступени) → passed
```

Реальный пример из книги (`/__qa/book?id=21866`):

```json
{"type":"kegBlast","fromIndex":0,"toIndex":2,"nextIndex":3,"multiplier":6,
 "rungs":[{"index":0,"multiplier":1},{"index":1,"multiplier":2},{"index":2,"multiplier":3}]}
```

Презентация: `×1` платит → `×2` платит → `×3` платит → итог `×6` из `blast.multiplier` → лестница стоит на ступени 3.

Каждая ступень — отдельное состояние на экране со своим бейджем вклада (уже есть: `stateGame.ladderTick`, `.paid` в `LadderPanel.svelte`). Ты меняешь **как это выглядит**, не **откуда берутся числа**.

В FS лестница другая (`[2 … 200]`) — визуально это «раскалённый» вариант той же конструкции.

---

## 8. Keg / explosion — шкала интенсивности

Интенсивность выводится **только** из данных события:

| Уровень | Условие (из книги) | Доля бластов* | Что показываем |
|---|---|---:|---|
| 1 · single | `rungs.length === 2` (один keg) | ~75 % | Короткий фитиль, хлопок, немного крошки, лёгкий толчок ступени. Без тряски экрана |
| 2 · multi | `rungs.length === 3` | ~21 % | + искры по фитилю между ступенями, короткий shake |
| 3 · deep | `rungs.length >= 4`, **или** `toIndex` = верхняя ступень (MAX) | ~4 % | + вспышка, пыль на весь борд, заметный shake, пауза на итоге |
| 4 · feature | любой бласт в FS на ступени ≥ 4, или совпал с big-win | редко | Максимум: свет снизу, лепестки, калавера на MAX-ступени |

\* по базовым книгам фикстуры.

Особый случай: `rungs.length === 1` при `fromIndex === toIndex === 6` — keg сработал, когда лестница уже на MAX. Это не «мелкий» бласт: он платит верхнюю ступень (×50 в base, ×200 в FS). Показывай как deep, с ударом по MAX-ступени без подъёма (пример: `/__qa/book?id=3704532`).

Обычный keg **никогда** не должен выглядеть как max win. Shake, число частиц, свет и громкость растут строго по уровню. Все параметры — в одной таблице пресетов, не размазаны по коду.

Фазы бласта: `anticipation (фитиль) → impact → debris/dust/sparks → rung reaction → aftermath`. Всё через `beat()`, в пределах бюджета из 2.3.

---

## 9. Каскад

```text
winning symbols highlight (+ dim остальных)
→ разрушение (крошка по материалу символа: камень / стекло самоцвета / металл)
→ падение
→ refill
→ следующий результат
```

Новый борд не перекрывает предыдущий результат раньше, чем закончилась K-4 презентация. Guard'ы из `board.ts` (2.3) сохраняются.

---

## 10. Big / Mega / Massive / Max

Один параметризованный компонент (развить `overlays/BigWin.svelte` + `presentBigWin()`), не три копии.

Тир — только из `winLevel` книги через `tierForLevel()`:

```text
level 6      → BIG
level 7      → MEGA
level 8–9    → MASSIVE
level 10     → MAX WIN (3000×)
```

Счётчик уже эскалирует BIG → MEGA → MASSIVE по порогам `WIN_LEVELS`. Нужно: слово Pirata One с золотым тиснением и ink-обводкой, лепестки/золотая пыль вместо generic монет, калавера по бокам на MASSIVE/MAX, двойной обод на плашке суммы. Skip во время big win по-прежнему запрещён — работает только «тап = докрутить до суммы, второй тап = дальше».

---

## 11. Feature — «DEEP VEIN»

```text
3-й scatter приземляется (reels 1/3/5)
→ борд реагирует (скаттеры загораются, остальное гаснет)
→ фитили от трёх скаттеров сходятся
→ окружение трансформируется: шахта → вскрытая жила
→ intro: «3 SCATTERS · 10 FREE SPINS»
→ лестница перекрашивается в free-вариант
```

Retrigger: `scatter → +5 FREE SPINS`. Текст — только через `triggerText()`. Outro держится дольше, если выигрыш дотянул до celebration-тира (`featureOutroHold`). Борд FS отличается от base, но игра узнаётся с первого кадра.

---

## 12. HUD

Баланс, ставка, спин, BUY (98.5×), turbo, autoplay (если есть), лестница, счётчик FS, выигрыш, info, звук.

Игрок не ищет главное. Во время события временно поднимаются `WIN`, `MULTIPLIER`, `LADDER`, `FREE SPINS`; после — HUD возвращается в спокойное состояние. Кнопка спина — двойной обод и медленная аура (приём 3.4.3). Все цифры — Oswald, tabular-nums.

---

## 13. Responsive

Проверить минимум: 16:9, 16:10, 21:9, узкий десктоп (~1024×768), мобильный портрет (390×844), мобильный ландшафт. Лестница в портрете — существующий strip-режим в `LadderPanel.svelte`. Сетка 5×6 не ломается нигде.

---

## 14. Assets

Сначала инвентарь, потом производство. Один согласованный язык, не пять вариантов каждого ассета.

```text
symbols (13)      H1–H4 L1–L5 W S K R
background        base + deep vein, landscape + portrait
board frame       один, 9-slice
ladder            ступень ×3 состояния, фитиль, MAX-калавера
kegs / FX         спрайт-листы или процедурно: искры, крошка, пыль, лепесток, вспышка
UI                кнопки, плашки (ink-plate), иконки
feature           intro-плашка, гирлянды papel picado (свои SVG)
win presentation  плашка суммы, калавера, рамка слова
```

Заведи `apps/nitro-vein/ASSETS_LICENSE.md` по образцу Muerta: откуда каждый ассет, какая лицензия. Всё, что нарисовано тобой — «project-original».

---

## 15. Анимационная архитектура

Все анимации: interruptible · skippable · deterministic из состояния события · безопасны при watchdog и recovery · не пишут в game state.

```text
BOOK EVENT → PRESENTATION (plan) → ANIMATION
```

Не наоборот. Если для эффекта хочется события, которого нет в книге — эффекта не будет. Визуал красиво подаёт существующий outcome.

`prefers-reduced-motion`: убрать shake, idle-дыхание, сократить частицы.

---

## 16. Производительность

Меряй на своём Mac (реальный GPU). Цифры из облачной песочницы (~2 FPS, софтверный рендер) не показательны.

- 60 FPS на desktop во время deep-бласта и MASSIVE.
- Пул частиц с жёстким лимитом; никакого `new Graphics()` в каждом кадре.
- Текстуры в атласах; уничтожение всего созданного за раунд; без утечек listeners.
- Stress: 100+ раундов подряд (turbo + autoplay), включая FS, ретригер, big/mega/massive. Без деградации FPS и роста памяти (heap snapshot до/после). Используй `engine/perf.ts`.

---

## 17. Звук

Существующие файлы в `static/assets/sounds/` покрывают все события (`fuse`, `keg_blast`, `ladder_up_0..5`, `fs_*`, `bigwin_*`, `mult_tick` …). Громкость и слои — по шкале интенсивности из раздела 8. Новые звуки — только с задокументированной лицензией.

---

## 18. Тесты и QA

Старые 66 тестов — зелёные. `pacing.test.ts` — зелёный с обновлённой таблицей `COST`.

Детерминированные сценарии (mock RGS, вызывать перед спином):

```text
/mock-rgs/__qa/force?cat=fs|big|mega|massive|max
/mock-rgs/__qa/book?id=1138      пустой спин
/mock-rgs/__qa/book?id=887       обычный keg (2 ступени)
/mock-rgs/__qa/book?id=21866     multi-rung K-4: ×1 → ×2 → ×3 = ×6
/mock-rgs/__qa/book?id=170843    3+ каскада без keg
/mock-rgs/__qa/book?id=410891    фича с ретригером
/mock-rgs/__qa/book?id=552844    deep blast (5 ступеней)
/mock-rgs/__qa/fail?kind=http|invalid|slow|balance   ошибки и recovery
```

Добавь Playwright screenshot-regression для: idle, обычный keg, multi-rung K-4, каскад, feature intro, retrigger, massive, final result, recovery — в landscape и portrait.

На каждом прогоне:

```text
console errors          = 0
uncaught promise errors = 0
invalid phase transitions = 0   (warn "[nitro-vein] unexpected phase transition")
"presentation is slow"  = 0 на книгах без skip
```

---

## 19. Deliverable

```text
STATUS: W6_COMPLETE
```

Отчёт:

- changed files (`git diff --stat` от baseline);
- asset inventory + `ASSETS_LICENSE.md`;
- скриншоты 8 ключевых состояний (landscape + portrait) в `~/slot/Claude outputs/w6/`;
- таблица шкалы интенсивности с реальными параметрами;
- responsive QA по 6 viewport'ам;
- производительность: FPS min/avg на deep blast и massive, heap до/после 100 раундов;
- тесты: было 66 → стало N, `pacing` worst-case в секундах;
- console / promise errors, invalid transitions;
- хеши файлов из 2.2 — совпадают с эталоном;
- подтверждение: презентация управляется событиями книги, фронтенд не вычисляет outcome.

Итоговое состояние:

```text
MATH     = FROZEN
GAMEPLAY = COMPLETE
VISUAL   = PRODUCTION READY
```

---

## 20. Правила работы

- Маленькие логические коммиты, по одному на подсистему (theme → frame → symbols → ladder → blast FX → cascade → big win → feature → HUD → responsive).
- Движок не переписывать без необходимости. Сначала расширять то, что есть.
- Конфликт «красиво vs данные книги» → данные книги побеждают.
- Конфликт «красиво vs тайминг-бюджет» → анимация укорачивается.
- Сомневаешься, трогает ли правка математику или контракт W5 — остановись и спроси.
