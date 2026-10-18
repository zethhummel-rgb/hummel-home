export type RepeatUnit='none'|'day'|'week'|'month'|'year';
export type ReminderItem={id:string;kind:string;title:string;category:string;person:string;due:string;done:number;createdAt:string;reminder_time?:string|null;repeat_unit?:RepeatUnit;repeat_every?:number;reminder_version?:number;last_completed_at?:string|null};
export type ReminderDraft={title:string;person:string;due:string;reminder_time:string|null;repeat_unit:RepeatUnit;repeat_every:number};
export function taskRepeatLabel(unit:RepeatUnit='none',every=1){return unit==='none'?'':`Every ${every===1?'':every+' '}${unit}${every===1?'':'s'}`}
export function taskTimeLabel(time:string){const [hour,minute]=time.split(':').map(Number);return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`}
