import {Directive, Input, OnChanges, SimpleChanges} from "@angular/core";
import {Fragment} from "./fragment";

@Directive()
export class Provider extends Fragment implements OnChanges {
   @Input("value") set __value__(_: Omit<this, "__value__">) {}

   ngOnChanges(this: any, { __value__ }: SimpleChanges) {
      if (__value__) {
         for (const key of Object.keys(this)) {
            if (!(key in __value__)) {
               delete this[key]
            }
         }
         Object.assign(this, __value__)
      }
   }
}
