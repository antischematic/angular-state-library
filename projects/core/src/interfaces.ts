import {Observable} from "rxjs";

export interface EventData<K> {
   readonly id: number
   readonly name: K
   readonly context: object
   readonly timestamp: number
}

export interface DispatchEvent<K = PropertyKey, T = unknown> extends EventData<K> {
   readonly type: EventType.Dispatch
   readonly value: T
}

export interface NextEvent<K = PropertyKey, T = unknown> extends EventData<K> {
   readonly value: T extends Observable<infer R> ? R : never
   readonly type: EventType.Next
}

export interface ErrorEvent<K = PropertyKey> extends EventData<K> {
   readonly value: unknown
   readonly type: EventType.Error
}

export interface CompleteEvent<K = PropertyKey> extends EventData<K> {
   readonly type: EventType.Complete
}

export type StoreEvent<ActionName = PropertyKey, ActionType = unknown, EffectType = unknown> =
   | DispatchEvent<ActionName, ActionType>
   | NextEvent<ActionName, EffectType>
   | ErrorEvent<ActionName>
   | CompleteEvent<ActionName>

export enum EventType {
   Dispatch = "dispatch",
   Next = "next",
   Error = "error",
   Complete = "complete"
}

export interface DispatchObserver<U> {
   next?(value: U): void
   error?(error: unknown): void
   complete?(): void
   finalize?(): void
}
