import {Directive, ElementRef, inject, Input, OnInit, Type} from "@angular/core";
import {BehaviorSubject, PartialObserver} from "rxjs";

@Directive()
export abstract class TemplateProvider implements OnInit {
   private _subject = new BehaviorSubject<this["value"]>(void 0)

   abstract value: unknown

   @Input("value") set __value(value: this["value"]) {
      this._subject.next(value)
   }

   static subscribe<T extends TemplateProvider>(this: Type<T>, observer: PartialObserver<T['value']>) {
      return inject(this)._subject.subscribe(observer)
   }

   ngOnInit() {
      if (this._subject.value === undefined) {
         this._subject.next(this.value)
      }
   }

   constructor() {
      const style = inject(ElementRef).nativeElement?.style
      if (style) style.display = "contents"
   }
}
