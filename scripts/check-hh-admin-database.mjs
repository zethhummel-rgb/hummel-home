import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const {PGlite}=await import(process.env.HH_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const uid=(n)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const value=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const roles={host:uid(1),admin:uid(2),owner:uid(3),invitee:uid(4),otherHost:uid(5),secondAdmin:uid(6),unapprovedAlias:uid(7)};
const addresses={host:'originalhomeapp',admin:'account-owner',secondAdmin:'updatedhomeapp',unapprovedAlias:'updatedhomeapp+extra'};
const email=(role)=>(addresses[role]||role.toLowerCase())+'@hh-qa.invalid';
const as=async(role,aal='aal1')=>{
 await db.exec('reset role;set role authenticated;');
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:roles[role],aal})]);
};
const asService=async()=>db.exec('reset role;set role service_role;');
const status=()=>value('select public.hh_admin_status()');
const dashboard=(action,payload={})=>value('select public.hh_admin_dashboard($1,$2)',[action,payload]);
const content=(action,payload={})=>value('select public.hh_admin_content($1,$2)',[action,payload]);
const memberContent=()=>value('select public.hh_member_content()');
const mail=(action,payload)=>value('select public.invitation_mail_service($1,$2)',[action,payload]);
const request=(action,payload)=>value('select public.pilot_request_mail_service($1,$2)',[action,payload]);

