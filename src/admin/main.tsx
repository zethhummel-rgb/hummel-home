import {lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowUpRight, Bell, LogOut, MessageSquare, PackageCheck, Palette, Star, Ticket} from 'lucide-react';
import {testEnvironment} from '../config';
import {appReleaseVersion} from '../releaseVersion';
import {
  createPilotInvitation, familyAppUrl, getAdminStatus, getDashboard,
  pilotInvitationUrl, sendPilotInvitation, standaloneAdminClient,
  type AdminClient, type DashboardSnapshot, type GetAdminClient, type PilotInvitation,
} from './api';
import ContentPanel from './ContentPanel';
import Inbox from './Inbox';
import './styles.css';

const logo = new URL('./icons/hh-192.png', familyAppUrl).href;
const SharedSession = lazy(() => import('./SharedSession'));
const ReleasePanel = lazy(() => import('./ReleasePanel'));
type Gate = 'loading' | 'sign-in' | 'verify' | 'ready';
type Factor = {id: string; type: 'totp' | 'phone'; qr?: string; secret?: string};
type Receipt = {email: string; token: string; delivery: 'sending' | 'sent' | 'unconfirmed' | 'preview'};

function StandaloneAdmin() {
  const adminClient = standaloneAdminClient();
  const [gate, setGate] = useState<Gate>('loading');
  const [notice, setNotice] = useState('');

  async function openSession() {
    const status = await getAdminStatus(adminClient);
    if (!status.is_admin) {
      await adminClient.auth.signOut({scope: 'local'});
      setGate('sign-in');
      setNotice('This account does not have HH Admin access.');
      return;
    }
    setGate(status.requires_mfa ? 'verify' : 'ready');
  }

  useEffect(() => {
    const {data: {subscription}} = adminClient.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setGate('sign-in');
    });
    async function restoreSession() {
      try {
        const {data, error} = await adminClient.auth.getSession();
        if (error) throw error;
        if (data.session) await openSession();
        else setGate('sign-in');
      } catch {
        setNotice('Admin access could not be checked. Sign in again to retry.');
        setGate('sign-in');
      }
    }
    void restoreSession();
    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const {error} = await adminClient.auth.signOut({scope: 'local'});
    if (error) throw Error('Sign-out could not be completed. Try again.');
    setNotice('');
    setGate('sign-in');
  }

  return <>
    {gate === 'ready' && <AdminWorkspace getClient={async () => adminClient} signOut={signOut} />}
    {gate === 'verify' && <VerifyAdmin client={adminClient} onVerified={openSession} signOut={signOut} />}
    {gate === 'sign-in' && <SignIn client={adminClient} onSignedIn={openSession} notice={notice} clearNotice={() => setNotice('')} />}
    {gate === 'loading' && <CheckingAccess />}
  </>;
}

function CheckingAccess() {
  return <main className="auth-card"><p role="status">Checking admin access…</p></main>;
}

function HHAdmin() {
  return <>
    <header className="masthead">
      <div className="shell masthead-inner">
        <div className="brand"><img src={logo} alt="" width="35" height="35" /><span>HH Admin</span></div>
        {testEnvironment && <span className="environment">TEST</span>}
        <span className="admin-version" aria-label={`App version ${appReleaseVersion}`}>{appReleaseVersion}</span>
        <a className="home-link" href={familyAppUrl.href}>Open HH <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </header>
    {testEnvironment ? <Suspense fallback={<CheckingAccess />}>
      <SharedSession>{({userId, getClient}) => <AdminWorkspace key={userId} getClient={getClient} />}</SharedSession>
    </Suspense> : <StandaloneAdmin />}
  </>;
}

function AuthCard({title, children}: {title: string; children: ReactNode}) {
  return <main className="auth-card"><h1>{title}</h1>{children}</main>;
}

