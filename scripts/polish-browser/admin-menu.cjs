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

async function checkAdminBlocked(page){
 await page.getByRole('heading',{name:'Open HH to use Admin',exact:true}).waitFor();
 assert.equal(await page.locator('input[type="password"]').count(),0);
 assert.equal(await page.getByRole('heading',{name:'Pilot access',exact:true}).count(),0);
 await page.getByRole('link',{name:/Back to HH/}).waitFor();
}

async function checkMemberContent(page,setSeasons){
 await page.getByRole('heading',{name:'Today & coming up',exact:true}).waitFor();
 const panel=page.getByRole('region',{name:'Notices and updates from HH'});
 const notice=panel.getByText(notices[0].title,{exact:true});
 const update=panel.getByText(notices[1].title,{exact:true});
 await notice.waitFor();
 await update.waitFor();
 const body=panel.getByText('Support will be back Tuesday.',{exact:false});
 assert.equal(await body.isVisible(),false);
 await notice.click();
 await body.waitFor();
 assert.equal(await panel.locator('time:visible').getAttribute('datetime'),notices[0].published_at);
 await page.setViewportSize({width:320,height:844});
 assert.ok(await panel.evaluate(node=>node.getBoundingClientRect().right<=innerWidth));
 await panel.getByRole('button',{name:`Dismiss ${notices[0].title}`}).click();
 assert.equal(await notice.count(),0);
 await update.waitFor();
 await page.reload();
 await update.waitFor();
 assert.equal(await notice.count(),0);

 await page.getByRole('button',{name:'Open Settings',exact:true}).click();
 await page.getByRole('button',{name:/^Appearance /}).click();
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
 await update.waitFor();
 await palette('ivory');
}

async function run(){
 const dist=path.resolve(process.env.HH_ADMIN_MENU_DIST||'dist');
 const server=http.createServer(async(req,res)=>{
  if(await serveFixture(req,res))return;
  const relative=new URL(req.url,'http://localhost').pathname.replace(/^\/hummel-home\//,'')||'index.html';
  const file=path.join(dist,relative);
  if(!file.startsWith(dist+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
  res.end(fs.readFileSync(file));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await launchBrowser();
  const url='http://127.0.0.1:'+server.address().port+'/hummel-home/';
  const adminUrl=new URL('admin.html',url).href;
  for(const state of ['authorized','authorized-visit','signed-out','callback','ordinary','unavailable','signout','member-content']){
   const approved=['authorized','authorized-visit','callback','signout'].includes(state);
   const context=await browser.newContext({viewport:{width:390,height:844}});
   await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort('blockedbyclient'));
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
   let activeSeasons=['spring','spring','unknown'];
   let accountChecks=0,roleChecks=0,dashboardChecks=0,tokenRequests=0;
   setFixtureHandler(async route=>{
    const req=route.request(),target=new URL(req.url()),name=target.pathname.split('/').pop();
    let data=[];
    if(target.pathname.startsWith('/auth/')){
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
     if(state==='member-content')data={notices,seasonal_palettes:activeSeasons};
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
    else if(name==='hh_admin_content')data={notices:[],seasonal_palettes:[]};
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
     await checkMemberContent(page,seasons=>{activeSeasons=seasons});
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

run().then(()=>console.log('Admin menu and member content checks passed: TEST sign-in reuse, direct-entry denial, late sign-out, notices and optional seasonal palettes.')).catch(error=>{console.error(error);process.exitCode=1});
