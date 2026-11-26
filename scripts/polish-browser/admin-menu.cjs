// Synthetic signed-in menu checks. The browser is limited to the local fixture.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {setTimeout:delay}=require('node:timers/promises');
const {launchBrowser}=require('./browser.cjs');
const {setFixtureHandler,serveFixture,redirectFixtureAPI}=require('./fixture-api.cjs');

const user={id:'22222222-2222-4222-8222-222222222228',email:'admin-menu@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01',user_metadata:{},app_metadata:{provider:'email'}};
const home='11111111-1111-4111-8111-111111111118';
const exp=Math.floor(Date.now()/1000)+86400;
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const session={access_token:[b64({alg:'HS256',typ:'JWT'}),b64({exp,sub:user.id,aud:'authenticated',session_id:home}),'fixture'].join('.'),refresh_token:'fixture',expires_in:86400,expires_at:exp,token_type:'bearer',user};
const member={user_id:user.id,display_name:'Fixture Admin',role:'owner',household_id:home};
const basePaletteKey='home-together:palette:'+user.id;
const notices=[
 {id:'notice-fixture',kind:'notice',title:'Holiday support hours',body:'Support will be back Tuesday.\nThanks for your patience.',published_at:'2026-11-26T17:00:00Z'},
 {id:'update-fixture',kind:'update',title:'New calendar features',body:'See the weekly agenda on Home.',published_at:'2026-11-25T15:00:00Z'},
];
const ratingNotice={id:'rating-notice-fixture',kind:'notice',title:'A note from HH',body:'This arrived while you were rating HH.',published_at:'2026-11-28T17:00:00Z'};
const feedbackFixtures=[
 {id:'issue-fixture',area:'Calendar',message:'The reminder time was hard to see.',created_at:'2026-11-28T17:00:00Z'},
 {id:'idea-fixture',area:'New Feature Suggestion',message:'Add a family birthday view.',created_at:'2026-11-27T17:00:00Z'},
];
const noticeImageBucket='hh-notice-images';
const imageNotices=[
 {id:'33333333-3333-4333-8333-333333333331',kind:'notice',title:'Photo-only fixture notice',body:'',
  published_at:'2026-11-28T17:00:00Z',image_path:'33333333-3333-4333-8333-333333333331/artwork.png',image_alt:'Green and gold pixels in a checkerboard.'},
 {id:'33333333-3333-4333-8333-333333333332',kind:'update',title:'Unavailable fixture image',body:'',
  published_at:'2026-11-28T16:00:00Z',image_path:'33333333-3333-4333-8333-333333333332/artwork.png',image_alt:'Archived green and gold checkerboard.'},
];
const noticePng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMwDXX5cjKV4cvJVNNQFwAqLgXhW7KSRAAAAABJRU5ErkJggg==','base64');
const noticeHistory=[
 {id:'33333333-3333-4333-8333-333333333341',kind:'update',title:'Fictional family calendar update',body:'The family calendar has a new test view.',
  release_version:'V2.1',published_at:'2026-11-27T17:00:00Z'},
 {id:'33333333-3333-4333-8333-333333333342',kind:'notice',title:'Fictional service announcement',body:'The test service is available again.',
  published_at:'2026-11-26T17:00:00Z'},
];
const festivePalettes={spring:'Spring Garden',summer:'Summer Shore',easter:'Easter',halloween:'Halloween',thanksgiving:'Thanksgiving',christmas:'Christmas'};
const seasonalPaletteIds=['spring','summer','autumn','winter','easter','halloween','thanksgiving','christmas'];

async function checkAdminBlocked(page){
 await page.getByRole('heading',{name:'Open HH to use Admin',exact:true}).waitFor();
 assert.equal(await page.locator('input[type="password"]').count(),0);
 assert.equal(await page.getByRole('heading',{name:'Pilot access',exact:true}).count(),0);
 await page.getByRole('link',{name:/Back to HH/}).waitFor();
}

