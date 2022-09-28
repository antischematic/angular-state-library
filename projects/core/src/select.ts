import {ChangeDetectorRef, ElementRef, inject, ProviderToken, ViewRef} from "@angular/core";
import {track} from "./proxy";
import {EVENTS} from "./core";
import {getMeta, selector, setMeta} from "./metadata";

export function select<T extends {}>(token: ProviderToken<T>): T {
   // There is only one change detector per host element, so this is close enough
   const { nativeElement } = inject(ElementRef)
   const instance = inject(token)
   if (!getMeta(selector, token, nativeElement)) {
      setMeta(selector, token, nativeElement)
      const cdr = inject(ChangeDetectorRef) as ViewRef
      const subscription = inject(EVENTS).subscribe((event) => {
         if (cdr.destroyed) subscription.unsubscribe()
         if (event.context === instance) {
            cdr.markForCheck()
         }
      })
   }
   return track(instance)
}
