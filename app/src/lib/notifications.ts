// Lokalne powiadomienia Androida – bez serwera.
// Strategia: zawsze kasujemy wszystkie oczekujące i planujemy od nowa na 3 dni do przodu
// (po starcie apki, po powrocie do apki i po każdej zmianie).
import { LocalNotifications } from '@capacitor/local-notifications';
import * as db from '../db/db';
import { t } from '../i18n';
import { isNative } from './platform';
import { planReminders, type PlannedReminder } from './schedule';
import { hashInt } from './util';

export const CHANNEL_ID = 'nawyki';
export const ACTION_TYPE = 'TASK';

export type NotifAction = 'run' | 'done' | 'snooze' | 'tap';
export interface NotifPayload {
  taskId: string;
  slotKey: string;
}
type Handler = (action: NotifAction, payload: NotifPayload) => void;

let handler: Handler | null = null;
let initialized = false;

export function setNotificationHandler(h: Handler) {
  handler = h;
}

export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!isNative()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: t('notif.channel'),
      description: t('notif.channelDesc'),
      importance: 5,
      visibility: 1,
      vibration: true,
    });
  } catch (e) {
    console.warn('channel', e);
  }
  await registerActions();
  await LocalNotifications.addListener('localNotificationActionPerformed', (a) => {
    const extra = (a.notification.extra ?? {}) as Partial<NotifPayload>;
    if (!extra.taskId) return;
    const action: NotifAction = (['run', 'done', 'snooze'] as const).includes(a.actionId as 'run')
      ? (a.actionId as NotifAction)
      : 'tap';
    handler?.(action, { taskId: extra.taskId, slotKey: extra.slotKey ?? '' });
  });
}

/** Rejestracja przycisków (po zmianie języka trzeba wywołać ponownie). */
export async function registerActions(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE,
        actions: [
          { id: 'run', title: t('notif.run') },
          { id: 'done', title: t('notif.done') },
          { id: 'snooze', title: t('notif.snooze') },
        ],
      },
    ],
  });
}

export interface PermissionInfo {
  display: 'granted' | 'denied' | 'prompt' | 'unsupported';
  exact: 'granted' | 'denied' | 'prompt' | 'unsupported';
}

export async function getPermissions(): Promise<PermissionInfo> {
  if (!isNative()) {
    return { display: 'unsupported', exact: 'unsupported' };
  }
  const p = await LocalNotifications.checkPermissions();
  let exact: PermissionInfo['exact'] = 'granted';
  try {
    exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm as PermissionInfo['exact'];
  } catch {
    /* Android < 12 */
  }
  return { display: p.display as PermissionInfo['display'], exact };
}

export async function requestDisplayPermission(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.requestPermissions();
  requestReschedule();
}

export async function openExactAlarmSettings(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.changeExactNotificationSetting();
  requestReschedule();
}

function body(r: PlannedReminder): string {
  switch (r.kind) {
    case 'due':
      return t('notif.bodyDue', { time: r.time });
    case 'nag':
      return t('notif.bodyNag');
    case 'snooze':
      return t('notif.bodySnooze');
    case 'resume':
      return t('notif.bodyResume');
  }
}

// --- w przeglądarce (podgląd na komputerze) symulujemy powiadomienia timerami ---
let webTimers: number[] = [];
export type WebNotifListener = (title: string, body: string, payload: NotifPayload) => void;
let webListener: WebNotifListener | null = null;
export function setWebNotificationListener(l: WebNotifListener) {
  webListener = l;
}

let pending: number | null = null;
export function requestReschedule(): void {
  if (pending) window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    pending = null;
    rescheduleAll().catch((e) => console.error('reschedule', e));
  }, 400);
}

export let lastPlan: PlannedReminder[] = [];

export async function rescheduleAll(): Promise<void> {
  const [tasks, snoozes] = await Promise.all([db.getAll('tasks'), db.getAll('snoozes')]);
  const since = Date.now() - 2 * 86_400_000;
  const events = await db.eventsBetween(since, Date.now() + 86_400_000);
  // sprzątanie przeterminowanych odłożeń (starsze niż doba)
  for (const s of snoozes) if (s.at < Date.now() - 86_400_000) await db.del('snoozes', s.id);

  const plan = planReminders(tasks, events, snoozes, new Date());
  lastPlan = plan;
  const titles = new Map(tasks.map((x) => [x.id, x.title]));

  if (!isNative()) {
    webTimers.forEach((h) => window.clearTimeout(h));
    webTimers = plan
      .filter((r) => r.at.getTime() - Date.now() < 86_400_000)
      .map((r) =>
        window.setTimeout(() => {
          webListener?.(titles.get(r.taskId) ?? '', body(r), { taskId: r.taskId, slotKey: r.slotKey });
        }, r.at.getTime() - Date.now()),
      );
    return;
  }

  const perm = await getPermissions();
  if (perm.display !== 'granted') return;
  const exact = perm.exact === 'granted';

  const old = await LocalNotifications.getPending();
  if (old.notifications.length) {
    await LocalNotifications.cancel({ notifications: old.notifications.map((n) => ({ id: n.id })) });
  }
  if (!plan.length) return;

  await LocalNotifications.schedule({
    notifications: plan.map((r) => ({
      id: hashInt(r.id),
      title: titles.get(r.taskId) ?? 'Nawykomator',
      body: body(r),
      channelId: CHANNEL_ID,
      actionTypeId: ACTION_TYPE,
      smallIcon: 'ic_stat_nawyk',
      iconColor: '#34583A',
      autoCancel: true,
      foreground: true,
      // bez zgody na dokładne alarmy nie otwieramy ekranu ustawień przy każdym planowaniu
      isExactNotification: exact,
      extra: { taskId: r.taskId, slotKey: r.slotKey } satisfies NotifPayload,
      schedule: { at: r.at, allowWhileIdle: true },
    })),
  });
}

/** Testowe powiadomienie za 5 sekund (ekran "Więcej"). */
export async function testNotification(taskId: string, slotKey: string, title: string): Promise<void> {
  if (!isNative()) {
    window.setTimeout(() => webListener?.(title, t('notif.bodyTest'), { taskId, slotKey }), 5000);
    return;
  }
  const perm = await getPermissions();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 7,
        title,
        body: t('notif.bodyTest'),
        channelId: CHANNEL_ID,
        actionTypeId: ACTION_TYPE,
        smallIcon: 'ic_stat_nawyk',
        iconColor: '#34583A',
        foreground: true,
        isExactNotification: perm.exact === 'granted',
        extra: { taskId, slotKey },
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
      },
    ],
  });
}
