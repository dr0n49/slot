#!/usr/bin/env bash
# Install Architect role + global AGENTS.md into ~/.zcode (run in Terminal.app)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
ZCODE_HOME="${HOME}/.zcode"

mkdir -p "${ZCODE_HOME}/agents"

cp "${ROOT}/agents/architect.md" "${ZCODE_HOME}/agents/architect.md"

cat > "${ZCODE_HOME}/AGENTS.md" << 'EOF'
# ZCode — Architect + Computer Vision operating rules

You are working as **Architect-first**. Prefer planning and structural decisions before large edits.

## Computer Vision / Computer Use
- Prefer built-in **Computer Use** (`$computer-use`) for desktop UI observation when the user asks to “see the screen”, verify the app, or drive another window.
- Loop: observe → one action → verify. Accessibility first; screenshots/pixel fallback only when needed.
- Never delegate Computer Use to a subagent.
- If Accessibility or Screen Recording is denied, stop and ask the user to grant permissions in macOS Settings.

## Browser
- For local game preview use built-in browser (e.g. `http://127.0.0.1:5182/`).
- After UI changes, visually verify; attach or describe what you saw.

## Collaboration style
- Speak concisely (RU/UK mix ok if the user writes that way).
- For architecture asks: summon `@architect` or answer in architect mode (structure, trade-offs, brief).
- For implementation: implement only the agreed brief; no drive-by refactors.

## Quality bar
- Match existing project style.
- No secrets in commits or chat echoes.
- Verify with the smallest meaningful check (dev server / targeted test).
EOF

# Unhide Computer Use composer entry
python3 - <<'PY'
import json
from pathlib import Path
p = Path.home() / ".zcode" / "v2" / "setting.json"
if p.exists():
    d = json.loads(p.read_text())
    d["computerUseComposerEntryHidden"] = False
    projects = [
        "/Users/andriinorenko/slot/math-sdk/games/poker_mult_slot",
        "/Users/andriinorenko/slot/math-sdk",
    ]
    recent = d.get("recentProjects") or []
    for path in reversed(projects):
        if path in recent:
            recent.remove(path)
        recent.insert(0, path)
    d["recentProjects"] = recent[:12]
    p.write_text(json.dumps(d, indent=2) + "\n")
    print("Updated", p)
else:
    print("No setting.json yet — open ZCode once, then re-run this script.")
PY

echo ""
echo "Installed:"
echo "  ${ZCODE_HOME}/agents/architect.md"
echo "  ${ZCODE_HOME}/AGENTS.md"
echo ""
echo "Next in ZCode:"
echo "  1. Open workspace: poker_mult_slot"
echo "  2. Settings → grant Accessibility + Screen Recording when Computer Use asks"
echo "  3. New task → Plan mode → paste .zcode/STARTER_ARCHITECT_TASK.md"
echo "  4. Use @architect for architecture; \$computer-use for screen vision"