function SignIn({client, onSignedIn, notice, clearNotice}: {client: AdminClient; onSignedIn: () => Promise<void>; notice: string; clearNotice: () => void}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearNotice();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const {error} = await client.auth.signInWithPassword({
        email: String(form.get('email')).trim().toLowerCase(),
        password: String(form.get('password')),
      });
      if (error) throw Error('Could not sign in. Check your email and password.');
      await onSignedIn();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  }
  return <AuthCard title="Admin sign in">
    <p>Manage pilot requests and invitations for HH Family.</p>
    <form onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="username" autoCapitalize="none" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {(error || notice) && <p className="message error" role="alert">{error || notice}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </AuthCard>;
}

function VerifyAdmin({client, onVerified, signOut}: {client: AdminClient; onVerified: () => Promise<void>; signOut: () => Promise<void>}) {
  const [factor, setFactor] = useState<Factor>();
  const [factorsLoaded, setFactorsLoaded] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadFactors() {
    setError('');
    const {data, error} = await client.auth.mfa.listFactors();
    if (error) {
      setError('Your verification methods could not be loaded. Try again.');
      return;
    }
    const existing = data.totp[0] ?? data.phone?.[0];
    if (existing) setFactor({id: existing.id, type: existing.factor_type});
    setFactorsLoaded(true);
  }

  useEffect(() => {void loadFactors();}, []);

  async function setUp() {
    setBusy(true);
    setError('');
    try {
      const {data, error} = await client.auth.mfa.enroll({factorType: 'totp', issuer: 'HH Admin'});
      if (error) throw error;
      setFactor({id: data.id, type: 'totp', qr: data.totp.qr_code, secret: data.totp.secret});
    } catch {
      setError('Authenticator setup could not be started. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function textCode() {
    if (!factor) return;
    setError('');
    setBusy(true);
    try {
      const {data, error} = await client.auth.mfa.challenge({factorId: factor.id});
      if (error) throw error;
      setChallengeId(data.id);
    } catch {
      setError('A verification code could not be sent. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factor) return;
    setError('');
    setBusy(true);
    const code = String(new FormData(event.currentTarget).get('code')).trim();
    try {
      const result = factor.type === 'phone'
        ? await client.auth.mfa.verify({factorId: factor.id, challengeId, code})
        : await client.auth.mfa.challengeAndVerify({factorId: factor.id, code});
      if (result.error) throw Error('That code could not be verified. Try a fresh code.');
      await onVerified();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Verification could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return <AuthCard title="Verify your sign-in">
    {!factorsLoaded && !error && <p role="status">Loading verification methods…</p>}
    {!factorsLoaded && error && <button type="button" onClick={() => void loadFactors()}>Retry</button>}
    {factorsLoaded && !factor && <>
      <p>Set up an authenticator app to protect your admin account.</p>
      <button type="button" className="primary" disabled={busy} onClick={() => void setUp()}>Set up authenticator</button>
    </>}
    {factor?.qr && <>
      <p>Scan this code with your authenticator app. Then enter the six-digit code it shows.</p>
      <img className="qr" alt="Authenticator setup code" width="180" height="180" src={
        factor.qr.startsWith('data:image/svg+xml;utf-8,')
          ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(factor.qr.slice('data:image/svg+xml;utf-8,'.length))}`
          : factor.qr.startsWith('data:image/svg+xml,') ? factor.qr : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(factor.qr)}`
      } />
      <details><summary>Enter the setup key manually</summary><code>{factor.secret}</code></details>
    </>}
    {factor && !factor.qr && <p>{factor.type === 'phone' ? 'Request a code from your saved verification phone.' : 'Enter the six-digit code from your authenticator app.'}</p>}
    {factor?.type === 'phone' && <button type="button" disabled={busy} onClick={() => void textCode()}>{challengeId ? 'Send another code' : 'Text a code'}</button>}
    {factor && (factor.type === 'totp' || challengeId) && <form onSubmit={verify}>
      <label>Verification code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required /></label>
      <button className="primary" disabled={busy}>Verify</button>
    </form>}
    {error && <p className="message error" role="alert">{error}</p>}
    <button type="button" className="text-button sign-out-link" disabled={busy} onClick={() => void signOut().catch((error: Error) => setError(error.message))}>Sign out</button>
  </AuthCard>;
}

const formatDate = new Intl.DateTimeFormat('en-CA', {dateStyle: 'medium', timeStyle: 'short'});
const showDate = (value: string) => formatDate.format(new Date(value));
type InviteStatus = 'Pending' | 'Accepted' | 'Expired';
type RequestStatus = InviteStatus | 'New';
const requestFilters = ['All', 'Needs invitation', 'Pending', 'Accepted'] as const;
const needsInvitation = (status: RequestStatus) => status === 'New' || status === 'Expired';
function invitationStatus(invite: PilotInvitation): InviteStatus {
  if (invite.used_at) return 'Accepted';
  return Date.parse(invite.expires_at) > Date.now() ? 'Pending' : 'Expired';
}

function Status({value}: {value: RequestStatus}) {
  return <span className={`status ${value.toLowerCase()}`}>{value}</span>;
}

const emailStatus: Record<string, string> = {sent: 'Email submitted', sending: 'Email sending', failed: 'Email unconfirmed'};

const adminViews = [
  {id: 'pilot', label: 'Pilot access', icon: Ticket, description: 'Review requests to join HH and track household invitations.'},
  {id: 'notices', label: 'Notices & updates', icon: Bell, description: 'Preview and publish pop-ups that members see when they open HH.'},
  {id: 'palettes', label: 'Seasonal palettes', icon: Palette, description: 'Choose which seasonal and holiday themes members can use and when.'},
  {id: 'feedback', label: 'Feedback & ideas', icon: MessageSquare, description: 'Read feedback and ideas submitted by members.'},
  {id: 'ratings', label: 'App ratings', icon: Star, description: 'Manage the rating prompt and review responses.'},
  {id: 'releases', label: 'Releases', icon: PackageCheck, description: 'Review approved builds and prepare their app update announcements.'},
] as const;
type AdminView = typeof adminViews[number]['id'];
const availableAdminViews = testEnvironment ? adminViews : adminViews.filter(tab => tab.id !== 'releases');

function AdminWorkspace({getClient, signOut}: {getClient: GetAdminClient; signOut?: () => Promise<void>}) {
  const [view, setView] = useState<AdminView>('pilot');
  const [contentView, setContentView] = useState<'notices' | 'palettes'>();
  const [releaseOpened, setReleaseOpened] = useState(false);
  const [error, setError] = useState('');
  const activeView = availableAdminViews.find((tab) => tab.id === view) ?? availableAdminViews[0];
  return <main className="shell dashboard">
    <header className="dashboard-header">
      <div className="dashboard-heading">
        <div>
          <h1 id="admin-workspace-heading">{activeView.label}</h1>
          <p>{activeView.description}</p>
        </div>
        {signOut && <button className="admin-sign-out" type="button" onClick={() => void signOut().catch((error: Error) => setError(error.message))}><LogOut size={17} aria-hidden="true" /> Sign out</button>}
      </div>
      <nav className={testEnvironment ? "admin-navigation has-release-tab" : "admin-navigation"} aria-label="Admin Dashboard">
        {availableAdminViews.map(({id, label, icon: Icon}) => <button type="button" key={id} aria-controls="admin-workspace-panel" aria-current={id === view ? 'page' : undefined} onClick={() => {
          setView(id);
          if (id === 'notices' || id === 'palettes') setContentView(id);
          if (id === 'releases') setReleaseOpened(true);
        }}><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
    </header>
    {error && <p className="message error" role="alert">{error}</p>}
    <section id="admin-workspace-panel" aria-labelledby="admin-workspace-heading">
      <div hidden={view !== 'pilot'}><Dashboard getClient={getClient} /></div>
      {contentView && <div hidden={view !== 'notices' && view !== 'palettes'}><ContentPanel view={contentView} getClient={getClient} /></div>}
      {(view === 'feedback' || view === 'ratings') && <Inbox key={view} view={view} getClient={getClient} />}
      {releaseOpened && <div hidden={view !== 'releases'}><Suspense fallback={<p role="status">Loading releases…</p>}>
        <ReleasePanel active={view === 'releases'} getClient={getClient} />
      </Suspense></div>}
    </section>
  </main>;
}

function Dashboard({getClient}: {getClient: GetAdminClient}) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>();
  const [email, setEmail] = useState('');
  const [selection, setSelection] = useState<'requests' | 'invitations'>('requests');
  const [requestFilter, setRequestFilter] = useState<typeof requestFilters[number]>('All');
  const [filter, setFilter] = useState<InviteStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [receipt, setReceipt] = useState<Receipt>();
  const [copyMessage, setCopyMessage] = useState('');

  async function refresh() {
    setLoading(true);
    setLoadError('');
    try {
      setSnapshot(await getDashboard(await getClient()));
    } catch (error) {
      setSnapshot(undefined);
      setLoadError(error instanceof Error ? error.message : 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {void refresh();}, []);

  async function deliver(email: string, token: string) {
    const sent = await getClient().then((client) => sendPilotInvitation(client, token)).catch(() => false);
    setReceipt({email, token, delivery: sent ? 'sent' : 'unconfirmed'});
    await refresh();
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = email.trim().toLowerCase();
    setSending(true);
    setSendError('');
    setCopyMessage('');
    try {
      const token = await createPilotInvitation(await getClient(), recipient);
      setEmail('');
      setReceipt({email: recipient, token, delivery: testEnvironment ? 'preview' : 'sending'});
      if (testEnvironment) await refresh();
      else await deliver(recipient, token);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'The invitation could not be created.');
    } finally {
      setSending(false);
    }
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(pilotInvitationUrl(token));
      setCopyMessage('Invitation link copied.');
    } catch {
      setCopyMessage('Select and copy the link below.');
    }
  }

  const needle = search.trim().toLowerCase();
  const invitations = snapshot?.invitations.filter((invite) => invite.email.toLowerCase().includes(needle)
    && (filter === 'All' || invitationStatus(invite) === filter)) ?? [];
  const invitationsByEmail = new Map<string, InviteStatus>();
  for (const invite of snapshot?.invitations ?? []) {
    const status = invitationStatus(invite);
    const current = invitationsByEmail.get(invite.email.toLowerCase());
    if (!current || current === 'Expired' || status === 'Accepted') invitationsByEmail.set(invite.email.toLowerCase(), status);
  }
  const requests = (snapshot?.requests ?? [])
    .filter((request) => `${request.name} ${request.email}`.toLowerCase().includes(needle))
    .map((request) => ({request, status: invitationsByEmail.get(request.email.toLowerCase()) ?? 'New' as const}))
    .filter(({status}) => requestFilter === 'All'
      || (requestFilter === 'Needs invitation' ? needsInvitation(status) : status === requestFilter));

  return <div className="workspace">
      <aside className="panel composer" aria-labelledby="invite-heading">
        <h2 id="invite-heading">Send an invitation</h2>
        {snapshot && <p className="capacity">{snapshot.capacity.used} of {snapshot.capacity.total} pilot places reserved</p>}
        <form onSubmit={send}>
          <label>Recipient email<input id="recipient" type="email" autoComplete="off" autoCapitalize="none" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>
          <button className="primary" disabled={sending || loading || !snapshot || snapshot.capacity.used >= snapshot.capacity.total}>{sending ? 'Working…' : testEnvironment ? 'Create invitation' : 'Send invitation'}</button>
        </form>
        {sendError && <p className="message error" role="alert">{sendError}</p>}
        {receipt && <div className="receipt">
          <p role="status">{{
            sent: 'Invitation email submitted for delivery.',
            sending: 'Invitation created. Sending email…',
            unconfirmed: 'Invitation created. Email delivery could not be confirmed.',
            preview: 'TEST invitation created. Copy the link to test signup.',
          }[receipt.delivery]}</p>
          <p className="detail">{receipt.email}</p>
          <button type="button" onClick={() => void copyLink(receipt.token)}>Copy invitation link</button>
          {receipt.delivery === 'unconfirmed' && <button type="button" disabled={sending} onClick={async () => {
            setSending(true);
            setReceipt({...receipt, delivery: 'sending'});
            await deliver(receipt.email, receipt.token);
            setSending(false);
          }}>Retry email</button>}
          {copyMessage && <p className="detail" role="status">{copyMessage}</p>}
          <details><summary>Show invitation link</summary><p className="invitation-url">{pilotInvitationUrl(receipt.token)}</p></details>
        </div>}
      </aside>
      <section className="panel records" aria-label="Pilot requests and invitations">
        <div className="record-nav">
          <div className="record-view" role="group" aria-label="View">
            <button type="button" aria-pressed={selection === 'requests'} onClick={() => setSelection('requests')}>Join requests</button>
            <button type="button" aria-pressed={selection === 'invitations'} onClick={() => setSelection('invitations')}>Invitations</button>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
        </div>
        <div className="filters">
          <label>Search<input type="search" placeholder={selection === 'requests' ? 'Name or email' : 'Email address'} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          {selection === 'requests' && <div className="status-filter"><label htmlFor="request-status">Request status</label><select id="request-status" value={requestFilter} onChange={(event) => setRequestFilter(event.target.value as typeof requestFilter)}>
            {requestFilters.map((option) => <option key={option}>{option}</option>)}
          </select></div>}
          {selection === 'invitations' && <div className="status-filter"><label htmlFor="invite-status">Status</label><select id="invite-status" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option>All</option><option>Pending</option><option>Accepted</option><option>Expired</option>
          </select></div>}
        </div>
        {loadError && <p className="message error" role="alert">{loadError}</p>}
        {loading && <p className="empty" role="status">Loading pilot activity…</p>}
        {snapshot && selection === 'requests' && <>
          {!requests.length && !loading && <p className="empty">{requestFilter !== 'All' || needle ? 'No requests match these filters.' : 'New invitation requests from the HH website will appear here.'}</p>}
          <ul className="record-list">
            {requests.map(({request, status}) => <li key={request.id}>
                <div className="record-main">
                  <strong>{request.name}</strong>
                  <span>{request.email}</span>
                  <span className="detail">{showDate(request.received_at)}</span>
                  {request.heard_from && <span className="detail">Heard about HH through {request.heard_from}</span>}
                  {request.pilot_interest && <span className="detail">Pilot interest · {request.pilot_interest}</span>}
                  {request.message && <p className="request-note">{request.message}</p>}
                </div>
                <div className="record-actions"><Status value={status} />
                  {needsInvitation(status) && <button type="button" aria-label={`Invite ${request.name}`} onClick={() => {
                    setEmail(request.email);
                    document.getElementById('recipient')?.focus();
                  }}>Invite</button>}
                </div>
              </li>)}
          </ul>
        </>}
        {snapshot && selection === 'invitations' && <>
          {!invitations.length && !loading && <p className="empty">{needle || filter !== 'All' ? 'No invitations match these filters.' : 'Pilot invitations will appear here.'}</p>}
          <ul className="record-list">
            {invitations.map((invite) => {
              const status = invitationStatus(invite);
              return <li key={invite.id}>
                <div className="record-main">
                  <strong>{invite.email}</strong>
                  <span className="detail">Created {showDate(invite.created_at)}</span>
                  {status === 'Pending' && <span className="detail">Expires {showDate(invite.expires_at)}</span>}
                  {invite.used_at && <span className="detail">Accepted {showDate(invite.used_at)}</span>}
                  {invite.delivery_status && emailStatus[invite.delivery_status] && <span className="detail">{emailStatus[invite.delivery_status]}</span>}
                </div>
                <div className="record-actions"><Status value={status} /></div>
              </li>;
            })}
          </ul>
        </>}
      </section>
    </div>;
}

createRoot(document.getElementById('root')!).render(<HHAdmin />);
