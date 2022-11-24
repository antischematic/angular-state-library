import {ErrorHandler, inject, Injectable, InjectionToken} from "@angular/core";
import {Observable, OperatorFunction, Subject, Subscription, switchAll} from "rxjs";
import {ActionMetadata, EventType, StoreConfig, StoreEvent} from "./interfaces";
import {getErrorHandlers} from "./metadata";
import {track} from "./proxy";
import {UID} from "./utils";

export const ACTION = new InjectionToken<ActionMetadata>("ACTION")
export const CONTEXT = new InjectionToken<{ instance: unknown }>("CONTEXT")
export const STORE_CONFIG = new InjectionToken<StoreConfig>("STORE_CONFIG")
export const ROOT_CONFIG = new InjectionToken<StoreConfig>("ROOT_CONFIG", {
   factory() {
      return {}
   }
})
export const EVENTS = new InjectionToken("EVENTS", {
   factory() {
      return new Subject<StoreEvent>()
   }
})

export class EventScheduler {
   events: StoreEvent<any, any, any, any>[] = []
   dispatcher = inject(EVENTS)
   getId = inject(UID)

   schedule(type: EventType, name: string, value: unknown, changes: Map<any, any>) {
      this.events.push({
         id: this.getId(),
         timestamp: Date.now(),
         type,
         context: this.context,
         name,
         value,
         changes
      })
   }

   flush() {
      const events = this.events
      if (events.length) {
         let event
         this.events = []
         while (event = events.shift()) {
            this.dispatcher.next(event)
         }
      }
      return this.events.length > 0
   }

   constructor(private context: {}) {}
}

@Injectable()
export class EffectScheduler {
   source = new Subject<Observable<any>>()
   queue: any[] = []
   operator?: OperatorFunction<Observable<any>, any>
   connected = false
   subscription = Subscription.EMPTY
   pending = new Set
   closed = false

   next(source: Observable<any>) {
      this.connect()
      this.source.next(source)
   }

   enqueue(source: Observable<any>) {
      this.queue.push(source)
   }

   dequeue() {
      let effect: any
      if (this.pending.size === 0) {
         while (effect = this.queue.shift()) {
            this.next(effect)
         }
      }
   }

   connect() {
      if (!this.connected && !this.closed) {
         this.connected = true
         this.subscription = this.source.pipe(this.operator ?? switchAll()).subscribe()
         this.subscription.add(() => this.connected = false)
      }
   }

   addPending(promise: Promise<any>) {
      this.pending.add(promise)
      promise.finally(() => {
         this.pending.delete(promise)
         this.dequeue()
      })
   }

   ngOnDestroy() {
      this.closed = true
      this.source.complete()
      this.subscription.unsubscribe()
   }
}

@Injectable()
export class Teardown {
   subscriptions: Subscription[] = []

   unsubscribe() {
      let subscription
      while (subscription = this.subscriptions.shift()) {
         subscription.unsubscribe()
      }
   }

   ngOnDestroy() {
      this.unsubscribe()
   }
}

export class Changes {
   get value() {
      return track(this.target.__ngSimpleChanges__?.previous) ?? {}
   }

   constructor(private target: any) {}
}

export class StoreErrorHandler implements ErrorHandler {
   handleError(error: unknown) {
      const errorHandlers = getErrorHandlers(this.prototype)
      for (const handler of errorHandlers) {
         try {
            this.instance[handler.key].call(this.instance, error)
            break
         } catch (e) {
            error = e
         }
      }
      throw error
   }

   constructor(private prototype: any, private instance: any) {}
}
