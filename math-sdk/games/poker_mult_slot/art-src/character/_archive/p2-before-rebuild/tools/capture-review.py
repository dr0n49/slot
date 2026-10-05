"""Browser QA only. Does not draw or edit artwork and writes no animation keys."""
import argparse,base64,json
from pathlib import Path
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--url',default='http://127.0.0.1:5184/previews/index.html')
p.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
a=p.parse_args()
root=Path(__file__).resolve().parent.parent
report={'errors':[],'states':[],'viewports':[],'nativeEditorWorkflowWaivedByUser':True,'source':'Official Spine 3.8 geometry in WebGL review, not Spine Editor','collisions':[],'handSwapWristDriftPx':0}
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=a.chrome,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1920,'height':1080})
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.goto(a.url)
    page.wait_for_load_state('networkidle')
    page.wait_for_selector('html[data-ready=true]')
    page.screenshot(path=str(root/'qa/review-desktop.png'))
    report['viewports'].append({'width':1920,'height':1080,'horizontalOverflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
    for skin in ['default','fs']:
        page.locator('#skin').select_option(skin)
        page.locator('#jointTest').select_option('rest')
        wrist_ref=None
        for pose in ['deck','idle','card','point','open']:
            page.locator('#pose').select_option(pose)
            state=page.evaluate('rigReview.draw()')
            report['states'].append(state)
            if wrist_ref is None:wrist_ref=state['wrists']
            for side in ['left','right']:
                delta=sum((x-y)**2 for x,y in zip(state['wrists'][side]['world'],wrist_ref[side]['world']))**.5
                report['handSwapWristDriftPx']=max(report['handSwapWristDriftPx'],delta)
            png=page.evaluate('rigReview.capture()').split(',')[1]
            (root/'qa'/f'rig-{skin}-{pose}.png').write_bytes(base64.b64decode(png))
        page.locator('#eyes').check()
        page.locator('#pose').select_option('deck')
        report['states'].append(page.evaluate('rigReview.draw()'))
        png=page.evaluate('rigReview.capture()').split(',')[1]
        (root/'qa'/f'rig-{skin}-eyes.png').write_bytes(base64.b64decode(png))
        page.locator('#eyes').uncheck()
        page.locator('#pose').select_option('card')
        tests=[f'{side}_{joint}_{sign}{45 if joint=="elbow" else 30}' for side in ['left','right'] for joint in ['elbow','shoulder','wrist'] for sign in ['plus','minus']]+['pointGesture','overlap']
        for test in tests:
            page.locator('#jointTest').select_option(test)
            state=page.evaluate('rigReview.draw()')
            report['states'].append(state)
            collision=page.evaluate('rigReview.overlap(["left_hand","right_hand"],["marigold_leaves","marigold","ribbon_left","ribbon_right"])')
            report['collisions'].append({'skin':skin,'test':test,**collision})
            png=page.evaluate('rigReview.capture()').split(',')[1]
            (root/'qa'/f'runtime-{skin}-{test}.png').write_bytes(base64.b64decode(png))
        page.locator('#jointTest').select_option('rest')
        page.locator('#pose').select_option('deck')
        page.locator('#showPivots').check()
        page.locator('.rig-wrap').screenshot(path=str(root/'qa'/f'p2fix-pivots-{skin}.png'))
        page.locator('#showPivots').uncheck()
    page.locator('#pose').select_option('deck')
    page.locator('#showBones').check()
    page.locator('#showMesh').check()
    page.locator('.rig-wrap').screenshot(path=str(root/'qa/rig-bones-meshes.png'))
    page.locator('#showBones').uncheck()
    page.locator('#showMesh').uncheck()
    page.set_viewport_size({'width':390,'height':844})
    page.goto(a.url)
    page.wait_for_load_state('networkidle')
    page.wait_for_selector('html[data-ready=true]')
    page.screenshot(path=str(root/'qa/review-mobile.png'))
    report['viewports'].append({'width':390,'height':844,'horizontalOverflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
    browser.close()
report['result']='PASS' if not report['errors'] and report['handSwapWristDriftPx']==0 and all(s['error']==0 and s['verticesOutsideViewport']==0 for s in report['states']) and all(not v['horizontalOverflow'] for v in report['viewports']) and all(c['pixels']==0 for c in report['collisions']) else 'FAIL'
(root/'qa/browser-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
if report['result']!='PASS':raise SystemExit(1)
