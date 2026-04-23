export interface KernelProcess {
  id: string;
  state: "pending" | "running" | "completed" | "failed";
}

export interface KernelTask {
  id: string;
  priority: number;
}

export interface KernelMemory {
  capacityMb: number;
  usedMb: number;
}

export interface KernelIO {
  channels: string[];
}

export function defineProcessModel(): KernelProcess[] {
  // TODO: Define process lifecycle and transitions.
  return [];
}

export function defineTaskModel(): KernelTask[] {
  // TODO: Define task abstraction and scheduling metadata.
  return [];
}

export function defineMemoryModel(): KernelMemory {
  // TODO: Define memory allocation and reclamation model.
  return { capacityMb: 0, usedMb: 0 };
}

export function defineIOModel(): KernelIO {
  // TODO: Define IO abstraction across channels and boundaries.
  return { channels: [] };
}
