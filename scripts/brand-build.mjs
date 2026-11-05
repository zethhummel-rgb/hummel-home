import fs from 'node:fs';
if(process.env.VITE_APP_ENV==='test'){
 const path='dist/manifest.webmanifest',manifest=JSON.parse(fs.readFileSync(path,'utf8'));
 manifest.name='HH Test — Hummel Home';manifest.short_name='HH Test';manifest.description='Fictional household for testing HH changes.';manifest.id='./';manifest.start_url='./';manifest.scope='./';
 fs.writeFileSync(path,JSON.stringify(manifest,null,2));
 const index='dist/index.html';fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace(/<title>.*?<\/title>/,'<title>HH Test — Hummel Home</title>'));
}else{
 // Test-only instructions and fixtures must never appear in a production build.
 fs.rmSync('dist/test-guide.html',{force:true});
}
