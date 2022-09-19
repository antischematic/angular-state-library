import {untrack} from "./proxy";
import {ActionType} from "./interfaces";
import {EventScheduler} from "./core";
import {getToken} from "./metadata";

export function isPlainObject(obj: object) {
   const proto = Object.getPrototypeOf(obj)
   return proto === null || proto === Object.prototype
}

export function call(target: Record<any, any>, key: string, ...args: any[]) {
   return target[key].apply(target, args)
}

export function wrap(target: { [key: PropertyKey]: any }, key: PropertyKey, fn: (this: any, ...args: any[]) => any) {
   const originalFunction = target[key] ?? noop
   Object.defineProperty(target, key, {
      configurable: true,
      value: function (this: unknown, ...args: any[]) {
         return fn.call(untrack(this), originalFunction, ...args)
      }
   })
}

function noop() {}

let id = 0

export function getId() {
   return id++
}

export function dispatch(type: ActionType, context: {}, name: string, value: unknown) {
   const events = getToken(EventScheduler, context)
   events.push({
      id: getId(),
      timestamp: Date.now(),
      type,
      context,
      name,
      value,
   })
}