async function checkMemberContent(page,setSeasons,setNotices){
 const notice=page.getByRole('dialog',{name:'Notice',exact:true});
 const update=page.getByRole('dialog',{name:'App update',exact:true});
 await notice.waitFor();
 await notice.getByText(notices[0].title,{exact:true}).waitFor();
 await notice.getByText('Support will be back Tuesday.',{exact:false}).waitFor();
 assert.equal(await update.count(),0,'Only one post opens at a time');
 if(process.env.HH_NOTICE_SAMPLE)await page.screenshot({path:process.env.HH_NOTICE_SAMPLE,animations:'disabled'});
 await page.setViewportSize({width:320,height:844});
 assert.ok(await notice.evaluate(node=>{const boxes=node.getBoundingClientRect();return boxes.left>=0&&boxes.right<=innerWidth&&node.scrollWidth<=node.clientWidth+1}));
 await page.mouse.click(1,1);
 assert.equal(await notice.isVisible(),true,'A backdrop click does not dismiss a post');
 await notice.getByRole('button',{name:'Got it',exact:true}).click();
 await update.waitFor();
 await update.getByText(notices[1].title,{exact:true}).waitFor();
 await update.getByText(notices[1].body,{exact:true}).waitFor();
 assert.equal(await notice.count(),0);

 await page.reload();
 await update.waitFor();
 assert.equal(await notice.count(),0,'Only the previously dismissed post stays hidden');
 await page.keyboard.press('Escape');
 await update.waitFor({state:'detached'});
 const today=page.getByRole('heading',{name:'Today & coming up',exact:true});
 await today.waitFor();

 const openAppearance=async()=>{
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  await page.getByRole('button',{name:/^Appearance /}).click();
 };
 await openAppearance();
 const spring=page.getByRole('button',{name:/Spring Garden/});
 const palette=name=>page.waitForFunction(id=>document.documentElement.dataset.palette===id,name);
 const refresh=()=>page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await spring.waitFor();
 assert.equal(await spring.count(),1);
 await palette('sage');
 assert.equal(await spring.getAttribute('aria-pressed'),'false');
 await spring.click();
 await palette('spring');
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),basePaletteKey),'sage');
 setSeasons([]);
 await refresh();
 await palette('sage');
 await spring.waitFor({state:'detached'});
 setSeasons(['spring']);
 await refresh();
 await spring.waitFor();
 await palette('spring');
 assert.equal(await spring.getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:/Classic Ivory/}).click();
 await palette('ivory');
 assert.equal(await page.evaluate(key=>localStorage.getItem(key+':seasonal'),basePaletteKey),null);
 await page.reload();
 await openAppearance();
 await spring.waitFor();
 await palette('ivory');
 const queued={id:'queued-notice-fixture',kind:'notice',title:'A new notice',body:'This notice arrived while Settings was open.',published_at:'2026-11-27T17:00:00Z'};
 setNotices([queued,...notices]);
 setSeasons(['spring','winter']);
 await refresh();
 await page.getByRole('button',{name:/Winter Pine/}).waitFor();
 assert.equal(await notice.count()+await update.count(),0,'New notices wait while Settings is open');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await notice.getByText(queued.title,{exact:true}).waitFor();
 await notice.getByRole('button',{name:'Got it',exact:true}).click();
 await today.waitFor();
 assert.equal(await notice.count()+await update.count(),0,'Acknowledged posts stay closed on reload');
}

async function checkMemberNoticeImages(page,storageRequests){
 await page.setViewportSize({width:320,height:650});
 const notice=page.getByRole('dialog',{name:'Notice',exact:true});
 const update=page.getByRole('dialog',{name:'App update',exact:true});
 const image=notice.getByRole('img',{name:imageNotices[0].image_alt,exact:true});
 await image.waitFor();
 assert.equal(await image.evaluate(async node=>{await node.decode();return node.naturalWidth}),2);
 const gotIt=notice.getByRole('button',{name:'Got it',exact:true});
 const imageBounds=await image.boundingBox();
 const actionBounds=await gotIt.boundingBox();
 assert.ok(imageBounds&&actionBounds&&imageBounds.y+imageBounds.height<=actionBounds.y,
  'Photo-only popups have visible artwork above the acknowledgement button');
 assert.ok(await notice.evaluate(node=>{const bounds=node.getBoundingClientRect();return bounds.left>=0&&bounds.right<=innerWidth&&node.scrollWidth<=node.clientWidth+1}));
 assert.equal(await update.count(),0);
 await gotIt.click();
 await update.getByText(imageNotices[1].image_alt,{exact:true}).waitFor();
 await update.getByText('Loading image…',{exact:true}).waitFor({state:'detached'});
 assert.equal(await update.getByRole('img').count(),0,'A storage failure has visible alternative text');
 await update.getByRole('button',{name:'Got it',exact:true}).click();
 await update.waitFor({state:'detached'});
 assert.deepEqual(storageRequests,
  imageNotices.map(item=>({method:'GET',path:`/storage/v1/object/${noticeImageBucket}/${item.image_path}`})));
 await page.reload();
 await page.getByRole('heading',{name:'Today & coming up',exact:true}).waitFor();
 const dismissed=await page.evaluate(userId=>JSON.parse(localStorage.getItem('hh-test:hh:member-notice-dismissals:'+userId)||'[]'),user.id);
 assert.deepEqual(dismissed,imageNotices.map(item=>item.id));
 assert.equal(await notice.count()+await update.count(),0,'Dismissed image notices do not reopen');
}

