import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { usePushNotifications } from './usePush';
import { CardTitle } from '@/ui/Heading';

export const NotificationsCard = () => {
  const push = usePushNotifications();
  if (!push.supported) return null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>
            Price alert notifications
          </CardTitle>
          <p className="text-xs text-[var(--text-muted)]">
            Get a push when a price alert triggers, even with the app closed.
          </p>
        </div>
        {push.enabled ? (
          <Button variant="ghost" onClick={push.disable} disabled={push.busy}>
            Turn off
          </Button>
        ) : (
          <Button onClick={push.enable} disabled={push.busy || !push.configured}>
            {push.busy ? 'Enabling…' : 'Enable'}
          </Button>
        )}
      </div>
      {!push.configured && (
        <p className="text-xs text-[var(--text-muted)]">
          Push isn't configured yet — set VITE_VAPID_PUBLIC_KEY and the server
          VAPID keys.
        </p>
      )}
      {push.error && (
        <p className="text-xs text-[var(--negative)]">{push.error}</p>
      )}
      {push.enabled && (
        <p className="text-xs text-[var(--positive)]">
          Notifications are on for this device.
        </p>
      )}
    </Card>
  );
};
