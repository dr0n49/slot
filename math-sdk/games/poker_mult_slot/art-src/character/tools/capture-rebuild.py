"""Browser screenshots/checks only. Does not draw or edit illustration pixels."""
import base64,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
report={'pageErrors':[],'states':[],'viewports':[],'wristsChangedOnSwap':False,'source':'Official Spine 3.8 static runtime, not native Editor'}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1920,'height':1080},device_scale_factor=1)
    page.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
    page.goto('http://127.0.0.1:5184/previews/rebuild.html',wait_until='networkidle')
    page.wait_for_selector('html[data-ready=true]',timeout=30000)
    page.locator('.comparison').screenshot(path=str(root/'qa/rebuild/before-after.png'))
    page.screenshot(path=str(root/'qa/rebuild/review-desktop.png'))
    report['viewports'].append({'width':1920,'height':1080,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
    wrist_ref=None
    for skin in ['default','fs']:
        page.locator('#skin').select_option(skin)
        for pose in ['setup','idle','point','open']:
            page.locator('#pose').select_option(pose)
            state=page.evaluate('rebuildReview.draw()')
            report['states'].append(state)
            if wrist_ref is None:wrist_ref=state['wrists']
            if state['wrists']!=wrist_ref:report['wristsChangedOnSwap']=True
            data=page.evaluate('rebuildReview.capture()').split(',')[1]
            (root/'qa/rebuild'/f'runtime-{skin}-{pose}.png').write_bytes(base64.b64decode(data))
        page.locator('#pose').select_option('setup')
        page.locator('#underpaint').check()
        report['states'].append(page.evaluate('rebuildReview.draw()'))
        data=page.evaluate('rebuildReview.capture()').split(',')[1]
        (root/'qa/rebuild'/f'runtime-{skin}-underpaint.png').write_bytes(base64.b64decode(data))
        page.locator('#underpaint').uncheck()
    page.locator('#skin').select_option('default')
    page.locator('#showBones').check()
    page.locator('#showMesh').check()
    page.locator('.rig-wrap').screenshot(path=str(root/'qa/rebuild/rig-bones-meshes.png'))
    page.locator('#showBones').uncheck()
    page.locator('#showMesh').uncheck()
    page.set_viewport_size({'width':390,'height':844})
    page.goto('http://127.0.0.1:5184/previews/index.html',wait_until='networkidle')
    page.wait_for_selector('html[data-ready=true]',timeout=30000)
    page.screenshot(path=str(root/'qa/rebuild/review-mobile.png'))
    report['viewports'].append({'width':390,'height':844,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
    report['missingImages']=page.evaluate('[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src)')
    browser.close()
report['result']='PASS' if not report['pageErrors'] and not report['missingImages'] and not report['wristsChangedOnSwap'] and all(not v['overflow'] for v in report['viewports']) and all(s['glError']==0 and s['outside']==0 for s in report['states']) else 'FAIL'
(root/'qa/rebuild/browser-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if report['result']!='PASS':raise SystemExit(1)
