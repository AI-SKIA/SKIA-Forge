// SKIA Durable State Store for Orchestration

export type StateEntry = {
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, any>;
};

export type StateSnapshot = {
  planId: string;
  snapshotId: string;
  capturedAt: Date;
  stepIndex: number;
  state: Record<string, StateEntry>;
};

function generateId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
  );
}

export class StateStore {
  private store: Map<string, StateEntry> = new Map();
  private snapshots: Map<string, StateSnapshot[]> = new Map();

  set(key: string, value: any, ttlSeconds?: number, metadata: Record<string, any> = {}): StateEntry {
    const now = new Date();
    const existing = this.store.get(key);
    const expiresAt = ttlSeconds ? new Date(now.getTime() + ttlSeconds * 1000) : null;
    const entry: StateEntry = {
      key,
      value,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      expiresAt,
      metadata: { ...(existing?.metadata || {}), ...metadata },
    };
    this.store.set(key, entry);
    return entry;
  }

  get(key: string): StateEntry | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  snapshot(planId: string, stepIndex: number): StateSnapshot {
    const snapshotId = generateId();
    const capturedAt = new Date();
    const state: Record<string, StateEntry> = {};
    for (const [key, entry] of this.store.entries()) {
      state[key] = { ...entry };
    }
    const snapshot: StateSnapshot = {
      planId,
      snapshotId,
      capturedAt,
      stepIndex,
      state,
    };
    if (!this.snapshots.has(planId)) {
      this.snapshots.set(planId, []);
    }
    this.snapshots.get(planId)!.push(snapshot);
    return snapshot;
  }

  restoreSnapshot(planId: string, snapshotId: string): boolean {
    const planSnaps = this.snapshots.get(planId);
    if (!planSnaps) return false;
    const snap = planSnaps.find(s => s.snapshotId === snapshotId);
    if (!snap) return false;
    this.store.clear();
    for (const [key, entry] of Object.entries(snap.state)) {
      this.store.set(key, { ...entry });
    }
    return true;
  }

  getSnapshots(planId: string): StateSnapshot[] {
    return this.snapshots.get(planId) || [];
  }

  clearExpired(): number {
    const now = new Date();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }
}

export const stateStore = new StateStore();
