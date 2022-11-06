/// <reference path="../../../node_modules/zone.js/zone.d.ts" />

import {ChangeDetectorRef, EventEmitter, inject} from "@angular/core";
import {MonoTypeOperatorFunction, Observable, Subject} from "rxjs";

interface TransitionOptions {
   async?: boolean
   slowMs?: number // todo: add implementation
   timeoutMs?: number // todo: add implementation
}

function checkStable(zone: TransitionSpec) {
   if (!zone.microtasks && !zone.macroTasks && !zone.transition.stable) {
      zone.transition.stable = true
      zone.parentZone.run(() => {
         zone.transition.viewRef?.markForCheck()
         zone.transition.onStable.next(-1)
      })
   }
   if ((zone.microtasks || zone.macroTasks) && zone.transition.stable) {
      zone.transition.stable = false
      zone.parentZone.run(() => {
         zone.transition.viewRef?.markForCheck()
         zone.transition.onUnstable.next(1)
      })
   }
}

export class TransitionSpec implements ZoneSpec {
   microtasks = 0
   macroTasks = 0
   parentZone = Zone.current

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

   viewRef = inject(ChangeDetectorRef)
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

export interface UseTransitionOptions {
   emit: boolean
}

export function useTransition<T>(transition?: Transition<T>, options?: { emit: true }): MonoTypeOperatorFunction<T>
export function useTransition<T>(transition?: Transition, options?: { emit: false }): MonoTypeOperatorFunction<T>
export function useTransition<T>(transition?: Transition, options: UseTransitionOptions = { emit: false }): MonoTypeOperatorFunction<T> {
   return source => transition ? new Observable(subscriber => {
      return transition.run(() => {
         if (options.emit) {
            subscriber.add(transition.subscribe(subscriber))
         }
         subscriber.add(source.subscribe(subscriber))
         return subscriber
      })
   }) : source
}
