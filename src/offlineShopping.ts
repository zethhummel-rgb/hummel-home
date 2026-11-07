import { accountStorage, activeAccountStorageCurrent, accountSwitchBlocked, currentAccountStorage, supabase } from './supabase';
import { authNamespace } from './config';
import type { ReminderItem } from './taskReminders';

export type ShoppingItem = {
  id: string; title: string; done: boolean; version: number; detail: string; category: string;
};
type Pick = { done: boolean; version: number; token: string };
export type Trip = {
  user: string; home: string; name: string; saved: number; rows: ShoppingItem[];
  picks: Record<string, Pick>; notices: string[];
};
const fields = 'id,title,done,reminder_version,category,grocery_quantity,grocery_unit,grocery_store';
export const tripEvent = 'hh-shopping-update';
export const tripOpen = 'hh-shopping-open';

function slot() {
  const choice = currentAccountStorage();
  const backing = accountStorage.store(choice.remember);
  const key = 'shopping:v1:' + choice.key;
  if (accountSwitchBlocked || !activeAccountStorageCurrent() || backing.failed) return null;
  const raw = backing.getItem(choice.key);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw).user?.id;
    if (typeof user !== 'string' || (choice.userId && choice.userId !== user)) return null;
    return { backing, key, user, lock: authNamespace + key };
  } catch { return null; }
}
export function savedTrip(): Trip | null {
  const current = slot();
  if (!current) return null;
  try {
    const raw = current.backing.getItem(current.key);
    const trip = raw ? JSON.parse(raw) as Trip : null;
    return trip?.user === current.user && Array.isArray(trip.rows) && trip.picks ? trip : null;
  } catch { return null; }
}
function notify() { window.dispatchEvent(new Event(tripEvent)); }

async function edit(user: string, update: (trip: Trip | null) => Trip | null) {
  const initial = slot();
  if (!initial || initial.user !== user || !navigator.locks) throw Error('This device could not save the shopping list.');
  await navigator.locks.request(initial.lock, () => {
    const current = slot();
    if (!current || current.user !== user || current.key !== initial.key) throw Error('Your sign-in changed.');
    const next = update(savedTrip());
    if (next) current.backing.setItem(current.key, JSON.stringify(next));
    else current.backing.removeItem(current.key);
    if (current.backing.failed) throw Error('This device could not save your changes. Check available browser storage.');
  });
  notify();
}

type RawItem = {id:string; title:string; done:number|boolean; reminder_version?:number; category:string;
  grocery_quantity?:number|null; grocery_unit?:string|null; grocery_store?:string|null};
function shoppingItem(item: RawItem): ShoppingItem {
  const amount = item.grocery_quantity == null ? '' : [item.grocery_quantity,item.grocery_unit].filter(Boolean).join(' ');
  return { id:item.id, title:item.title, done:!!item.done, version:item.reminder_version || 1,
    category:item.category, detail:[amount,item.grocery_store].filter(Boolean).join(' · ') };
}
export async function saveGroceries(user:string, home:string, name:string, items:ReminderItem[]) {
  const rows = items.filter(item => item.kind === 'grocery').map(shoppingItem);
  await edit(user, old => {
    const same = old?.home === home ? old : null;
    return { user, home, name, rows, saved:Date.now(), picks:same?.picks || {}, notices:same?.notices || [] };
  });
}
export async function pickItem(trip:Trip, id:string, done:boolean) {
  await edit(trip.user, current => {
    const row = current?.rows.find(item => item.id === id);
    if (!current || current.home !== trip.home || !row) throw Error('This item is no longer on your list.');
    current.picks[id] = { done, version:current.picks[id]?.version ?? row.version, token:crypto.randomUUID() };
    return current;
  });
}
export async function clearNotices(trip:Trip) {
  await edit(trip.user, current => current?.home === trip.home ? {...current, notices:[]} : current);
}
export function forgetShopping() {
  const choice = currentAccountStorage();
  accountStorage.store(choice.remember).removeItem('shopping:v1:' + choice.key);
  notify();
}
let prepared:Promise<void> | undefined;
export function prepareShoppingShell() {
  if (!navigator.locks || !('serviceWorker' in navigator)) return Promise.reject(Error('Offline shopping is unavailable in this browser.'));
  const base = new URL('.',location.href);
  if (!prepared) prepared = (async () => {
    const registration = await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.pathname,updateViaCache:'none'});
    await new Promise<void>((resolve,reject) => {
      let port:MessagePort | undefined;
      const probe = () => {
        if (!registration.active) return;
        port?.close();
        const channel = new MessageChannel();
        port = channel.port1;
        port.onmessage = event => {if(event.data===true)finish();};
        registration.active.postMessage('shopping-shell-ready',[channel.port2]);
      };
      const timer = setTimeout(()=>finish(Error('The offline list could not be prepared.')),15000);
      const interval = setInterval(probe,500);
      function finish(error?:Error) {port?.close();clearTimeout(timer);clearInterval(interval);error?reject(error):resolve();}
      probe();
    });
  })().catch(error => {prepared=undefined;throw error;});
  return prepared;
}

