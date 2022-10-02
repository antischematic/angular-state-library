/// <reference path="../../../node_modules/zone.js/zone.d.ts" />

import {EMPTY, Subject} from "rxjs";
import {ChangeDetectorRef, EventEmitter, inject} from "@angular/core";

interface TransitionOptions {
   async?: boolean
}

function checkStable(zone: TransitionSpec) {
   if (!zone.microtasks && !zone.macroTasks && !zone.transition.stable) {
      zone.transition.stable = true
      zone.transition.onStable.next(-1)
      zone.changeDetector.detectChanges()
   }
   if ((zone.microtasks || zone.macroTasks) && zone.transition.stable) {
      zone.transition.stable = false
      zone.transition.onUnstable.next(1)
      zone.changeDetector.detectChanges()
   }
}

export class TransitionSpec implements ZoneSpec {
   changeDetector = inject(ChangeDetectorRef)
   microtasks = 0
   macroTasks = 0

   onHasTask(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, hasTaskState: HasTaskState) {
      if (currentZone === targetZone) {
         if (hasTaskState.change === "microTask") {
            this.microtasks += hasTaskState.microTask ? 1 : -1
            checkStable(this)
         } else if (hasTaskState.change === "macroTask") {
            this.macroTasks += hasTaskState.macroTask ? 1 : -1
            checkStable(this)
         }
      }
   }

   onHandleError(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, error: any) {
      parentZoneDelegate.handleError(targetZone, error)
      this.transition.onError.next(error)
      return false
   }

   constructor(public name: string, public transition: Transition<any>) {}
}

export class Transition<T = unknown> extends EventEmitter<T> {
   private spec: ZoneSpec = new TransitionSpec("transition", this)

   onStable = new Subject<-1>()
   onUnstable = new Subject<1>()
   onError = new Subject<unknown>()
   stable = true

   get unstable() {
      return !this.stable
   }

   override next(value: T) {
      this.run(super.next, this, value)
   }

   override error(error: unknown) {
      this.run(super.error, this, error)
   }

   override complete() {
      this.run(super.complete, this)
   }

   override emit(value: T) {
      this.run(super.emit, this, value)
   }

   run<T extends (...args: any[]) => any>(fn: Function, applyThis?: {}, ...applyArgs: Parameters<T>): ReturnType<T> {
      const zone = Zone.current.fork(this.spec)
      return zone.run(fn, applyThis, applyArgs)
   }

   constructor(options: TransitionOptions = {}) {
      super(options.async)
   }
}

export class NoopTransition {
   run(fn: Function, applyThis?: {}, ...applyArgs: any[]) {
      return fn.apply(applyThis, applyArgs)
   }
}

export const noopTransition = new NoopTransition()
