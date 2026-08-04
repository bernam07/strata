export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// deno-lint-ignore no-explicit-any
let appServer: Promise<any | null> | null = null;

// deno-lint-ignore no-explicit-any
const getAppServer = (): Promise<any | null> => {
  if (appServer) return appServer;
  appServer = (async () => {
    const keysJson = Deno.env.get('VAPID_KEYS');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!keysJson || !subject) return null;
    try {
      const webpush = await import('jsr:@negrel/webpush@0.3.0');
      const vapidKeys = await webpush.importVapidKeys(JSON.parse(keysJson), {
        extractable: false,
      });
      return await webpush.ApplicationServer.new({
        contactInformation: subject,
        vapidKeys,
      });
    } catch (_error) {
      return null;
    }
  })();
  return appServer;
};

const isPrivateHost = (host: string): boolean =>
  host === 'localhost' ||
  host.endsWith('.local') ||
  /^127\./.test(host) ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^169\.254\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

const safeEndpoint = (endpoint: string): boolean => {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !isPrivateHost(url.hostname);
  } catch {
    return false;
  }
};

export const sendPush = async (
  subscriptions: readonly PushSubscriptionRow[],
  payload: PushPayload,
  onStale: (id: string) => Promise<void>,
): Promise<void> => {
  const server = await getAppServer();
  if (!server) return;
  await Promise.all(
    subscriptions.map(async (row) => {
      if (!safeEndpoint(row.endpoint)) return;
      try {
        const subscriber = server.subscribe({
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        });
        await subscriber.pushTextMessage(JSON.stringify(payload), {});
      } catch (error) {
        const status =
          // deno-lint-ignore no-explicit-any
          (error as any)?.response?.status ?? (error as any)?.status;
        if (status === 404 || status === 410) await onStale(row.id);
      }
    }),
  );
};