// Versions are checked on the write itself. An ambiguous retry can observe the
// desired value, but cannot recreate a deleted row or overwrite a later edit.
export async function syncTrip(trip:Trip) {
  const initial = slot();
  if (!initial || initial.user !== trip.user || !navigator.onLine) return;
  const client = supabase;
  const valid = () => client === supabase && slot()?.user === trip.user && savedTrip()?.home === trip.home;
  const signal = () => AbortSignal.timeout(10000);
  await navigator.locks.request(initial.lock + ':sync', {ifAvailable:true}, async lock => {
    if (!lock || !valid()) return;
    const {data:auth,error:authError} = await client.auth.getSession();
    if (authError || auth.session?.user.id !== trip.user || !valid()) throw Error('Reconnect and sign in to sync your picks.');
    const membership = await client.from('household_members').select('household_id')
      .eq('user_id',trip.user).eq('household_id',trip.home).abortSignal(signal()).maybeSingle();
    if (membership.error) throw membership.error;
    if (!valid()) return;
    if (!membership.data) { forgetShopping(); return; }
    const transition = await client.rpc('household_transition_active',{hid:trip.home}).abortSignal(signal());
    if (transition.error) throw transition.error;
    if (transition.data) throw Error('Finish your household transfer before syncing purchases.');
    for (const [id,pick] of Object.entries(savedTrip()?.picks || {})) {
      if (!valid() || !navigator.onLine) return;
      const result = await client.from('household_items').update({done:pick.done})
        .eq('household_id',trip.home).eq('kind','grocery').eq('id',id).eq('reminder_version',pick.version)
        .select(fields).abortSignal(signal()).maybeSingle();
      if (result.error) throw result.error;
      let server = result.data;
      if (!server) {
        const latest = await client.from('household_items').select(fields)
          .eq('household_id',trip.home).eq('kind','grocery').eq('id',id).abortSignal(signal()).maybeSingle();
        if (latest.error) throw latest.error;
        server = latest.data;
      }
      if (!valid()) return;
      await edit(trip.user, current => {
        if (!current || current.home !== trip.home) return current;
        const pending = current.picks[id];
        const name = current.rows.find(item => item.id === id)?.title || 'Grocery item';
        if (!server || (server.done !== pick.done && !result.data)) {
          current.notices.push(server ? name + ' changed on another device. Review it before checking it again.' : name + ' was removed from the shared list.');
          delete current.picks[id];
        } else if (pending?.token === pick.token) delete current.picks[id];
        else if (pending) pending.version = server.reminder_version;
        if (server) current.rows = current.rows.map(row => row.id === id ? shoppingItem(server) : row);
        else current.rows = current.rows.filter(row => row.id !== id);
        return current;
      });
    }
    if (!valid()) return;
    const fresh = await client.from('household_items').select(fields).eq('household_id',trip.home)
      .eq('kind','grocery').order('created_at').abortSignal(signal());
    if (fresh.error) throw fresh.error;
    if (!valid()) return;
    await edit(trip.user, current => current?.home === trip.home ?
      {...current, rows:fresh.data.map(shoppingItem), saved:Date.now()} : current);
  });
}
