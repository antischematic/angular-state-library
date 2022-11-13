import {ChangeDetectorRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {Observer, Subscription} from "rxjs";
import {addTeardown} from "./hooks";
import {track} from "./proxy";

class AttachObserver {
   next(value: any) {
      this.target[this.key] = track(value)
      this.cdr.markForCheck()
   }
   error() {}
   complete() {}
   constructor(private target: any, private key: any, private cdr: ChangeDetectorRef) {}
}

export function attach<T extends {}>(token: ProviderToken<T> | undefined, directive: any, key: string): any {
   const cdr = inject(ChangeDetectorRef) as ViewRef
   const instance =  token ? inject(token) : directive[key]
   const observer = new AttachObserver(directive, key, cdr)
   const subscription = instance.ngOnAttach?.(observer) ?? instance.subscribe?.(observer)
   if (!subscription) {
      console.error('Directive:', directive)
      console.error('Key:', key)
      console.error('Object:', instance)
      throw new Error(`Object does not implement OnAttach or Subscribable interfaces`)
   }
   addTeardown(subscription)
}

export interface OnAttach {
   ngOnAttach(observer: Observer<any>): Subscription
}
