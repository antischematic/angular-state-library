import {ProviderToken} from "@angular/core";
import {Observable} from "rxjs";
import {
   decorateActions,
   decorateChanges,
   decorateCheck,
   decorateDestroy,
   decorateFactory,
   decorateSelectors,
   decorateSelect,
   setup, decorateOnInit
} from "./core";
import {ActionMetadata, Phase} from "./interfaces";
import {action, caught, selector, setMeta} from "./metadata";

const defaults = {track: true, immediate: true}

export function createDecorator<T extends {}>(symbol: symbol, defaults = {}) {
   return function decorate(options?: T) {
      return function (target: {}, key: PropertyKey, descriptor?: PropertyDescriptor) {
         setMeta(symbol, {...defaults, ...options, key, descriptor}, target, key)
      }
   }
}

export function Store() {
   return function (target: Function) {
      const {prototype} = target

      decorateFactory(target, setup)
      decorateChanges(prototype)
      decorateOnInit(prototype)
      decorateDestroy(prototype)

      decorateCheck(prototype, Phase.DoCheck)
      decorateCheck(prototype, Phase.AfterContentChecked)
      decorateCheck(prototype, Phase.AfterViewChecked)

      decorateActions(prototype)
      decorateSelectors(prototype)
      decorateSelect(target)
   }
}

export const Action = createDecorator<ActionMetadata>(action, {phase: Phase.DoCheck})
export const Invoke = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.DoCheck})
export const Before = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.AfterContentChecked})
export const Layout = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.AfterViewChecked})

export function Caught() {
   return function (target: {}, key: PropertyKey, descriptor: PropertyDescriptor) {
      setMeta(action, { key, descriptor, phase: Phase.DoCheck, catchError: false }, target, key)
      setMeta(caught, { key, descriptor }, target, key)
   }
}

export function Select(): (target: {}, key: PropertyKey, descriptor?: PropertyDescriptor) => void
export function Select(token: ProviderToken<any>): (target: {}, key: PropertyKey, descriptor: void) => void
export function Select(token?: ProviderToken<any>) {
   return function (target: {}, key: PropertyKey, descriptor: any) {
      setMeta(selector, { key, token, descriptor }, target, key)
   }
}

export type Action<TFunction extends (...params: any[]) => void = () => void> = TFunction

export type Select<T> = {
   [key in keyof T]: Observable<T[key]>
}
