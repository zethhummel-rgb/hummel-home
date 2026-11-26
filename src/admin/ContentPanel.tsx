import {useEffect, useRef, useState, type FormEvent} from 'react';
import {testEnvironment} from '../config';
import {adminClient} from './api';

const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
type Season = typeof seasons[number];
type NoticeKind = 'notice' | 'update';
type Notice = {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  published_at: string;
  archived_at: string | null;
};
type Contents = {notices: Notice[]; seasonal_palettes: Season[]};
type Draft = {id: string; kind: NoticeKind; title: string; body: string};
type Action = 'snapshot' | 'publish_notice' | 'archive_notice' | 'set_palette';
const dates = new Intl.DateTimeFormat('en-CA', {dateStyle: 'medium', timeStyle: 'short'});

async function requestContent(action: Action, payload: Record<string, unknown> = {}): Promise<Contents> {
  const {data, error} = await adminClient.rpc('hh_admin_content', {action, payload});
  if (error || !Array.isArray(data?.notices) || !Array.isArray(data?.seasonal_palettes)) {
    throw Error('HH could not confirm that change. Refresh before trying again.');
  }
  return data;
}

export default function ContentPanel({view}: {view: 'notices' | 'palettes'}) {
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
      setData(await requestContent('snapshot'));
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
      setData(await requestContent(action, payload));
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
        <p className="detail content-intro">Published notices appear on the signed-in HH Home screen.</p>
        {!preview ? <form onSubmit={review}>
          <label><span>Type</span><select aria-label="Notice type" value={kind} onChange={(event) => setKind(event.target.value as NoticeKind)}>
            <option value="notice">Announcement</option><option value="update">App update</option>
          </select></label>
          <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label>
          <label>{kind === 'update' ? 'What changed?' : 'Message'}<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={6} required /></label>
          <button className="primary" disabled={busy}>Preview notice</button>
        </form> : <div className="notice-preview">
          <span className="status">{preview.kind === 'update' ? 'App update' : 'Announcement'}</span>
          <h3>{preview.title}</h3><p>{preview.body}</p>
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
      <p className="detail content-intro">Enabled palettes become optional choices in Settings → Appearance. Each person picks their own colours.</p>
      <ul className="record-list palette-list">
        {seasons.map((season) => {
          const name = season.charAt(0).toUpperCase() + season.slice(1);
          const enabled = data.seasonal_palettes.includes(season);
          return <li key={season}>
            <strong><span aria-hidden="true" className={`season-swatch ${season}`} />{name}</strong>
            <button type="button" role="switch" aria-checked={enabled} aria-label={`${name} palette`} disabled={busy} onClick={() => void save('set_palette', {palette: season, enabled: !enabled}, `${name} palette ${enabled ? 'disabled' : 'enabled'}.`)}>{enabled ? 'Enabled' : 'Disabled'}</button>
          </li>;
        })}
      </ul>
    </section>}
  </>;
}
