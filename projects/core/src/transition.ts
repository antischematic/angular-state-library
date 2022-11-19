/// <reference path="../../../node_modules/zone.js/zone.d.ts" />

import {EventEmitter, InjectionToken} from "@angular/core";
import {
   BehaviorSubject,
   map, merge,
   MonoTypeOperatorFunction,
   Observable, Observer,
   PartialObserver,
   Subject, Subscription,
   takeWhile
} from "rxjs";
import {OnSelect} from "./select";

interface TransitionOptions {
   async?: boolean
   slowMs?: number
   timeoutMs?: number
   resetOnSuccess?: boolean
   cancelPrevious?: boolean
}

function handleError(transition: Transition) {
   if (transition.failed) {
      transition.onError.next(transition.thrownError)
   } else if (transition.resetOnSuccess) {
      transition.retryCount = 0
   }
}

function checkStable({ transition, microtasks, macroTasks, parentZone, timeout }: TransitionSpec) {
   const { isUnstable } = transition
   const { slowMs, timeoutMs, slow, isSlow } = transition
   if (!microtasks && !macroTasks && !transition.stable) {
      clearTimeout(timeout.timeoutId)
      clearTimeout(timeout.slowId)
      parentZone.run(() => {
         handleError(transition)
         if (slow) {
            isSlow.next(false)
         }
         isUnstable.next(false)
      })
   }
   if ((microtasks || macroTasks) && transition.stable) {
      if (transition.failed) {
         transition.retryCount++
      }
      transition.failed = false
      transition.timeout = false
      transition.thrownError = null
      parentZone.run(() => {
         isUnstable.next(true)
         if (slowMs) {
            timeout.slowId = setTimeout(() => {
               transition.isSlow.next(true)
            }, slowMs)
         }
         if (timeoutMs) {
            timeout.timeoutId = setTimeout(() => {
               transition.failed = true
               transition.timeout = true
               transition.thrownError = new Error(`Transition timed out after ${timeoutMs}ms`)
               transition.cancel()
               handleError(transition)
            }, timeoutMs)
         }
      })
   }
}

export class TransitionSpec implements ZoneSpec {
   microtasks = 0
   macroTasks = 0
   parentZone = Zone.current
   tasks = new Set<Task>()
   timeout = {} as any

   onScheduleTask(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, task: Task) {
      this.tasks.add(task)
      return parentZoneDelegate.scheduleTask(targetZone, task)
   }

   onInvokeTask(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, task: Task, applyThis: any, applyArgs?: any[]) {
      this.tasks.delete(task)
      return parentZoneDelegate.invokeTask(targetZone, task, applyThis, applyArgs)
   }

   onCancelTask(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, task: Task) {
      this.tasks.delete(task)
      return parentZoneDelegate.cancelTask(targetZone, task)
   }

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
      return parentZoneDelegate.hasTask(targetZone, hasTaskState)
   }

   onHandleError(parentZoneDelegate: ZoneDelegate, currentZone: Zone, targetZone: Zone, error: any) {
      this.transition.failed = true
      this.transition.thrownError = error
      return parentZoneDelegate.handleError(targetZone, error)
   }

   cancelTasks() {
      for (const task of this.tasks) {
         task.cancelFn?.(task)
      }
      this.microtasks = 0
      this.macroTasks = 0
      checkStable(this)
   }

   constructor(public name: string, public transition: Transition<any>) {}
}

export class Transition<T = unknown> implements OnSelect {
   private readonly spec: TransitionSpec = new TransitionSpec("transition", this)
   private readonly emitter: EventEmitter<T>

   readonly timeoutMs: number
   readonly slowMs: number
   readonly resetOnSuccess: boolean
   readonly isUnstable = new BehaviorSubject<boolean>(false)
   readonly isSlow = new BehaviorSubject<boolean>(false)
   readonly onError = new Subject<unknown>()

   timeout = false
   failed = false
   retryCount = 0
   thrownError: unknown = null

   get stable() {
      return !this.unstable
   }

   get unstable() {
      return this.isUnstable.value
   }

   get slow() {
      return this.isSlow.value
   }

   next(value: T) {
      this.run(this.emitter.next, this.emitter, value)
   }

   error(error: unknown) {
      this.run(this.emitter.error, this.emitter, error)
   }

   complete() {
      this.run(this.emitter.complete, this.emitter)
   }

   emit(value: T) {
      this.run(this.emitter.emit, this.emitter, value)
      return this.isUnstable.pipe(
         takeWhile(Boolean)
      )
   }

   cancel() {
      this.spec.cancelTasks()
   }

   subscribe(next: (value: T) => void): Subscription;
   subscribe(observer?: Partial<Observer<T>>): Subscription
   subscribe(observer?: any): Subscription {
      return this.emitter.subscribe(observer);
   }

   run<T extends (...args: any[]) => any>(fn: Function, applyThis?: {}, ...applyArgs: Parameters<T>): ReturnType<T> {
      const zone = Zone.current.fork(this.spec)
      if (this.options.cancelPrevious) {
         this.cancel()
      }
      return zone.runGuarded(fn, applyThis, applyArgs)
   }

   ngOnSelect(observer: PartialObserver<any>) {
      return merge(this.isUnstable, this.isSlow).pipe(map(() => this)).subscribe(observer)
   }

   constructor(private options: TransitionOptions = {}) {
      this.emitter = new EventEmitter<T>(options.async)
      this.slowMs = options.slowMs ?? 0
      this.timeoutMs = options.timeoutMs ?? 0
      this.resetOnSuccess = options.resetOnSuccess ?? false
   }
}

export interface UseTransitionOptions {
   emit: boolean
}

export function useTransition<T>(transition?: Transition<T>, options?: { emit: true }): MonoTypeOperatorFunction<T>
export function useTransition<T>(transition?: Transition, options?: { emit: false }): MonoTypeOperatorFunction<T>
export function useTransition<T>(transition?: Transition, options: UseTransitionOptions = { emit: false }): MonoTypeOperatorFunction<T> {
   return source => transition ? new Observable<any>(subscriber => {
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
