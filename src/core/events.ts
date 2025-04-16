import type {
  DispatchEvent,
  ProcessEvent,
} from "@aetherium-nexus/core/mailbox";

export { DispatchEvent, ProcessEvent };

export type AetheriumLifecyleEvent = ProcessEvent | DispatchEvent;
