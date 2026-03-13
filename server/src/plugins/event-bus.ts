type DeliveryCallback = (
  pluginId: string,
  eventName: string,
  payload: Record<string, unknown>,
  timestamp: string,
) => Promise<void>;

/**
 * Plugin event bus — routes lifecycle events to subscribed plugin workers.
 * Fire-and-forget delivery: if a worker is down, the event is logged but not retried.
 * Events are delivered serially per plugin to prevent race conditions.
 */
export class EventBus {
  private subscriptions = new Map<string, Set<string>>();
  private deliveryCallback?: DeliveryCallback;
  // Per-plugin delivery queue for serial processing
  private pluginQueues = new Map<string, Promise<void>>();

  /**
   * Register a plugin's event subscriptions from its manifest.
   */
  registerSubscriptions(pluginId: string, events: string[]) {
    for (const event of events) {
      if (!this.subscriptions.has(event)) {
        this.subscriptions.set(event, new Set());
      }
      this.subscriptions.get(event)!.add(pluginId);
    }
  }

  /**
   * Remove all subscriptions for a plugin.
   */
  unregisterPlugin(pluginId: string) {
    for (const [, subscribers] of this.subscriptions) {
      subscribers.delete(pluginId);
    }
  }

  /**
   * Set the callback used to deliver events to plugin workers.
   * Called by the plugin system init to wire to ProcessManager.
   */
  setDeliveryCallback(cb: DeliveryCallback) {
    this.deliveryCallback = cb;
  }

  /**
   * Get the set of plugin IDs subscribed to an event.
   */
  getSubscribers(eventName: string): Set<string> {
    return this.subscriptions.get(eventName) ?? new Set();
  }

  /**
   * Emit an event to all subscribed plugins.
   * Delivery is fire-and-forget — errors are logged, not propagated.
   * Events are delivered serially per plugin.
   */
  async emit(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const subscribers = this.getSubscribers(eventName);
    if (subscribers.size === 0 || !this.deliveryCallback) return;

    const timestamp = new Date().toISOString();

    for (const pluginId of subscribers) {
      // Chain onto the plugin's queue for serial delivery
      const prev = this.pluginQueues.get(pluginId) ?? Promise.resolve();
      const next = prev.then(async () => {
        try {
          await this.deliveryCallback!(pluginId, eventName, payload, timestamp);
        } catch (err) {
          console.warn(
            `[plugins:event-bus] failed to deliver ${eventName} to ${pluginId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      });
      this.pluginQueues.set(pluginId, next);
    }

    // Wait for all deliveries to complete (or fail)
    await Promise.all(
      Array.from(subscribers).map((id) => this.pluginQueues.get(id)),
    );
  }
}

/**
 * Singleton event bus instance — shared across the server.
 */
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  globalEventBus = null;
}
