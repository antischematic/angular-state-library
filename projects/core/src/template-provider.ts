import {Directive, ElementRef, inject, Input} from "@angular/core";
import {Store} from "./decorators";

@Store()
@Directive()
export class TemplateProvider{
   @Input("value") set __value__(value: Omit<this, "__value__">) {
      Object.assign(this, value)
      for (const key in this) {
         if (!(key in value) && !key.startsWith("__")) {
            delete (<any>this)[key]
         }
      }
   }
   constructor() {
      const style = inject(ElementRef).nativeElement?.style
      if (style) style.display = "contents"
   }
}

