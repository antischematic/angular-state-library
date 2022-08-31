/// <reference path="../../../node_modules/zone.js/zone.d.ts" />

import {BehaviorSubject, Subject} from "rxjs";

export function createTransitionZone(name: PropertyKey, count: Subject<number>) {
   const zone = Zone.current.fork(new TransitionZoneSpec(name.toString(), count))
   function startTransition(fn: Function): any {
      return zone.run(fn)
   }
   return startTransition
}

export class TransitionZoneSpec implements ZoneSpec {
   properties: {
      count: number,
      closed: boolean
      spec: TransitionZoneSpec
   }

   onHandleError(delegate: ZoneDelegate, current: Zone, target: Zone, error: any) {
      return delegate.handleError(target, error)
   }

   onScheduleTask(delegate: ZoneDelegate, current: Zone, target: Zone, task: Task): Task {
      if (!this.properties.closed) {
         // this.done.next(++this.properties.count)
      }
      return delegate.scheduleTask(target, task)
   }

   onCancelTask(delegate: ZoneDelegate, currentZone: Zone, target: Zone, task: Task) {
      if (!this.properties.closed) {
         // this.done.next(--this.properties.count)
      }
      return delegate.cancelTask(target, task)
   }

   onInvokeTask(delegate: ZoneDelegate, current: Zone, target: Zone, task: Task, applyThis: any, applyArgs: any[] | undefined) {
      if (!this.properties.closed) {
         // this.done.next(--this.properties.count)
      }
      return delegate.invokeTask(target, task, applyThis, applyArgs)
   }

   onHasTask() {
      // no more macrotasks or microtasks left in the queue
      this.done.next(this.properties.count)
      this.properties.count = this.properties.count ? 0 : 1
   }

   constructor(public name: string, private done: Subject<number>) {
      this.properties = {
         count: 0,
         closed: false,
         spec: this
      }
   }
}

