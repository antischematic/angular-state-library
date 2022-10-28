import {ɵɵstores as stores, ɵɵdecorateFactory as decorateFactory } from "@antischematic/angular-state-library"
import {NgModule} from "@angular/core";
import {TestBed} from "@angular/core/testing";

declare var beforeEach: any, afterEach: any

function processStores() {
   for (const store of stores) {
      Object.defineProperty(store, "ɵfac", {configurable: true, value: store["ɵfac"]})
      // decorateFactory(store)
   }
}

@NgModule()
class StoreTestingModule {
   constructor() {
      processStores()
   }
}

export function initStoreTestEnvironment() {
   beforeEach(() => {
      TestBed.configureTestingModule({
         imports: [StoreTestingModule]
      })
   })
   afterEach(() => {
      stores.clear()
   })
}
