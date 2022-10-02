import {ChangeDetectorRef, Component, ErrorHandler} from "@angular/core";
import {ACTION, ActionMetadata, CONTEXT, EffectScheduler, EventScheduler} from "../src/core";
import {TestBed} from "@angular/core/testing";
import {noopTransition, Transition} from "../src/transition";

@Component({
   template: ''
})
export class UIComponent {}

export function runInAction(fn: Function, doneFn?: any) {
   const action: ActionMetadata = {
      key: "test",
      immediate: false,
      descriptor: {}
   }
   TestBed.configureTestingModule({
      providers: [
         { provide: ACTION, useValue: action },
         { provide: CONTEXT, useValue: {} },
         { provide: ChangeDetectorRef, useValue: { markForCheck() {} }},
         { provide: ErrorHandler, useValue: { handleError() {} }},
         { provide: UIComponent, useValue: new UIComponent },
         { provide: fn, useFactory: () => fn(doneFn) },
         { provide: Transition, useValue: noopTransition },
         EventScheduler,
         EffectScheduler,
      ]
   })
   TestBed.inject(fn)
   return
}

export function runTestInAction(fn: (done: Function) => any) {
   return fn.length ? function test(done: any) {
      runInAction(fn, done)
   } : function test() {
      runInAction(fn)
   }
}
