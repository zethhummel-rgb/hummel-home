import fs from 'node:fs';
if(process.env.VITE_APP_ENV==='test'){
 const path='dist/manifest.webmanifest',manifest=JSON.parse(fs.readFileSync(path,'utf8'));
 manifest.name='HH Test — Hummel Home';manifest.short_name='HH Test';manifest.description='Fictional household for testing HH changes.';manifest.id='./';manifest.start_url='./';manifest.scope='./';
 fs.writeFileSync(path,JSON.stringify(manifest,null,2));
 const index='dist/index.html';fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace(/<title>.*?<\/title>/,'<title>HH Test — Hummel Home</title>'));
 fs.copyFileSync('test-support/about.html','dist/about.html');
}else{
 // Test-only instructions and fixtures must never appear in a production build.
 fs.rmSync('dist/test-guide.html',{force:true});
 for(const page of ['home.html','request-invitation.html'])fs.rmSync('dist/'+page,{force:true});
 fs.rmSync('dist/homepage',{force:true,recursive:true});
}

const assets=fs.readdirSync('dist/assets').filter(file=>/\.(js|css)$/.test(file)).sort().map(file=>'assets/'+file);
const files=['index.html','icon.svg','favicon.svg','manifest.webmanifest','icons/hh-180.png','icons/hh-192.png','icons/hh-512.png',...assets];
const {createHash}=await import('node:crypto');
const hash=createHash('sha256');
for(const file of files)hash.update(fs.readFileSync('dist/'+file));
const version=hash.digest('hex').slice(0,16);
const worker=fs.readFileSync('dist/sw.js','utf8').replace("/* shopping-shell */ {version:'dev',files:[]}",JSON.stringify({version,files}));
fs.writeFileSync('dist/sw.js',worker);
