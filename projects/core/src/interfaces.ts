import {Observable} from "rxjs";
import {Provider} from "@angular/core";

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

export type TypedChanges<T> = {
   [key in keyof T]?: {
      previousValue: T[key] | undefined;
      currentValue: T[key];
      firstChange: boolean;
      isFirstChange(): boolean;
   }
}

export const enum Phase {
   DoCheck = "ngDoCheck",
   AfterContentChecked = "ngAfterContentChecked",
   AfterViewChecked = "ngAfterViewChecked"
}

export interface ActionMetadata {
   immediate?: boolean;
   phase?: Phase
   track?: boolean
}

export interface SelectMetadata {}

export interface CaughtMetadata {}

export interface StatusMetadata {
   action: string
}

export type Metadata<T> = T & {
   key: string
   descriptor?: PropertyDescriptor
}

export type ExtractEvents<T, U extends PropertyKey> = {
   [key in U]: key extends keyof T ? T[key] extends (...params: infer P) => infer R ? StoreEvent<key, P, R> : never : never
}[U]

export interface StoreConfig {
   root?: boolean
   actionProviders?: Provider[]
}

export type DepMap = Map<Record<any, any>, Map<string, unknown>>
