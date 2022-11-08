import {ChangeDetectorRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {Observer, Subscribable, Subscription} from "rxjs";
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
   const subscribable = token as any
   const cdr = inject(ChangeDetectorRef) as ViewRef
   if (subscribable) {
      const instance = inject(subscribable) as any
      const subscription = instance.ngOnAttach(new AttachObserver(directive, key, cdr))
      addTeardown(subscription)
   } else {
      const instance = directive[key]
      const subscription = instance.ngOnAttach(new AttachObserver(directive, key, cdr))
      addTeardown(subscription)
   }
}

export interface OnAttach {
   ngOnAttach(observer: Observer<any>): Subscription
}
