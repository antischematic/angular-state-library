import {Observable} from "rxjs";

export interface StoreEvent<K> {
   readonly id: number
   readonly name: K
   readonly context: object
   readonly timestamp: number
}

export interface DispatchEvent<K = PropertyKey, T = unknown> extends StoreEvent<K> {
   readonly type: ActionType.Dispatch
   readonly value: T
}

export interface NextEvent<K = PropertyKey, T = unknown> extends StoreEvent<K> {
   readonly value: T
   readonly type: ActionType.Next
}

export interface ErrorEvent<K = PropertyKey> extends StoreEvent<K> {
   readonly value: unknown
   readonly type: ActionType.Error
}

export interface CompleteEvent<K = PropertyKey> extends StoreEvent<K> {
   readonly type: ActionType.Complete
}

export type EventType<ActionKey = PropertyKey, ActionType = unknown, EffectType = unknown> =
   | DispatchEvent<ActionKey, ActionType>
   | NextEvent<ActionKey, EffectType>
   | ErrorEvent<ActionKey>
   | CompleteEvent<ActionKey>

export enum ActionType {
   Dispatch = "dispatch",
   Next = "next",
   Error = "error",
   Complete = "complete"
}

export interface DispatchObserver<T> {
   next?(value: T): void
   error?(error: unknown): void
   complete?(): void
   finalize?(): void
}

export type Dispatch = <T>(source: Observable<T>, observer?: DispatchObserver<T>) => Observable<T>
