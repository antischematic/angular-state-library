import {Directive, ElementRef, inject, Input} from "@angular/core";
import {Store} from "./decorators";

@Store()
@Directive()
export class TemplateProvider {
   @Input("value") set __value__(value: Omit<this, "__value__">) {
      values.set(this, value)
   }
   constructor() {
      const style = inject(ElementRef).nativeElement?.style
      if (style) style.display = "contents"
      values.set(this, this)
   }
}

const values = new WeakMap

export function getValue(instance: any) {
   return values.get(instance)
}
