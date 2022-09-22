import {Component} from "@angular/core";
import {ACTION, ActionMetadata, EffectScheduler, EventScheduler, Store} from "../src/core";
import {TestBed} from "@angular/core/testing";

@Component({
   template: ''
})
export class UIComponent {}

export function runInAction(fn: Function) {
   const action: ActionMetadata = {
      key: "test",
      immediate: false,
   }
   TestBed.configureTestingModule({
      providers: [
         EventScheduler,
         EffectScheduler,
         { provide: ACTION, useValue: action },
         { provide: UIComponent, useValue: new UIComponent },
         { provide: fn, useFactory: fn },
      ]
   })
   TestBed.inject(fn)
   return
}

export function runTestInAction(fn: Function) {
   return function test() {
      runInAction(fn)
   }
}
