/// <reference path="../../../node_modules/zone.js/zone.d.ts" />

import {EventEmitter, inject, Injectable, InjectionToken} from "@angular/core";
import {
   BehaviorSubject, map,
   MonoTypeOperatorFunction,
   Observable,
   PartialObserver,
   Subject
} from "rxjs";

interface TransitionOptions {
   async?: boolean
   slowMs?: number // todo: add implementation
   timeoutMs?: number // todo: add implementation
}

function checkStable({ transition, microtasks, macroTasks, parentZone }: TransitionSpec) {
   const unstable = (transition.onUnstable as BehaviorSubject<boolean>)
   if (!microtasks && !macroTasks && !transition.stable) {
      transition.stable = true
      parentZone.run(() => {
         unstable.next(false)
      })
   }
   if ((microtasks || macroTasks) && transition.stable) {
      transition.stable = false
      parentZone.run(() => {
         unstable.next(true)
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

   onUnstable: Observable<boolean> = new BehaviorSubject<boolean>(true)
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

   static ngOnAttach(instance: Transition, observer: PartialObserver<any>) {
      return instance.onUnstable.pipe(map(() => instance)).subscribe(observer)
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

interface TransitionToken {
   new<T>(name: string, options?: TransitionOptions): InjectionToken<Transition<T>>
}

export const TransitionToken: TransitionToken = class TransitionToken<T> extends InjectionToken<Transition<T>> {
   constructor(name: string, options?: TransitionOptions) {
      super(name, {
         factory() {
            return new Transition(options)
         }
      })
   }
}
