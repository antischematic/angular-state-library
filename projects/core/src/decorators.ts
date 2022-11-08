import {ProviderToken} from "@angular/core";
import {
   decorateActions,
   decorateChanges,
   decorateCheck,
   decorateDestroy,
   decorateFactory,
   decorateSelectors,
   decorateSubscribe,
   setup
} from "./core";
import {ActionMetadata, Phase, SelectMetadata} from "./interfaces";
import {action, attach, caught, selector, setMeta} from "./metadata";

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
      decorateDestroy(prototype)

      decorateCheck(prototype, Phase.DoCheck)
      decorateCheck(prototype, Phase.AfterContentChecked)
      decorateCheck(prototype, Phase.AfterViewChecked)

      decorateActions(prototype)
      decorateSelectors(prototype)
      decorateSubscribe(target)
   }
}

export const Action = createDecorator<ActionMetadata>(action, {phase: Phase.DoCheck})
export const Invoke = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.DoCheck})
export const Before = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.AfterContentChecked})
export const Layout = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.AfterViewChecked})
export const Select = createDecorator<SelectMetadata>(selector)
export const Caught = createDecorator(caught)

export function Attach(token?: ProviderToken<any>) {
   return function (target: {}, key: PropertyKey) {
      setMeta(attach, { key, token }, target, key)
   }
}
