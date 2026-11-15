import { useEffect, useState } from "react";
import {
  deleteNotificationSubscription,
  getNotificationPublicKey,
  saveNotificationSubscription,
  sendTestNotification,
  type NotificationSubscriptionInput,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface NotificationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function supportsPushNotifications(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof Notification !== "undefined" &&
    "PushManager" in window &&
    typeof navigator.serviceWorker !== "undefined"
  );
}

function isInstalledOnAppleMobile(): boolean {
  const userAgent = navigator.userAgent;
  const isAppleMobile =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  return isAppleMobile && isStandalone;
}

function isAppleMobile(): boolean {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function subscriptionInput(
  subscription: PushSubscription,
): NotificationSubscriptionInput {
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error("The browser returned an incomplete notification subscription.");
  }

  return {
    endpoint: serialized.endpoint,
    keys: {
      p256dh: serialized.keys.p256dh,
      auth: serialized.keys.auth,
    },
  };
}

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const decoded = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function errorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}

export function NotificationSettingsDialog({
  open,
  onOpenChange,
}: NotificationSettingsDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supported = supportsPushNotifications();
  const permissionDenied =
    supported && Notification.permission === "denied";
  const appleInstallRequired =
    !supported && isAppleMobile() && !isInstalledOnAppleMobile();

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setEnabled(false);
    setLoading(true);
    setMessage(null);

    if (!supportsPushNotifications() || Notification.permission !== "granted") {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;

        setEnabled(Boolean(subscription));
        if (subscription) {
          void saveNotificationSubscription(subscriptionInput(subscription)).catch(
            () => {
              // Keep the device enabled even if the quiet server refresh fails.
            },
          );
        }
      } catch {
        if (!cancelled) setEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  async function turnOnNotifications() {
    setPending(true);
    setMessage(null);

    let subscription: PushSubscription | null = null;
    try {
      // This call starts synchronously from the Switch interaction so browsers
      // that require a direct user action can show their permission prompt.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEnabled(false);
        setPending(false);
        return;
      }

      let publicKey: string;
      try {
        ({ publicKey } = await getNotificationPublicKey());
      } catch (error) {
        if (errorStatus(error) === 503) {
          setMessage("Notifications are not available right now.");
        } else {
          setMessage("Could not enable notifications. Please try again.");
        }
        setEnabled(false);
        setPending(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });
      await saveNotificationSubscription(subscriptionInput(subscription));
      setEnabled(true);
    } catch {
      if (subscription) {
        try {
          await subscription.unsubscribe();
        } catch {
          // The browser may already have removed the subscription.
        }
      }
      setEnabled(false);
      setMessage("Could not enable notifications. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function turnOffNotifications() {
    setPending(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        try {
          await deleteNotificationSubscription({
            endpoint: subscription.endpoint,
          });
        } catch {
          setMessage("The saved setting could not be updated, but this device is off.");
        } finally {
          await subscription.unsubscribe();
        }
      }
    } catch {
      setMessage("Could not update this device's notification setting.");
    } finally {
      setEnabled(false);
      setPending(false);
    }
  }

  function handleSwitchChange(checked: boolean) {
    if (checked) {
      void turnOnNotifications();
    } else {
      void turnOffNotifications();
    }
  }

  async function handleTestNotification() {
    setTesting(true);
    setMessage(null);
    try {
      await sendTestNotification();
      setMessage("Test sent. It should appear within a few seconds.");
    } catch (error) {
      setMessage(
        errorStatus(error) === 429
          ? "Please wait a minute before sending another test."
          : "Could not send a test notification. Please try again.",
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notifications</DialogTitle>
          <DialogDescription>
            Get one notification each morning when you have care tasks due or
            overdue.
          </DialogDescription>
        </DialogHeader>

        {appleInstallRequired ? (
          <p className="text-sm leading-6 text-muted-foreground">
            On iPhone and iPad, notifications only work from the Home Screen
            app. In Safari, tap Share, then Add to Home Screen, open Bonsai
            Journal from there, and come back to this screen.
          </p>
        ) : !supported ? (
          <p className="text-sm text-muted-foreground">
            This browser does not support notifications.
          </p>
        ) : permissionDenied ? (
          <p className="text-sm text-muted-foreground">
            Notifications are blocked for Bonsai Journal in this browser. Allow
            them in your browser or device settings, then come back here.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="daily-care-notifications">
                  Daily care notification on this device
                </Label>
                <p className="text-xs leading-5 text-muted-foreground">
                  This setting is per device. Turn it on for each phone or
                  computer where you want notifications.
                </p>
              </div>
              <Switch
                id="daily-care-notifications"
                aria-label="Daily care notification on this device"
                checked={enabled}
                disabled={loading || pending}
                onCheckedChange={handleSwitchChange}
              />
            </div>

            {enabled && (
              <Button
                variant="outline"
                onClick={handleTestNotification}
                disabled={testing}
              >
                {testing ? "Sending test…" : "Send test notification"}
              </Button>
            )}

            {message && (
              <p className="text-sm text-muted-foreground" role="status">
                {message}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
