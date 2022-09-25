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

export interface DispatchObserver<T, U> {
   next?(this: T, value: U): void
   error?(this: T, error: unknown): void
   complete?(this: T): void
   finalize?(this: T): void
}

export interface Dispatch<T> {
   <U>(source: Promise<Observable<U>>): Observable<U>
   <U>(source: Promise<Observable<U>>, observer: DispatchObserver<T, U>): Observable<U>
   <U>(source: Promise<Observable<U>>, next: (this: T, value: U) => void): Observable<U>
   <U>(source: Observable<U>): Observable<U>
   <U>(source: Observable<U>, observer: DispatchObserver<T, U>): Observable<U>
   <U>(source: Observable<U>, next: (this: T, value: U) => void): Observable<U>
}
