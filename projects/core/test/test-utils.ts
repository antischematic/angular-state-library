import {ChangeDetectorRef, Component, EnvironmentInjector, ErrorHandler} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {injector, setMeta} from "../src/metadata";
import {ACTION, CONTEXT, EffectScheduler, EventScheduler} from "../src/providers";
import {ActionMetadata, Metadata} from "../src/interfaces";

@Component({
   template: ''
})
export class UIComponent {}

export function runInAction(fn: Function, doneFn?: any) {
   const action: Metadata<ActionMetadata> = {
      key: "test",
      immediate: false,
      descriptor: {}
   }
   const context = {}

   TestBed.configureTestingModule({
      providers: [
         { provide: ACTION, useValue: action },
         { provide: CONTEXT, useValue: { instance: context } },
         { provide: ChangeDetectorRef, useValue: { markForCheck() {} }},
         { provide: ErrorHandler, useValue: { handleError() {} }},
         { provide: UIComponent, useValue: new UIComponent },
         { provide: fn, useFactory: () => fn(doneFn) },
         { provide: EventScheduler, useFactory: () => new EventScheduler(context) },
         EffectScheduler,
      ]
   })
   setMeta(injector, TestBed.inject(EnvironmentInjector), context, "test")
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
