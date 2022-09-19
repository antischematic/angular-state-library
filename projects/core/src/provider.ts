import {Directive, Input, OnChanges, SimpleChanges} from "@angular/core";
import {Fragment} from "./fragment";
import {Store} from "./core";

@Store()
@Directive()
export class Provider extends Fragment implements OnChanges {
   @Input("value") set __value__(_: Omit<this, "__value__" | "__element__" | "__nodes__" | "ngOnChanges" | "ngAfterViewInit" | "ngOnDestroy">) {}

   ngOnChanges(this: any, { __value__ }: SimpleChanges) {
      if (__value__) {
         for (const key of Object.keys(this)) {
            if (!(key in __value__)) {
               if (Object.prototype.hasOwnProperty.call(this, key) && !key.startsWith("__")) {
                  delete this[key]
               }
            }
         }
         Object.assign(this, __value__.currentValue)
      }
   }
}
