"""Package existing PNGs/metadata into OpenRaster and a portable delivery zip.
No image editing, painting, resampling or profile conversion happens here.
"""
import json,zipfile,xml.etree.ElementTree as ET,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent.parent
reg=json.loads((root/'source/layer-registration.json').read_text())
skeleton=json.loads((root/'character-a-setup.json').read_text())
by={s['name']:s for s in reg['parts']}
for mode in ['base','fs']:
    prefix='' if mode=='base' else 'fs/'
    image=ET.Element('image',{'w':'930','h':'1691','name':'Reaper Dealer — original slices '+mode,'version':'0.0.3'})
    stack=ET.SubElement(image,'stack')
    files=[]
    for slot in reversed(skeleton['slots']):
        if slot.get('attachment'):
            s=by[slot['attachment']];visible=not s.get('gestureUnderpaint')
        elif slot['name'].endswith('_underpaint'):
            s=by[slot['name']];visible=False
        else:continue
        png=root/'layers'/prefix/((s.get('imagePath') or s['name'])+'.png')
        dest='data/'+s['name']+'.png'
        ET.SubElement(stack,'layer',{'name':s['name'],'src':dest,'x':str(s['x']),'y':str(s['y']),'opacity':'1.0','visibility':'visible' if visible else 'hidden','composite-op':'svg:src-over'})
        files.append((dest,png))
    target=root/('character-a-sliced-'+mode+'.ora')
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('mimetype','image/openraster',compress_type=zipfile.ZIP_STORED)
        z.writestr('stack.xml',ET.tostring(image,encoding='utf-8',xml_declaration=True))
        z.write(root/'qa/rebuild'/('composite-'+mode+'.png'),'mergedimage.png')
        for dest,png in files:z.write(png,dest)
    with zipfile.ZipFile(target) as z:
        assert z.namelist()[0]=='mimetype' and len(z.namelist())==33
    print(target.name,'30 placed layers, 11 hidden')
files=[root/p for p in ['character-a-master-sliced.png','character-a-master.png','character-a-fs.png','character-a-setup.json','character-a-sliced-base.ora','character-a-sliced-fs.ora','NOTES.md','source/layer-registration.json','source/user-wearability-reference.png','source/rebuild/fs-original.png','source/rebuild/fs-treatment.json','qa/rebuild/pixel-verification.json','qa/rebuild/browser-check.json','qa/rebuild/before-after.png','qa/rebuild/rig-bones-meshes.png','qa/rebuild/ownership.png']]
files+=sorted((root/'layers').rglob('*.png'))
target=root/'character-a-p2-rebuild.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for f in files:z.write(f,str(f.relative_to(root)))
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
manifest={'revision':'P2-rebuild','nativeSize':[930,1691],'originalVisiblePixelsUnchanged':True,'setupBonesUnchanged':True,'files':[{'path':str(f.relative_to(root)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'bytes':f.stat().st_size} for f in files]}
(root/'source/rebuild/delivery-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(target.name, len(files),'files')
