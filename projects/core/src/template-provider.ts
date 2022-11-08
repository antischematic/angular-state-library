import {Directive, ElementRef, inject, Input, OnInit, ProviderToken} from "@angular/core";
import {PartialObserver, ReplaySubject} from "rxjs";
import {OnAttach} from "./attach";
import {track} from "./proxy";

@Directive()
export abstract class TemplateProvider implements OnInit, OnAttach {
   private _subject = new ReplaySubject<this["value"]>(1)
   private _firstValue = false

   abstract value: unknown

   @Input("value") set __value(value: this["value"]) {
      this._firstValue = true
      this._subject.next(value)
   }

   ngOnInit() {
      if (!this._firstValue) {
         this._subject.next(this.value)
      }
   }

   ngOnAttach<T extends TemplateProvider>(instance: T, observer: PartialObserver<T['value']>) {
      return instance._subject.subscribe(observer)
   }

   constructor() {
      const style = inject(ElementRef).nativeElement?.style
      if (style) style.display = "contents"
   }
}

export function getValue<T extends { value: unknown }>(token: ProviderToken<T>): T["value"] {
   return track(inject(token).value)
}
