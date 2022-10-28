import {
   decorateActions,
   decorateChanges,
   decorateCheck,
   decorateDestroy,
   decorateFactory,
   decorateSelectors,
   setup
} from "./core";
import {ActionMetadata, Metadata, Phase, SelectMetadata, StatusMetadata} from "./interfaces";
import {action, caught, getStatuses, selector, setMeta, status} from "./metadata";

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
      const statuses = getStatuses(target.prototype).reduce((map, next) => map.set(next.action, next), new Map<string | undefined, Metadata<StatusMetadata>>())

      decorateFactory(target, setup, statuses)
      decorateChanges(prototype)
      decorateDestroy(prototype)

      decorateCheck(prototype, Phase.DoCheck)
      decorateCheck(prototype, Phase.AfterContentChecked)
      decorateCheck(prototype, Phase.AfterViewChecked)

      decorateActions(prototype)
      decorateSelectors(prototype)
   }
}

export const Action = createDecorator<ActionMetadata>(action, {phase: Phase.DoCheck})
export const Invoke = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.DoCheck})
export const Before = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.AfterContentChecked})
export const Layout = createDecorator<ActionMetadata>(action, {...defaults, phase: Phase.AfterViewChecked})
export const Select = createDecorator<SelectMetadata>(selector)
export const Caught = createDecorator(caught)
export const Status = createDecorator<{ action?: string }>(status)
