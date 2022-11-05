import {ErrorHandler, inject, Injectable, InjectionToken} from "@angular/core";
import {Observable, OperatorFunction, Subject, Subscription, switchAll} from "rxjs";
import {ActionMetadata, EventType, StoreConfig, StoreEvent} from "./interfaces";
import {track} from "./proxy";
import {EffectError, getId} from "./utils";
import {getErrorHandlers} from "./metadata";

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

export const FLUSHED = new InjectionToken("FLUSH", {
   factory() {
      return new Subject<unknown>()
   }
})

export class EventScheduler {
   events: StoreEvent<any, any, any, any>[] = []
   dispatcher = inject(EVENTS)
   flushed = inject(FLUSHED)

   schedule(type: EventType, name: string, value: unknown) {
      this.events.push({
         id: getId(),
         timestamp: Date.now(),
         type,
         context: this.context,
         name,
         value,
      })
   }

   flush() {
      let event
      if (this.events.length) {
         while (event = this.events.shift()) {
            this.dispatcher.next(event)
         }
         this.flushed.next(this.context)
      }
   }

   constructor(private context: {}) {}
}

@Injectable()
export class EffectScheduler {
   source = new Subject<Observable<any>>()
   queue: any[] = []
   operator?: OperatorFunction<Observable<any>, any>
   destination!: Subject<any>
   connected = false
   subscription = Subscription.EMPTY
   pending = new Set

   next(source: Observable<any>) {
      if (!this.connected) {
         this.connect()
      }
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
      this.connected = true
      this.destination = new Subject()
      this.subscription = this.source.pipe(this.operator ?? switchAll()).subscribe(this.destination)
      this.subscription.add(() => this.connected = false)
   }

   addPending(promise: Promise<any>) {
      this.pending.add(promise)
      promise.finally(() => {
         this.pending.delete(promise)
         this.dequeue()
      })
   }

   ngOnDestroy() {
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
   value = track({}) as any

   setValue(value: any) {
      for (const key in this.value) {
         if (!(key in value)) {
            delete this.value[key]
         }
      }
      Object.assign(this.value, value)
   }
}

export class StoreErrorHandler implements ErrorHandler {
   handleError(error: unknown) {
      const errorHandlers = getErrorHandlers(this.prototype)
      for (const handler of errorHandlers) {
         try {
            return handler.descriptor!.value.call(this.instance, error)
         } catch (e) {
            error = e
         }
      }
      if (error instanceof EffectError) {
         this.parent.handleError(error.error)
      } else {
         throw error
      }
   }

   constructor(private prototype: any, private instance: {}, private parent: ErrorHandler) {}
}