try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;grant usage on schema auth to authenticated;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
  create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
  create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  grant execute on function auth.uid(),auth.jwt() to authenticated;`);
 for(const name of ['schema','calendar','member-colours','pilot','pilot-seven-spots','pilot-fourteen-spots','invitation-email']){
  await db.exec(read(`database/${name}.sql`));
 }
 for(const name of ['20261110151437_hh_one_email_invitations','20261112181000_hh_pilot_request_mail','20261126210000_hh_site_admin_dashboard','20261126213000_hh_admin_content','20261126220000_hh_admin_auth_policy']){
  await db.exec(read(`supabase/migrations/${name}.sql`));
 }
 for(const [role,id] of Object.entries(roles))await db.query('insert into auth.users values($1,$2,now())',[id,email(role)]);
 for(const role of ['host','otherHost'])await db.query('insert into private.pilot_hosts values($1)',[email(role)]);

 await as('host');
 const hostHome=await value("select public.create_household('Test Home','Test Home Owner')");
 const before=(await value("select public.pilot_invitations('create',$1)",[email('owner')])).token;
 const hostFamilyInvite=await value("select public.create_household_invite('household-member@hh-qa.invalid')");
 assert.deepEqual(await status(),{is_admin:false,requires_mfa:false});
 await as('admin','aal2');
 assert.deepEqual(await status(),{is_admin:false,requires_mfa:false});
 await assert.rejects(dashboard('snapshot'),/Admin access required/);
 await db.exec('reset role;');
 for(const role of ['host','admin','secondAdmin']){
  await db.query('insert into private.hh_site_admins(user_id,verified_email,pilot_host_user_id) values($1,$2,$3)',[roles[role],email(role),roles.host]);
 }

 await as('host');
 assert.equal(await value('select id from public.households'),hostHome);
 assert.equal((await value('select public.pilot_status()')).is_host,true);
 assert.equal((await value("select public.pilot_invitations('list')")).length,1);
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:true});
 await assert.rejects(dashboard('snapshot'),/Verify your second factor/);
 await as('host','aal2');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:false});
 assert.deepEqual((await dashboard('snapshot')).capacity,{used:1,total:14});
 await as('secondAdmin','aal2');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:false});
 assert.equal(await value('select count(*)::int from public.household_members'),0);
 assert.deepEqual((await dashboard('snapshot')).capacity,{used:1,total:14});
 await as('unapprovedAlias','aal2');
 assert.deepEqual(await status(),{is_admin:false,requires_mfa:false});
 await assert.rejects(dashboard('snapshot'),/Admin access required/);
 await assert.rejects(dashboard('create_invite',{email:email('invitee')}),/Admin access required/);

 await as('admin');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:true});
 await assert.rejects(dashboard('snapshot'),/Verify your second factor/);
 await assert.rejects(dashboard('create_invite',{email:email('invitee')}),/Verify your second factor/);
 await as('admin','aal2');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:false});
 assert.equal(await value('select count(*)::int from public.household_members'),0);
 assert.equal((await value('select public.pilot_status()')).is_host,false);
 await assert.rejects(value("select public.create_household('Unauthorized','Admin')"),/invitation-only/);
 await assert.rejects(value('select * from private.hh_site_admins'),/permission denied/);
 await assert.rejects(value('select * from private.hh_pilot_join_requests'),/permission denied/);
 await assert.rejects(value('select private.hh_site_admin_issuer($1)',[roles.host]),/permission denied/);
 await assert.rejects(request('claim',{}),/permission denied/);
 await assert.rejects(mail('claim',{actorId:roles.admin,siteAdmin:true}),/permission denied/);
 assert.deepEqual((await dashboard('snapshot')).capacity,{used:1,total:14});
 await assert.rejects(dashboard('create_invite',{email:'broken@somewhere'}),/Enter a valid email address/);
 await assert.rejects(dashboard('create_invite',{email:email('owner')}),/already has a pilot invitation/);
 const {token}=await dashboard('create_invite',{email:' INVITEE@HH-QA.INVALID '});
 assert.match(token,/^[a-f0-9]{64}$/);
 const invitation=(await dashboard('snapshot')).invitations.find(row=>row.email===email('invitee'));
 assert.ok(invitation.created_at);
 assert.ok(invitation.expires_at);
 assert.equal(invitation.used_at,null);
 assert.equal(invitation.delivery_status,null);
 assert.equal('token_hash' in invitation,false);
 assert.equal(JSON.stringify(invitation).includes(token),false);

 await asService();
 assert.equal((await value("select public.invitation_registration('pilot',$1)",[before])).email,email('owner'));
 assert.equal((await value("select public.invitation_registration('pilot',$1)",[token])).email,email('invitee'));
 await assert.rejects(mail('claim',{actorId:roles.admin,kind:'pilot',token}),/unavailable/);
 await assert.rejects(mail('claim',{actorId:roles.otherHost,kind:'pilot',token,siteAdmin:true}),/unavailable/);
 await assert.rejects(mail('claim',{actorId:roles.admin,kind:'family',token:hostFamilyInvite,siteAdmin:true}),/unavailable/);
 const claim=await mail('claim',{actorId:roles.admin,kind:'pilot',token,siteAdmin:true});
 assert.equal(claim.status,'claimed');
 assert.equal(claim.email,email('invitee'));
 assert.equal((await mail('claim',{actorId:roles.host,kind:'pilot',token})).status,'sending');
 assert.equal((await mail('finish',{actorId:roles.admin,siteAdmin:true,claimId:claim.claimId,status:'sent'})).updated,true);
 assert.equal((await mail('claim',{actorId:roles.host,kind:'pilot',token})).status,'sent');
 const familyClaim=await mail('claim',{actorId:roles.host,kind:'family',token:hostFamilyInvite});
 assert.equal(familyClaim.status,'claimed');
 assert.equal((await mail('finish',{actorId:roles.admin,siteAdmin:true,claimId:familyClaim.claimId,status:'sent'})).updated,false);
 assert.equal((await mail('finish',{actorId:roles.host,claimId:familyClaim.claimId,status:'sent'})).updated,true);

 const answers={name:'Fictional Pilot',email:email('invitee'),heardFrom:'Community group',pilotInterest:'yes',message:'Can we join?\nThanks!'};
 const submission={id:uid(10),answers,emailHash:sha(answers.email),contentHash:sha(JSON.stringify(answers))};
 await assert.rejects(request('claim',{...submission,emailHash:sha('different email')}),/Invalid invitation request/);
 await assert.rejects(request('claim',{...submission,answers:{...answers,message:42}}),/Invalid invitation request/);
 assert.equal(await request('claim',submission),'claimed');
 assert.equal(await request('claim',submission),'sending');
 assert.equal(await request('claim',{...submission,contentHash:sha('changed')}),'mismatch');
 assert.equal(await request('finish',{id:submission.id,status:'sent'}),'finished');
 assert.equal(await request('claim',submission),'sent');
 const preview={...submission,id:uid(11),preview:true};
 assert.equal(await request('claim',preview),'preview');
 assert.equal(await request('claim',preview),'preview');
 assert.equal(await request('finish',{id:preview.id,status:'sent'}),'finished');
 assert.equal(await request('claim',preview),'preview');
 const oldRequest={id:uid(12),emailHash:submission.emailHash,contentHash:sha('legacy')};
 assert.equal(await request('claim',oldRequest),'claimed');
 assert.equal(await request('claim',{...submission,id:uid(13)}),'limited');

 await as('owner');
 const oldTokenHome=await value("select public.create_pilot_household($1,'Legacy Invite Home','Owner')",[before]);
 assert.notEqual(hostHome,oldTokenHome);
 assert.deepEqual(await status(),{is_admin:false,requires_mfa:false});
 await assert.rejects(dashboard('snapshot'),/Admin access required/);
 await as('invitee');
 assert.ok(await value("select public.create_pilot_household($1,'Dashboard Invite Home','Invitee')",[token]));
 await assert.rejects(value("select public.create_pilot_household($1,'Replay','Invitee')",[token]));

 const memo={id:uid(20),kind:'notice',title:' Community notice ',body:'Next weekend\nBring your calendar. '};
 const release={id:uid(21),kind:'update',title:'What’s new',body:'New colors are available.'};
 const emptyContent={notices:[],seasonal_palettes:[]};
 assert.deepEqual(await memberContent(),emptyContent);
 await assert.rejects(content('publish_notice',memo),/Admin access required/);
 await assert.rejects(value('select * from private.hh_app_notices'),/permission denied/);
 await assert.rejects(value('select * from private.hh_seasonal_palettes'),/permission denied/);
 await assert.rejects(value('select private.hh_content_snapshot(true)'),/permission denied/);
 await as('host');
 assert.deepEqual(await memberContent(),emptyContent);
 await assert.rejects(content('publish_notice',memo),/Verify your second factor/);
 await assert.rejects(content('set_palette',{palette:'spring',enabled:true}),/Verify your second factor/);
 await as('admin','aal2');
 await assert.rejects(memberContent(),/Confirmed household membership required/);
 assert.deepEqual(await content('snapshot'),emptyContent);
 await assert.rejects(content('publish_notice',{...memo,id:'broken'}),/Choose a valid notice/);
 await assert.rejects(content('publish_notice',{...memo,kind:'email'}),/Choose notice or update/);
 await assert.rejects(content('publish_notice',{...memo,title:'a'.repeat(101)}),/Enter a title/);
 await assert.rejects(content('publish_notice',{...memo,body:'\n\t  \r\n'}),/Enter a message/);
 await assert.rejects(content('publish_notice',{...memo,body:'a'.repeat(2001)}),/Enter a message/);
 await assert.rejects(content('set_palette',{palette:'blush',enabled:true}),/Choose a seasonal palette/);
 await assert.rejects(content('set_palette',{palette:'spring',enabled:'true'}),/Choose a seasonal palette/);
 const initialNotice=(await content('publish_notice',memo)).notices[0];
 assert.deepEqual(Object.keys(initialNotice).sort(),['archived_at','body','id','kind','published_at','title']);
 assert.equal(initialNotice.title,'Community notice');
 assert.equal(initialNotice.body,'Next weekend\nBring your calendar.');
 assert.equal(initialNotice.archived_at,null);
 assert.deepEqual((await content('publish_notice',memo)).notices,[initialNotice]);
 await assert.rejects(content('publish_notice',{...memo,title:'Different'}),/already published with different content/);
 assert.equal((await content('publish_notice',release)).notices.length,2);
 assert.deepEqual((await content('set_palette',{palette:'winter',enabled:true})).seasonal_palettes,['winter']);
 assert.deepEqual((await content('set_palette',{palette:'spring',enabled:true})).seasonal_palettes,['spring','winter']);
 assert.deepEqual((await content('set_palette',{palette:'spring',enabled:true})).seasonal_palettes,['spring','winter']);

 await as('owner');
 const ownerContent=await memberContent();
 assert.deepEqual(ownerContent.seasonal_palettes,['spring','winter']);
 assert.deepEqual(ownerContent.notices.map(row=>row.kind).sort(),['notice','update']);
 assert.deepEqual(Object.keys(ownerContent.notices[0]).sort(),['body','id','kind','published_at','title']);
 await assert.rejects(content('snapshot'),/Admin access required/);
 await as('invitee');
 assert.deepEqual(await memberContent(),ownerContent);
 await as('host','aal2');
 const archived=(await content('archive_notice',{id:memo.id})).notices.find(row=>row.id===memo.id);
 assert.ok(archived.archived_at);
 assert.deepEqual((await content('archive_notice',{id:memo.id})).notices.find(row=>row.id===memo.id),archived);
 assert.deepEqual((await content('publish_notice',memo)).notices.find(row=>row.id===memo.id),archived);
 await assert.rejects(content('archive_notice',{id:uid(22)}),/Notice no longer exists/);
 await as('secondAdmin','aal2');
 assert.deepEqual((await content('set_palette',{palette:'winter',enabled:false})).seasonal_palettes,['spring']);
 await as('owner');
 assert.deepEqual((await memberContent()).notices.map(row=>row.id),[release.id]);
 assert.deepEqual((await memberContent()).seasonal_palettes,['spring']);
 await as('unapprovedAlias','aal2');
 await assert.rejects(memberContent(),/Confirmed household membership required/);
 await assert.rejects(content('archive_notice',{id:release.id}),/Admin access required/);
 await db.exec('reset role;');
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[roles.owner]);
 await as('owner');
 await assert.rejects(memberContent(),/Confirmed household membership required/);
 await db.exec('reset role;');
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[roles.owner]);

 await as('admin','aal2');
 const snapshot=await dashboard('snapshot');
 assert.deepEqual(snapshot.capacity,{used:2,total:14});
 assert.equal(snapshot.requests.length,2);
 const saved=snapshot.requests.find(row=>row.id===submission.id);
 assert.deepEqual(Object.keys(saved).sort(),['email','heard_from','id','message','name','pilot_interest','received_at','status']);
 assert.equal(saved.name,answers.name);
 assert.equal(saved.email,answers.email);
 assert.equal(saved.heard_from,answers.heardFrom);
 assert.equal(saved.pilot_interest,answers.pilotInterest);
 assert.equal(saved.message,answers.message);
 assert.equal(saved.status,'sent');
 assert.equal(snapshot.requests.find(row=>row.id===preview.id).status,'preview');
 assert.equal(snapshot.invitations.find(row=>row.id===invitation.id).delivery_status,'sent');
 assert.ok(snapshot.invitations.find(row=>row.id===invitation.id).used_at);

 // Each entry point observes the same cap and does not issue a duplicate invite.
 await as('host');
 for(let n=3;n<=13;n++)await value('select public.pilot_invitations($1,$2)',['create',`household-${n}@hh-qa.invalid`]);
 await as('secondAdmin','aal2');
 await dashboard('create_invite',{email:'fourteenth@hh-qa.invalid'});
 await assert.rejects(dashboard('create_invite',{email:'overflow@hh-qa.invalid'}),/fourteen invited households/);
 await as('host');
 await assert.rejects(value("select public.pilot_invitations('create','overflow@hh-qa.invalid')"),/fourteen invited households/);
 assert.equal((await value("select public.pilot_invitations('list')")).length,14);
 await as('otherHost','aal2');
 await assert.rejects(dashboard('snapshot'),/Admin access required/);
 await db.exec('reset role;set role anon;');
 await assert.rejects(status(),/permission denied/);
 await assert.rejects(dashboard('snapshot'),/permission denied/);
 await assert.rejects(content('snapshot'),/permission denied/);
 await assert.rejects(memberContent(),/permission denied/);

 await db.exec('reset role;');
 await db.query("update private.pilot_request_delivery set created_at=now()-interval '8 days' where id in ($1,$2)",[submission.id,preview.id]);
 await asService();
 assert.equal(await request('claim',submission),'sent');
 assert.equal(await request('claim',preview),'preview');
 await db.exec('reset role;');
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[roles.admin]);
 await as('admin','aal2');
 assert.equal((await status()).is_admin,false);
 await assert.rejects(dashboard('snapshot'),/Admin access required/);
 await db.exec('reset role;');
 await db.query("update auth.users set email_confirmed_at=now(),email='changed@hh-qa.invalid' where id=$1",[roles.admin]);
 await as('admin','aal2');
 assert.equal((await status()).is_admin,false);
 await assert.rejects(dashboard('create_invite',{email:email('invitee')}),/Admin access required/);

 // Release defaults require MFA. Only a separate project-owner action opts TEST out.
 await as('secondAdmin');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:true});
 await assert.rejects(dashboard('snapshot'),/Verify your second factor/);
 await assert.rejects(content('snapshot'),/Verify your second factor/);
 await assert.rejects(db.exec('update private.hh_admin_auth_policy set require_mfa=false'),/permission denied/);
 await assert.rejects(value('select private.hh_admin_needs_second_factor()'),/permission denied/);
 await as('host');
 const lastInvite=(await value("select public.pilot_invitations('list')")).find(row=>row.email==='fourteenth@hh-qa.invalid');
 await value("select public.pilot_invitations('revoke',null,$1)",[lastInvite.id]);
 await db.exec('reset role;update private.hh_admin_auth_policy set require_mfa=false where id=true;');
 await as('secondAdmin');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:false});
 assert.equal((await dashboard('snapshot')).capacity.used,13);
 assert.match((await dashboard('create_invite',{email:'test-mfa-policy@hh-qa.invalid'})).token,/^[a-f0-9]{64}$/);
 assert.deepEqual((await content('set_palette',{palette:'summer',enabled:true})).seasonal_palettes,['spring','summer']);
 for(const role of ['admin','owner','unapprovedAlias']){
  await as(role);
  assert.deepEqual(await status(),{is_admin:false,requires_mfa:false});
  await assert.rejects(dashboard('snapshot'),/Admin access required/);
  await assert.rejects(content('snapshot'),/Admin access required/);
 }
 await db.exec('reset role;delete from private.hh_admin_auth_policy;');
 await as('secondAdmin');
 assert.deepEqual(await status(),{is_admin:true,requires_mfa:true});
 await assert.rejects(dashboard('snapshot'),/Verify your second factor/);
 await assert.rejects(content('snapshot'),/Verify your second factor/);
 console.log('HH admin policy checks passed: MFA required by default and on missing settings, explicit TEST opt-out, private setting, and exact identity authorization.');
 console.log('HH admin database checks passed: exact identity grants, existing host access and separate MFA, shared pilot seats and mail claims, old and new invitation redemption, atomic request capture, preview, deduplication and expiry.');
 console.log('HH content checks passed: confirmed household-reader scope, explicit admin publication, idempotent retries, archives, seasonal availability, and restricted database grants.');
}finally{
 await db.close();
}
