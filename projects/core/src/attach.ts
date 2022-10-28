import {ChangeDetectorRef, ElementRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {decorateFactory} from "./core";
import {getMeta, selector, setMeta} from "./metadata";
import {EVENTS} from "./providers";
import {addDep, track} from "./proxy";
import {getValue} from "./template-provider";

export function attach<T extends {}>(token: ProviderToken<T>, directive?: any, key?: string): T {
   // There is only one change detector per host element, so this is close enough
   const { nativeElement } = inject(ElementRef)
   const instance = inject(token)
   if (!getMeta(selector, token, nativeElement)) {
      setMeta(selector, token, nativeElement)
      const cdr = inject(ChangeDetectorRef) as ViewRef
      const subscription = inject(EVENTS).subscribe((event) => {
         if (cdr.destroyed) subscription.unsubscribe()
         if (event.context === instance) {
            if (directive && key) {
               directive[key] = track(getValue(instance) ?? instance)
            }
            cdr.markForCheck()
         }
      })
   }
   const value = getValue(instance) ?? instance
   const obj = {
      get check() {
         return getValue(instance)
      }
   }
   if (directive && key) {
      directive[key] = value
   }
   addDep(obj, "check", value)
   return track(value)
}

export function Attach(token: ProviderToken<any>) {
   return function (target: any, key: string) {
      decorateFactory(target.constructor, function (target: any, factory: Function, ...args: any[]) {
         const instance = factory(...args)
         attach(token, instance, key)
         return instance
      })
   }
}

