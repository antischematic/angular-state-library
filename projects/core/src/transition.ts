/// <reference path="../../../node_modules/zone.js/zone.d.ts" />

import {Subject} from "rxjs";

export function createTransitionZone(name: PropertyKey, count: Subject<number>) {
   function startTransition(fn: Function): any {
      const zone = Zone.current.fork(new TransitionZoneSpec(name.toString(), count))
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
      if (task.type !== "eventTask") {
         this.properties.count++
      }
      return delegate.scheduleTask(target, task)
   }

   onCancelTask(delegate: ZoneDelegate, currentZone: Zone, target: Zone, task: Task) {
      if (task.type !== "eventTask") {
         this.properties.count--
      }
      return delegate.cancelTask(target, task)
   }

   onInvokeTask(delegate: ZoneDelegate, current: Zone, target: Zone, task: Task, applyThis: any, applyArgs: any[] | undefined) {
      if (task.type !== "eventTask") {
         this.properties.count--
      }
      return delegate.invokeTask(target, task, applyThis, applyArgs)
   }

   onFork(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, zoneSpec: ZoneSpec) {
      return parentZoneDelegate.fork(targetZone, zoneSpec)
   }

   onInvoke(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, delegate: Function, applyThis: any, applyArgs?: any[], source?: string) {
      return parentZoneDelegate.invoke(targetZone, delegate, applyThis, applyArgs, source)
   }

   onIntercept(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, delegate: Function, source: string) {
      return parentZoneDelegate.intercept(targetZone, delegate, source)
   }

   onHasTask() {
      // todo: figure out how to count tasks properly and account for errors and forked zones
      this.properties.count = Math.max(this.properties.count, 0)
      this.done.next(this.properties.count)
   }

   constructor(public name: string, private done: Subject<number>) {
      this.properties = {
         count: 0,
         closed: false,
         spec: this
      }
   }
}