async function checkAdminNoticeImage(page,noticeWrites,storageRequests){
 await page.getByRole('button',{name:'Notices & updates',exact:true}).click();
 const compose=page.getByRole('region',{name:'Write a notice'});
 await compose.getByRole('combobox',{name:'Notice type'}).selectOption('update');
 const title='Fictional image-only update';
 const releaseVersion='V2.2';
 const imageAlt='Two green and gold squares.';
 const versionInput=compose.getByRole('textbox',{name:'App version',exact:true});
 assert.equal(await versionInput.inputValue(),'V2.1');
 await versionInput.fill(' v2.2 ');
 await compose.getByRole('textbox',{name:/Title/i}).fill(title);
 await compose.locator('input[type="file"]').setInputFiles({name:'fixture-notice.png',mimeType:'image/png',buffer:noticePng});
 await compose.getByRole('textbox',{name:/image description|alt text/i}).fill(imageAlt);
 await compose.getByRole('button',{name:'Preview notice',exact:true}).click();
 const preview=compose.locator('.member-notice-preview');
 const image=preview.getByRole('img',{name:imageAlt,exact:true});
 assert.equal(await image.evaluate(async node=>{await node.decode();return node.naturalWidth}),2);
 await preview.getByRole('heading',{name:`${releaseVersion} · ${title}`,exact:true}).waitFor();
 await preview.getByText('Got it',{exact:true}).waitFor();
 assert.equal(storageRequests.length,0,'Preview does not upload an image');
 assert.equal(noticeWrites.length,0,'Preview does not publish a notice');

 await compose.getByRole('button',{name:'Publish notice',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Published in HH.'}).waitFor();
 assert.equal(noticeWrites.length,1);
 assert.equal(storageRequests.length,1);
 const {payload}=noticeWrites[0];
 assert.match(payload.id,/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
 const imagePath=payload.id+'/artwork.png';
 assert.deepEqual(noticeWrites[0],{
  action:'publish_notice',
  payload:{id:payload.id,kind:'update',title,body:'',image_path:imagePath,image_alt:imageAlt,release_version:releaseVersion},
 });
 assert.deepEqual(storageRequests[0],{method:'POST',path:`/storage/v1/object/${noticeImageBucket}/${imagePath}`});
}

async function checkPaletteGroups(page){
 const done=page.getByRole('button',{name:'Done',exact:true});
 const openAppearance=async()=>{
  await page.getByRole('button',{name:'Open Settings',exact:true}).click();
  await page.getByRole('button',{name:/^Appearance /}).click();
 };
 const group=name=>page.getByRole('group',{name,exact:true});
 const names=optionGroup=>optionGroup.locator('.palette-copy b').allTextContents();
 const classic=group('Classic colours');
 const seasonal=group('Seasonal colours');
 const holiday=group('Holiday themes');
 const paletteOption=(id,optionGroup)=>optionGroup.getByRole('button',{name:new RegExp(`^${festivePalettes[id]}\\b`)});
 await openAppearance();
 await classic.waitFor();
 assert.deepEqual(await names(classic),['Blush & Gold','Sage & Linen','Coastal Blue','Lavender','Warm Sand','Classic Ivory']);
 assert.deepEqual(await names(seasonal),['Spring Garden','Summer Shore','Autumn Harvest','Winter Pine']);
 assert.deepEqual(await names(holiday),['Easter','Halloween','Thanksgiving','Christmas']);
 assert.equal(await classic.getByRole('button',{name:/^Sage & Linen/}).getAttribute('aria-pressed'),'true');

 const artwork=new Set();
 const heroColours=new Set();
 for(const [index,id] of Object.keys(festivePalettes).entries()){
  if(index)await openAppearance();
  const option=paletteOption(id,['spring','summer'].includes(id)?seasonal:holiday);
  await option.click();
  assert.equal(await option.getAttribute('aria-pressed'),'true');
  await page.waitForFunction(palette=>document.documentElement.dataset.palette===palette,id);
  await done.click();
  const illustration=page.locator(`.seasonal-decor[data-season="${id}"]`);
  await illustration.waitFor();
  assert.equal(await illustration.getAttribute('aria-hidden'),'true');
  assert.equal(await illustration.evaluate(node=>getComputedStyle(node).pointerEvents),'none');
  artwork.add(await illustration.locator('svg').innerHTML());
  const heroColour=await illustration.evaluate(node=>getComputedStyle(node.closest('.page-heading')).backgroundImage);
  assert.notEqual(heroColour,'none',`Home has a visible themed hero for ${id}`);
  heroColours.add(heroColour);
 }
 const count=Object.keys(festivePalettes).length;
 assert.equal(artwork.size,count,'Each seasonal or holiday theme has its own illustration');
 assert.equal(heroColours.size,count,'Each seasonal or holiday theme has its own hero colours');

 await openAppearance();
 await classic.getByRole('button',{name:/^Sage & Linen/}).click();
 await done.click();
 await page.waitForFunction(()=>document.documentElement.dataset.palette==='sage');
 await page.locator('.page-heading .little-house').waitFor();
 assert.equal(await page.locator('.seasonal-decor').count(),0);
}

async function checkAdminPaletteSchedule(page,paletteWrites){
 await page.setViewportSize({width:320,height:780});
 const nav=page.getByRole('navigation',{name:'Admin Dashboard'});
 await nav.waitFor();
 const active=nav.locator('button[aria-current="page"]');
 assert.equal(await nav.getByRole('button').count(),5);
 assert.equal(await active.innerText(),'Pilot access');
 await nav.getByRole('button',{name:'Seasonal palettes',exact:true}).click();
 const availability=page.getByRole('region',{name:'Theme availability'});
 await availability.waitFor();
 assert.equal(await active.innerText(),'Seasonal palettes');
 assert.equal(await active.count(),1,'Only the current dashboard section is active');
 await availability.getByRole('region',{name:'Seasonal colours'}).waitFor();
 const holidays=availability.getByRole('region',{name:'Holiday themes'});
 const christmas=holidays.locator('details[data-theme="christmas"]');
 assert.equal(await christmas.locator('.theme-card-status').getAttribute('data-state'),'off');
 await christmas.locator('summary').click();
 const schedule=christmas.getByRole('form',{name:'Christmas schedule'});
 await schedule.getByRole('checkbox',{name:'Enable theme',exact:true}).check();
 const start='2090-12-20',stop='2090-12-27';
 const startDate=schedule.getByLabel('Start date',{exact:true});
 const stopDate=schedule.getByLabel('Stop date',{exact:true});
 await startDate.fill(start);
 await stopDate.fill('2090-12-19');
 const save=schedule.getByRole('button',{name:'Save schedule',exact:true});
 await save.click();
 await page.getByRole('alert').filter({hasText:'Choose a stop date after the start date.'}).waitFor();
 assert.equal(paletteWrites.length,0,'An invalid schedule stays local');

 await stopDate.fill(stop);
 const startBounds=await startDate.boundingBox();
 const stopBounds=await stopDate.boundingBox();
 assert.ok(startBounds&&stopBounds&&stopBounds.y>=startBounds.y+startBounds.height,'Phone date fields are stacked');
 const viewport=await page.evaluate(()=>{
  const width=document.documentElement.scrollWidth;
  const overflow=width>innerWidth?[...document.querySelectorAll('body *')].filter(node=>{
   const bounds=node.getBoundingClientRect();
   return bounds.width>0&&bounds.right>innerWidth;
  }).slice(0,12).map(node=>({tag:node.tagName,style:node.getAttribute('class'),right:node.getBoundingClientRect().right})):[];
  return {width,viewport:innerWidth,overflow};
 });
 assert.ok(viewport.width<=viewport.viewport,`Dashboard and date controls fit a 320px phone: ${JSON.stringify(viewport)}`);
 await save.click();
 await page.getByRole('status').filter({hasText:'Christmas schedule saved.'}).waitFor();
 assert.deepEqual(paletteWrites,[{action:'set_palette',payload:{palette:'christmas',enabled:true,starts_on:start,stops_on:stop}}]);
 assert.equal(await christmas.locator('.theme-card-status').getAttribute('data-state'),'scheduled');
 assert.deepEqual(await christmas.locator('.theme-card-period time').evaluateAll(nodes=>nodes.map(node=>node.dateTime)),[start,stop]);
 if(process.env.HH_ADMIN_PALETTE_SAMPLE)await page.screenshot({path:process.env.HH_ADMIN_PALETTE_SAMPLE,fullPage:true,animations:'disabled'});
}

async function checkMemberNoticeHistory(page,historyRequests){
 const popup=page.getByRole('dialog',{name:'App update',exact:true});
 const title=`${noticeHistory[0].release_version} · ${noticeHistory[0].title}`;
 await popup.getByRole('heading',{name:title,exact:true}).waitFor();
 await popup.getByRole('button',{name:'Got it',exact:true}).click();
 await popup.waitFor({state:'detached'});
 assert.equal(historyRequests.length,0,'The history is loaded when requested');
 const nav=page.getByRole('navigation',{name:'Main navigation'});
 await nav.getByRole('button',{name:'More',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:/^Notices & updates/}).click();
 const history=page.getByRole('dialog',{name:'Notices & updates',exact:true});
 await history.getByText('App version on this device V2.1',{exact:true}).waitFor();
 const dismissed=history.getByText(title,{exact:true});
 await dismissed.click();
 await history.getByText(noticeHistory[0].body,{exact:true}).waitFor();
 const loadEarlier=history.getByRole('button',{name:'Load earlier posts',exact:true});
 await loadEarlier.click();
 await history.getByText(noticeHistory[1].title,{exact:true}).waitFor();
 await loadEarlier.waitFor({state:'detached'});
 assert.deepEqual(historyRequests,[
  {before_published_at:null,before_id:null},
  {before_published_at:noticeHistory[0].published_at,before_id:noticeHistory[0].id},
 ]);
 assert.equal(await dismissed.count(),1,
  'Loading earlier pages preserves already-dismissed updates in history');
}

async function checkRatingPrompt(page,state,requests,queueNotice){
 const rating=page.getByRole('dialog',{name:/HH working for you/});
 const notice=page.getByRole('dialog',{name:'Notice',exact:true});
 if(state==='rating-submit'){
  await notice.getByText(notices[0].title,{exact:true}).waitFor();
  assert.equal(await rating.count(),0,'Notices come before the rating prompt');
  await notice.getByRole('button',{name:'Got it',exact:true}).click();
 }
 await rating.waitFor();
 await page.setViewportSize({width:320,height:650});
 assert.ok(await rating.evaluate(node=>{const bounds=node.getBoundingClientRect();return bounds.left>=0&&bounds.right<=innerWidth&&node.scrollWidth<=node.clientWidth+1}));
 const send=rating.getByRole('button',{name:'Send rating',exact:true});
 const skip=rating.getByRole('button',{name:'No thanks',exact:true});
 const comment=rating.getByRole('textbox',{name:/^Comment/});
 const quote=rating.getByRole('checkbox',{name:/quote my comment/});
 assert.equal(await send.isEnabled(),false);
 assert.equal(await quote.isChecked(),false);
 assert.equal(await quote.isEnabled(),false);
 if(state==='rating-submit'){
  const first=rating.getByRole('radio',{name:'1 star',exact:true});
  const second=rating.getByRole('radio',{name:'2 stars',exact:true});
  await first.focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  assert.equal(await second.isChecked(),true,'Arrow keys can choose a rating');
  assert.equal(await send.isEnabled(),true,'A comment is optional');
  await comment.fill('  The shared calendar is clear.  ');
  assert.equal(await quote.isEnabled(),true);
  assert.equal(await quote.isChecked(),false,'Quoting requires an explicit choice');
  const refreshed=queueNotice();
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await Promise.race([refreshed,delay(10000,false,{ref:false})]),true);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await notice.count(),0,'New notices wait while a rating is in progress');
  await page.mouse.click(1,1);
  assert.equal(await rating.isVisible(),true,'The backdrop does not dismiss the rating prompt');
  await send.click();
  await rating.getByRole('alert').waitFor();
  assert.deepEqual(requests[0],{action:'submit',payload:{stars:2,comment:'The shared calendar is clear.',allow_quote:false}});
  assert.equal(await second.isChecked(),true);
  assert.equal(await comment.inputValue(),'  The shared calendar is clear.  ');
  assert.equal(await quote.isChecked(),false);
  await quote.check();
  await send.click();
  await notice.getByText(ratingNotice.title,{exact:true}).waitFor();
  assert.deepEqual(requests[1],{action:'submit',payload:{stars:2,comment:'The shared calendar is clear.',allow_quote:true}});
  await notice.getByRole('button',{name:'Got it',exact:true}).click();
 }else{
  await skip.click();
  await rating.waitFor({state:'detached'});
  assert.equal(requests.length,1);
  assert.equal(requests[0].action,'dismiss');
  assert.deepEqual(requests[0].payload??{},{});
 }
 const completedRequests=requests.length;
 await page.reload();
 await page.getByRole('button',{name:'Open Settings',exact:true}).click();
 await page.getByRole('button',{name:/^Appearance /}).click();
 await page.getByRole('button',{name:/Spring Garden/}).waitFor();
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.getByRole('heading',{name:'Today & coming up',exact:true}).waitFor();
 assert.equal(await rating.count(),0,'The same member is only prompted once');
 assert.equal(requests.length,completedRequests);
}

async function run(){
 const dist=path.resolve(process.env.HH_ADMIN_MENU_DIST||'dist');
 const server=http.createServer(async(req,res)=>{
  if(await serveFixture(req,res))return;
  const relative=new URL(req.url,'http://localhost').pathname.replace(/^\/hummel-home\//,'')||'index.html';
  const file=path.join(dist,relative);
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await launchBrowser();
  const url='http://127.0.0.1:'+server.address().port+'/hummel-home/';
  const adminUrl=new URL('admin.html',url).href;
  const allScenarios=['authorized','authorized-visit','signed-out','callback','ordinary','unavailable','signout','member-content','member-palettes','member-images','member-notice-history','admin-notice-image','admin-palette-schedule','rating-submit','rating-dismiss'];
  const scenarios=process.env.HH_ADMIN_MENU_SCENARIOS?.split(',').map(scenario=>scenario.trim())??allScenarios;
  assert.ok(scenarios.every(scenario=>allScenarios.includes(scenario)),'Unknown admin menu browser scenario');
  for(const state of scenarios){
   const approved=['authorized','authorized-visit','callback','signout','admin-notice-image','admin-palette-schedule'].includes(state);
   const ratingMember=state==='rating-submit'||state==='rating-dismiss';
   const context=await browser.newContext({viewport:{width:390,height:844}});
   const localOrigin=new URL(url).origin;
   await context.route('**/*',route=>new URL(route.request().url()).origin===localOrigin?route.continue():route.abort('blockedbyclient'));
   await context.routeWebSocket('**/*',socket=>socket.close());
   await context.addInitScript(redirectFixtureAPI);
   await context.addInitScript(({session,key,state})=>{
    if(sessionStorage.getItem('admin-menu-fixture'))return;
    if(state==='authorized-visit'){
     sessionStorage.setItem('hh-test:hh:login-choice:v1','visit');
     sessionStorage.setItem('hh-test:hh:login-visit:v1','admin-menu-visit');
     sessionStorage.setItem('hh-test:hh-test:hh:visit-auth:v1:admin-menu-visit',JSON.stringify(session));
    }else if(state!=='signed-out')localStorage.setItem('hh-test:hh-test:home-together-auth',JSON.stringify(session));
    localStorage.setItem(key,'sage');
    sessionStorage.setItem('admin-menu-fixture','1');
   },{session,key:basePaletteKey,state});
   const {promise:adminCheck,resolve:checked}=Promise.withResolvers();
   const {promise:waitToReply,resolve:reply}=Promise.withResolvers();
   let activeSeasons=state==='member-palettes'?seasonalPaletteIds:['spring','spring','unknown'];
   const initialNotices={'rating-submit':notices.slice(0,1),'rating-dismiss':[],'member-palettes':[],'member-images':imageNotices,
    'member-notice-history':noticeHistory.slice(0,1)};
   let publishedNotices=initialNotices[state]??notices;
   let ratingComplete=false;
   const ratingRequests=[];
   const ratingToggles=[];
   const feedbackFilters=[];
   const noticeWrites=[];
   const storageRequests=[];
   const paletteWrites=[];
   const historyRequests=[];
   let ratingPromptEnabled=false;
   const {promise:queuedRatingNotice,resolve:ratingNoticeRefreshed}=Promise.withResolvers();
   let accountChecks=0,roleChecks=0,dashboardChecks=0,tokenRequests=0;
   setFixtureHandler(async route=>{
    const req=route.request(),target=new URL(req.url()),name=target.pathname.split('/').pop();
    let data=[];
    if(target.pathname.startsWith('/storage/v1/')){
     const method=req.method();
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     storageRequests.push({method,path:target.pathname});
     if(method==='GET'&&state==='member-images'){
      if(target.pathname.endsWith(imageNotices[0].image_path))return route.fulfill({body:noticePng,headers:{'Content-Type':'image/png'}});
      if(target.pathname.endsWith(imageNotices[1].image_path))return route.fulfill({status:404,json:{message:'Fixture image unavailable'}});
     }
     if(method==='POST'&&state==='admin-notice-image'){
      assert.match(req.headers()['content-type'],/image\/png|multipart\/form-data/);
      return route.fulfill({json:{Key:target.pathname.slice('/storage/v1/object/'.length)}});
     }
     assert.fail('Unexpected notice image request '+target.pathname);
    }
    else if(target.pathname.startsWith('/auth/')){
     if(name==='user')accountChecks++;
     if(name==='token')tokenRequests++;
     data=user;
    }
    else if(target.pathname.includes('/functions/'))data={configured:false,connected:false,nativeReady:true};
    else if(name==='household_members')data=req.headers().accept?.includes('vnd.pgrst.object')?member:[member];
    else if(name==='households')data={id:home,name:'Fixture Home',owner_id:user.id};
    else if(name==='household_calendar_source')data='hh';
    else if(name==='household_transition_active')data=false;
    else if(name==='pilot_status')data={is_host:false};
    else if(name==='hh_member_content'){
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     const includesRatingNotice=publishedNotices.includes(ratingNotice);
     if(state==='member-content'||state==='member-palettes'||state==='member-images'||state==='member-notice-history'||ratingMember){
      data={notices:publishedNotices,seasonal_palettes:activeSeasons,rating_eligible:ratingMember&&!ratingComplete};
     }
     await route.fulfill({json:data});
     if(includesRatingNotice)ratingNoticeRefreshed(true);
     return;
    }
    else if(name==='hh_member_notice_history'){
     assert.equal(state,'member-notice-history');
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     const {before_id=null,before_published_at=null}=req.postDataJSON()??{};
     historyRequests.push({before_published_at,before_id});
     data=before_id?{notices:noticeHistory.slice(1),has_more:false}:{notices:noticeHistory.slice(0,1),has_more:true};
    }
    else if(name==='hh_member_rating'){
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     ratingRequests.push(req.postDataJSON());
     if(state==='rating-submit'&&ratingRequests.length===1)return route.fulfill({status:409,json:{message:'Fixture save failure'}});
     ratingComplete=true;
     data={completed:true};
    }
    else if(name==='hh_admin_status'){
     roleChecks++;
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     if(state==='signout'){checked(true);await waitToReply}
     await route.fulfill(state==='unavailable'?{status:404,json:{message:'Missing RPC'}}:
      {json:{is_admin:approved,requires_mfa:false}});
     checked(true);
     return;
    }
    else if(name==='hh_admin_dashboard'){
     dashboardChecks++;
     assert.ok(approved,'Ordinary and signed-out users must not request admin data');
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     assert.equal(req.postDataJSON()?.action,'snapshot');
     data={requests:[{id:'request-fixture',name:'Fixture applicant',email:'request@example.invalid',received_at:'2026-11-26T17:00:00Z',status:'preview'}],invitations:[],capacity:{used:0,total:14}};
    }
    else if(name==='hh_admin_content'){
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     const request=req.postDataJSON();
     data={notices:[],seasonal_palettes:[],palette_schedule:[]};
     if(request.action==='publish_notice'){
      assert.equal(state,'admin-notice-image');
      assert.equal(storageRequests.length,1,'The artwork must upload before publishing');
      noticeWrites.push(request);
      data.notices=[{...request.payload,published_at:'2026-11-29T17:00:00Z'}];
     }else if(request.action==='set_palette'){
      assert.equal(state,'admin-palette-schedule');
      paletteWrites.push(request);
     }else assert.equal(request.action,'snapshot');
     data.palette_schedule=paletteWrites.map(entry=>entry.payload);
    }
    else if(name==='hh_admin_ratings'){
     assert.ok(approved,'Only an authorized admin can load the ratings inbox');
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     const {action,payload}=req.postDataJSON();
     if(action==='set_enabled'){
      assert.equal(typeof payload.enabled,'boolean');
      ratingPromptEnabled=payload.enabled;
      ratingToggles.push(ratingPromptEnabled);
     }else assert.equal(action,'snapshot');
     data={enabled:ratingPromptEnabled,ratings:[],has_more:false};
    }
    else if(name==='hh_admin_feedback'){
     assert.ok(approved,'Only an authorized admin can load the feedback inbox');
     assert.equal(req.headers().authorization,'Bearer '+session.access_token);
     const {kind}=req.postDataJSON();
     feedbackFilters.push(kind);
     const submissions=kind==='all'?feedbackFixtures:feedbackFixtures.filter(item=>(item.area==='New Feature Suggestion')===(kind==='ideas'));
     data={submissions,has_more:false};
    }
    await route.fulfill({json:data});
   });
   try{
    const page=await context.newPage();
    page.setDefaultTimeout(10000);
    if(state==='signed-out'||state==='callback'){
     const entries=state==='callback'?[`${adminUrl}?code=synthetic-callback`,`${adminUrl}#access_token=synthetic-callback&type=recovery`]:[adminUrl];
     for(const entry of entries){await page.goto(entry);await checkAdminBlocked(page)}
     assert.equal(accountChecks,0);
     assert.equal(roleChecks,0);
     assert.equal(dashboardChecks,0);
     assert.equal(tokenRequests,0);
     continue;
    }
    await page.goto(url);
    if(state==='member-content'){
     await checkMemberContent(page,seasons=>{activeSeasons=seasons},entries=>{publishedNotices=entries});
     continue;
    }
    if(state==='member-palettes'){
     await checkPaletteGroups(page);
     continue;
    }
    if(state==='member-images'){
     await checkMemberNoticeImages(page,storageRequests);
     continue;
    }
    if(state==='member-notice-history'){
     await checkMemberNoticeHistory(page,historyRequests);
     continue;
    }
    if(ratingMember){
     await checkRatingPrompt(page,state,ratingRequests,()=>{publishedNotices=[ratingNotice,...publishedNotices];return queuedRatingNotice});
     continue;
    }
    await page.getByRole('button',{name:'Open Settings',exact:true}).click();
    assert.equal(await Promise.race([adminCheck,delay(10000,false,{ref:false})]),true,`Admin status fixture was not reached for ${state}`);
    const link=page.getByRole('link',{name:/Admin Dashboard/});
    if(state==='signout'){
     await page.getByRole('button',{name:'Sign out',exact:true}).click();
     await page.getByRole('heading',{name:'Welcome home.'}).waitFor();
     reply();
     assert.equal(await link.count(),0);
     await page.goto(adminUrl);
     await checkAdminBlocked(page);
     assert.equal(dashboardChecks,0);
    }else{
     if(approved){
      await link.waitFor();
      assert.equal(await link.getAttribute('href'),'./admin.html');
      assert.equal(await link.getAttribute('target'),null,'TEST Admin keeps the current tab’s HH sign-in');
      const priorAccountChecks=accountChecks;
      await link.click();
      await page.waitForURL(adminUrl);
      await page.getByRole('heading',{name:'Pilot access',exact:true}).waitFor();
      await page.getByText('Fixture applicant',{exact:true}).waitFor();
      assert.ok(accountChecks>priorAccountChecks,'Dashboard verifies the shared user with Auth');
      assert.ok(dashboardChecks>0);
      assert.equal(await page.locator('input[type="password"]').count(),0);
      assert.equal(context.pages().length,1);
      if(state==='authorized-visit')assert.equal(await page.evaluate(()=>localStorage.getItem('hh-test:hh-test:home-together-auth')),null);
      if(state==='admin-notice-image')await checkAdminNoticeImage(page,noticeWrites,storageRequests);
      if(state==='admin-palette-schedule')await checkAdminPaletteSchedule(page,paletteWrites);
      if(state==='authorized'){
       await page.getByRole('button',{name:'App ratings',exact:true}).click();
       const ratingsSwitch=checked=>page.getByRole('switch',{name:'Show the rating pop-up',checked});
       await ratingsSwitch(false).click();
       await ratingsSwitch(true).click();
       await ratingsSwitch(false).waitFor();
       assert.deepEqual(ratingToggles,[true,false]);
       await page.getByRole('button',{name:'Feedback & ideas',exact:true}).click();
       const issue=page.getByText(feedbackFixtures[0].message,{exact:true});
       const idea=page.getByText(feedbackFixtures[1].message,{exact:true});
       await issue.waitFor();
       await idea.waitFor();
       await page.getByRole('button',{name:'Ideas',exact:true}).click();
       await issue.waitFor({state:'detached'});
       await idea.waitFor();
       await page.getByRole('button',{name:'Feedback',exact:true}).click();
       await idea.waitFor({state:'detached'});
       await issue.waitFor();
       assert.deepEqual(feedbackFilters,['all','ideas','feedback']);
      }
     }else{
      assert.equal(await link.count(),0,state);
      await page.goto(adminUrl);
      await checkAdminBlocked(page);
      assert.equal(dashboardChecks,0);
      await page.getByRole('link',{name:/Back to HH/}).click();
      await page.getByRole('heading',{name:'Today & coming up',exact:true}).waitFor();
     }
    }
    assert.equal(tokenRequests,0);
   }finally{reply();await context.close()}
  }
 }finally{if(browser)await browser.close();server.close()}
}

run().then(()=>console.log('Admin menu checks passed: '+(process.env.HH_ADMIN_MENU_SCENARIOS||'TEST sign-in reuse, direct-entry denial, late sign-out, notices with optional images, seasonal palettes and one-time ratings.'))).catch(error=>{console.error(error);process.exitCode=1});
