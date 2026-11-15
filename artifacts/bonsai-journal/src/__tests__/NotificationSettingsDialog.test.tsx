import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  deleteNotificationSubscription,
  getNotificationPublicKey,
  saveNotificationSubscription,
  sendTestNotification,
} from "@workspace/api-client-react";
import { NotificationSettingsDialog } from "@/components/NotificationSettingsDialog";

vi.mock("@workspace/api-client-react", () => ({
  deleteNotificationSubscription: vi.fn(),
  getNotificationPublicKey: vi.fn(),
  saveNotificationSubscription: vi.fn(),
  sendTestNotification: vi.fn(),
}));

const mockedDelete = vi.mocked(deleteNotificationSubscription);
const mockedGetKey = vi.mocked(getNotificationPublicKey);
const mockedSave = vi.mocked(saveNotificationSubscription);
const mockedTest = vi.mocked(sendTestNotification);

function makeSubscription() {
  return {
    endpoint: "https://push.example.test/device",
    toJSON: () => ({
      endpoint: "https://push.example.test/device",
      keys: { p256dh: "device-public-key", auth: "device-auth-key" },
    }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

let currentSubscription: PushSubscription | null;
let getSubscription: ReturnType<typeof vi.fn>;
let subscribe: ReturnType<typeof vi.fn>;
let requestPermission: ReturnType<typeof vi.fn>;
let serviceWorkerDescriptor: PropertyDescriptor | undefined;

function renderDialog() {
  return render(
    <NotificationSettingsDialog open onOpenChange={vi.fn()} />,
  );
}

describe("NotificationSettingsDialog", () => {
  beforeEach(() => {
    currentSubscription = null;
    getSubscription = vi.fn(async () => currentSubscription);
    subscribe = vi.fn(async () => {
      currentSubscription = makeSubscription();
      return currentSubscription;
    });
    requestPermission = vi.fn(async () => "granted");

    const registration = {
      pushManager: { getSubscription, subscribe },
    };
    serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "serviceWorker",
    );
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.resolve(registration) },
    });
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission,
    });
    vi.stubGlobal("PushManager", class PushManager {});

    mockedDelete.mockResolvedValue({ success: true });
    mockedGetKey.mockResolvedValue({ publicKey: "AQIDBA" });
    mockedSave.mockResolvedValue({ success: true });
    mockedTest.mockResolvedValue({ sent: 1, removed: 0 });
  });

  afterEach(() => {
    if (serviceWorkerDescriptor) {
      Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("starts off without a subscription and on when this device has one", async () => {
    const { unmount } = renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "false",
      ),
    );
    unmount();

    currentSubscription = makeSubscription();
    renderDialog();
    await waitFor(() =>
      expect(screen.getByRole("switch")).toHaveAttribute(
        "aria-checked",
        "true",
      ),
    );
    await waitFor(() => expect(mockedSave).toHaveBeenCalled());
  });

  it("requests permission and saves the new browser subscription", async () => {
    renderDialog();
    const toggle = await screen.findByRole("switch");
    fireEvent.click(toggle);

    expect(await screen.findByRole("button", { name: "Send test notification" }))
      .toBeInTheDocument();
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(mockedGetKey).toHaveBeenCalledOnce();
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      }),
    );
    expect(mockedSave).toHaveBeenCalledWith({
      endpoint: "https://push.example.test/device",
      keys: { p256dh: "device-public-key", auth: "device-auth-key" },
    });
  });

  it("leaves notifications off and unsubscribes if saving fails", async () => {
    mockedSave.mockRejectedValueOnce(new Error("Save failed"));
    renderDialog();
    fireEvent.click(await screen.findByRole("switch"));

    expect(
      await screen.findByText("Could not enable notifications. Please try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("button", { name: "Send test notification" }))
      .not.toBeInTheDocument();
    expect(currentSubscription?.unsubscribe).toHaveBeenCalledOnce();
  });

  it("deletes the server subscription and unsubscribes when turned off", async () => {
    currentSubscription = makeSubscription();
    renderDialog();
    const toggle = await screen.findByRole("switch");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    fireEvent.click(toggle);

    await waitFor(() =>
      expect(mockedDelete).toHaveBeenCalledWith({
        endpoint: "https://push.example.test/device",
      }),
    );
    expect(currentSubscription.unsubscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("still unsubscribes locally when deleting the server copy fails", async () => {
    const subscription = makeSubscription();
    currentSubscription = subscription;
    mockedDelete.mockRejectedValueOnce(new Error("Delete failed"));
    renderDialog();
    const toggle = await screen.findByRole("switch");
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    fireEvent.click(toggle);

    expect(
      await screen.findByText(
        "The saved setting could not be updated, but this device is off.",
      ),
    ).toBeInTheDocument();
    expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("shows the iPhone Home Screen instructions when not installed", () => {
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("PushManager", undefined);
    Reflect.deleteProperty(navigator, "serviceWorker");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );
    renderDialog();

    expect(
      screen.getByText(/notifications only work from the Home Screen app/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Send test notification" }),
    ).not.toBeInTheDocument();
  });

  it("shows the generic unsupported-browser message on other devices", () => {
    vi.stubGlobal("Notification", undefined);
    vi.stubGlobal("PushManager", undefined);
    Reflect.deleteProperty(navigator, "serviceWorker");
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/128.0",
    );
    renderDialog();

    expect(
      screen.getByText("This browser does not support notifications."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("explains when notifications are blocked", () => {
    vi.stubGlobal("Notification", {
      permission: "denied",
      requestPermission,
    });
    renderDialog();

    expect(
      screen.getByText(/Notifications are blocked for Bonsai Journal/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("sends a test notification and explains the rate limit", async () => {
    currentSubscription = makeSubscription();
    renderDialog();
    const testButton = await screen.findByRole("button", {
      name: "Send test notification",
    });
    fireEvent.click(testButton);
    expect(
      await screen.findByText(
        "Test sent. It should appear within a few seconds.",
      ),
    ).toBeInTheDocument();
    expect(mockedTest).toHaveBeenCalledOnce();

    await waitFor(() => expect(testButton).not.toBeDisabled());
    mockedTest.mockRejectedValueOnce(Object.assign(new Error("Limited"), { status: 429 }));
    fireEvent.click(testButton);
    expect(
      await screen.findByText(
        "Please wait a minute before sending another test.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the unavailable message when the public key endpoint returns 503", async () => {
    mockedGetKey.mockRejectedValueOnce(
      Object.assign(new Error("Unavailable"), { status: 503 }),
    );
    renderDialog();
    fireEvent.click(await screen.findByRole("switch"));

    expect(
      await screen.findByText("Notifications are not available right now."),
    ).toBeInTheDocument();
    expect(subscribe).not.toHaveBeenCalled();
  });
});
