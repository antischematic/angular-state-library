import {Observable} from "rxjs";
import {Provider} from "@angular/core";

export interface EventData<ActionName, ActionContext = unknown> {
   readonly id: number
   readonly name: ActionName
   readonly context: ActionContext
   readonly timestamp: number
}

export interface DispatchEvent<ActionName = PropertyKey, ActionContext = unknown, ActionValue = unknown> extends EventData<ActionName, ActionContext> {
   readonly type: EventType.Dispatch
   readonly value: ActionValue
}

export interface NextEvent<ActionName = PropertyKey, ActionContext = unknown, ActionValue = unknown> extends EventData<ActionName, ActionContext> {
   readonly value: ActionValue extends Observable<infer R> ? R : never
   readonly type: EventType.Next
}

export interface ErrorEvent<ActionName = PropertyKey, ActionContext = unknown> extends EventData<ActionName, ActionContext> {
   readonly value: unknown
   readonly type: EventType.Error
}

export interface CompleteEvent<ActionName = PropertyKey, ActionContext = unknown> extends EventData<ActionName, ActionContext> {
   readonly type: EventType.Complete
}

export type StoreEvent<ActionName = PropertyKey, ActionContext = unknown, ActionType = unknown, EffectType = unknown> =
   | DispatchEvent<ActionName, ActionContext, ActionType>
   | NextEvent<ActionName, ActionContext, EffectType>
   | ErrorEvent<ActionName, ActionContext>
   | CompleteEvent<ActionName, ActionContext>

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
   [key in U]: key extends keyof T ? T[key] extends (...params: infer P) => infer R ? StoreEvent<key, T, P, R> : never : never
}[U]

export interface StoreConfig {
   root?: boolean
   actionProviders?: Provider[]
}

export type DepMap = Map<Record<any, any>, Map<string, unknown>>
