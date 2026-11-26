import {useEffect, useRef, useState, type FormEvent} from 'react';
import {testEnvironment} from '../config';
import NoticeCard from '../NoticeCard';
import {SEASONAL_PALETTES, type SeasonalPaletteId} from '../palettes';
import type {GetAdminClient} from './api';

const holidays = ['easter', 'summer', 'thanksgiving', 'halloween', 'christmas'] as const;
const otherSeasons = ['spring', 'autumn', 'winter'] as const;
type Season = SeasonalPaletteId;
type Schedule = {palette: Season; enabled: boolean; starts_on: string | null; stops_on: string | null};
type NoticeKind = 'notice' | 'update';
type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  published_at: string;
  archived_at: string | null;
};
type Contents = {notices: Notice[]; seasonal_palettes: Season[]; palette_schedule?: Schedule[]};
type Draft = {id: string; kind: NoticeKind; title: string; body: string};
type Action = 'snapshot' | 'publish_notice' | 'archive_notice' | 'set_palette';
const dates = new Intl.DateTimeFormat('en-CA', {dateStyle: 'medium', timeStyle: 'short'});

async function requestContent(getClient: GetAdminClient, action: Action, payload: Record<string, unknown> = {}): Promise<Contents> {
  const adminClient = await getClient();
  const {data, error} = await adminClient.rpc('hh_admin_content', {action, payload});
  if (error || !Array.isArray(data?.notices) || !Array.isArray(data?.seasonal_palettes)) {
    throw Error('HH could not confirm that change. Refresh before trying again.');
  }
  return data;
}

export default function ContentPanel({view, getClient}: {view: 'notices' | 'palettes'; getClient: GetAdminClient}) {
  const [data, setData] = useState<Contents>();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [kind, setKind] = useState<NoticeKind>('notice');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<Draft>();
  const [archiving, setArchiving] = useState<string>();
  const draft = useRef<Draft | undefined>(undefined);
  const submitting = useRef(false);

  async function refresh() {
    setBusy(true);
    setError('');
    try {
      setData(await requestContent(getClient, 'snapshot'));
    } catch {
      setError('HH could not load these settings. Try refreshing.');
    } finally {setBusy(false);}
  }
  useEffect(() => {void refresh();}, []);

  async function save(action: Exclude<Action, 'snapshot'>, payload: Record<string, unknown>, success: string) {
    if (submitting.current) return false;
    submitting.current = true;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      setData(await requestContent(getClient, action, payload));
      setFeedback(success);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HH could not save the change.');
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setError('Enter a title and a message.');
      return;
    }
    setError('');
    setFeedback('');
    const last = draft.current;
    const next = last?.title === cleanTitle && last.body === cleanBody && last.kind === kind
      ? last : {id: crypto.randomUUID(), kind, title: cleanTitle, body: cleanBody};
    draft.current = next;
    setPreview(next);
  }

  async function publish() {
    if (!preview) return;
    if (await save('publish_notice', preview, 'Published in HH.')) {
      setPreview(undefined);
      draft.current = undefined;
      setTitle('');
      setBody('');
    }
  }

  return <>
    <div className="content-feedback">
      {error && <p className="message error" role="alert">{error}</p>}
      {feedback && <p className="message" role="status">{feedback}</p>}
    </div>
    {!data && <section className="panel">
      {busy ? <p role="status">Loading {view}…</p> : <button type="button" onClick={() => void refresh()}>Refresh</button>}
    </section>}
    {data && view === 'notices' && <div className="workspace content-workspace">
      <section className="panel" aria-labelledby="compose-heading">
        <h2 id="compose-heading">Write a notice</h2>
        <p className="detail content-intro">Published notices open as pop-ups for members in HH.</p>
        {!preview ? <form onSubmit={review}>
          <label><span>Type</span><select aria-label="Notice type" value={kind} onChange={(event) => setKind(event.target.value as NoticeKind)}>
            <option value="notice">Announcement</option><option value="update">App update</option>
          </select></label>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
          <label>{kind === 'update' ? 'What changed?' : 'Message'}<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={6} required /></label>
          <button className="primary" disabled={busy}>Preview notice</button>
        </form> : <div className="notice-preview">
          <div className="member-notice-preview" aria-label="Member preview">
            <NoticeCard kind={preview.kind} title={preview.title} body={preview.body} publishedAt={new Date().toISOString()}
              action={<span className="preview-acknowledge">Got it</span>} />
          </div>
          <p className="detail">Publish this notice to all {testEnvironment ? 'HH TEST' : 'HH'} households?</p>
          <div className="inline-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void publish()}>Publish notice</button>
            <button type="button" disabled={busy} onClick={() => setPreview(undefined)}>Keep editing</button>
          </div>
        </div>}
      </section>
      <section className="panel" aria-labelledby="notice-history-heading">
        <div className="record-nav"><h2 id="notice-history-heading">Notice history</h2><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button></div>
        {!data.notices.length && <p className="empty">Published notices will appear here.</p>}
        <ul className="record-list notices-history">
          {data.notices.map((row) => <li key={row.id}>
            <div className="record-main">
              <strong>{row.title}</strong>
              <span className="detail">{row.kind === 'update' ? 'App update' : 'Announcement'} · {dates.format(new Date(row.published_at))}</span>
              <p className="request-note">{row.body}</p>
            </div>
            <div className="record-actions">
              {row.archived_at ? <span className="status expired">Archived</span> : <>
                {archiving === row.id ? <>
                  <button type="button" disabled={busy} aria-label={`Confirm archive ${row.title}`} onClick={async () => {
                    if (await save('archive_notice', {id: row.id}, 'Notice archived.')) setArchiving(undefined);
                  }}>Confirm archive</button>
                  <button type="button" disabled={busy} onClick={() => setArchiving(undefined)}>Cancel</button>
                </> : <button type="button" disabled={busy} aria-label={`Archive ${row.title}`} onClick={() => setArchiving(row.id)}>Archive</button>}
              </>}
            </div>
          </li>)}
        </ul>
      </section>
    </div>}
    {data && view === 'palettes' && <section className="panel palette-panel" aria-labelledby="season-heading">
      <div className="record-nav"><h2 id="season-heading">Seasonal palettes</h2><button type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button></div>
      <p className="detail content-intro">Members can choose available themes in Settings → Appearance. HH restores their regular colours when the theme ends. Dates start at midnight Eastern time.</p>
      <ThemeSchedules seasons={holidays} data={data} busy={busy} onSave={saveSchedule} />
      <details className="other-seasons"><summary>Other seasonal palettes</summary>
        <ThemeSchedules seasons={otherSeasons} data={data} busy={busy} onSave={saveSchedule} />
      </details>
    </section>}
  </>;

  function saveSchedule(schedule: Schedule) {
    if (schedule.starts_on && schedule.stops_on && schedule.stops_on <= schedule.starts_on) {
      setFeedback('');
      setError('Choose a stop date after the start date.');
      return;
    }
    void save('set_palette', schedule, `${SEASONAL_PALETTES[schedule.palette].name} schedule saved.`);
  }
}

const easternDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit'});

function ThemeSchedules({seasons, data, busy, onSave}: {
  seasons: readonly Season[]; data: Contents; busy: boolean; onSave: (schedule: Schedule) => void;
}) {
  const date = easternDate.formatToParts(new Date());
  const today = ['year', 'month', 'day'].map((part) => date.find((item) => item.type === part)?.value).join('-');
  return <div className="palette-list">
    {seasons.map((id) => {
      const palette = SEASONAL_PALETTES[id];
      const row = data.palette_schedule?.find((item) => item.palette === id)
        ?? {palette: id, enabled: data.seasonal_palettes.includes(id), starts_on: null, stops_on: null};
      const status = !row.enabled ? 'Off' : row.starts_on && today < row.starts_on ? 'Scheduled' : row.stops_on && today >= row.stops_on ? 'Ended' : 'Available';
      return <details className="palette-schedule" key={id}>
        <summary>
          <span className="schedule-summary">
            <span className="schedule-swatches" aria-hidden="true">{palette.swatches.map((colour) => <i key={colour} style={{backgroundColor: colour}} />)}</span>
            <span><strong>{palette.name}</strong><small className="detail">{palette.description}</small></span>
          </span>
          <span className="status">{status}</span>
        </summary>
        <form key={`${id}:${row.enabled}:${row.starts_on}:${row.stops_on}`} aria-label={`${palette.name} schedule`} onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget);
          onSave({palette: id, enabled: input.has('enabled'), starts_on: String(input.get('starts_on') ?? '') || null, stops_on: String(input.get('stops_on') ?? '') || null});
        }}>
          <label className="schedule-check"><input type="checkbox" name="enabled" defaultChecked={row.enabled} /> Enable theme</label>
          <div className="schedule-dates">
            <label>Start date<input type="date" name="starts_on" defaultValue={row.starts_on ?? ''} /></label>
            <label>Stop date<input type="date" name="stops_on" defaultValue={row.stops_on ?? ''} /></label>
          </div>
          <p className="detail">Leave start blank to make it available now. The theme ends at the start of the stop date.</p>
          <button className="primary" disabled={busy}>Save schedule</button>
        </form>
      </details>;
    })}
  </div>;
}
