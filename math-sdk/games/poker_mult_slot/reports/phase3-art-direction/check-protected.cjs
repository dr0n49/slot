// Read-only fingerprints: math/books plus the full live frontend and Godot export.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
function walk(dir) {
  if (!fs.existsSync(path.join(root,dir))) return [];
  return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e => e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
}
const math = [...fs.readdirSync(root).filter(p=>p.endsWith('.py')), 'tests/test_grid_math.py', 'frontend/src/mathConfig.json', 'frontend/src/game/engine.ts', ...walk('release/math-release'), ...walk('upload/math')].filter(p=>fs.existsSync(path.join(root,p))).sort();
const protectedFiles = [...walk('frontend/src'),...walk('frontend/public'), 'frontend/package.json', 'frontend/package-lock.json'].filter(p=>fs.existsSync(path.join(root,p))).sort();
async function hash(file) {
  const h=crypto.createHash('sha256'); for await (const chunk of fs.createReadStream(path.join(root,file))) h.update(chunk);
  return {path:file, bytes:fs.statSync(path.join(root,file)).size, sha256:h.digest('hex')};
}
(async()=>{
  const before=process.argv.includes('--before'), data={capturedAt:new Date().toISOString(),math:[],protectedFiles:[]};
  const suffix=process.argv.includes('--1c')?'-1c':process.argv.includes('--1b')?'-1b':'';
  for(const p of math)data.math.push(await hash(p));
  for(const p of protectedFiles)data.protectedFiles.push(await hash(p));
  if(!before){const initial=JSON.parse(fs.readFileSync(path.join(__dirname,'hashes-before'+suffix+'.json')));data.match={math:JSON.stringify(initial.math)===JSON.stringify(data.math),protectedFiles:JSON.stringify(initial.protectedFiles)===JSON.stringify(data.protectedFiles)};if(!data.match.math||!data.match.protectedFiles)process.exitCode=1;}
  fs.writeFileSync(path.join(__dirname,(before?'hashes-before':'hashes-after')+suffix+'.json'),JSON.stringify(data,null,2)+'\n');
  console.log(JSON.stringify({mathFiles:data.math.length,protectedFiles:data.protectedFiles.length,match:data.match}));
})().catch(e=>{console.error(e);process.exitCode=1});
