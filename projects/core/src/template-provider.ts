import {Directive, ElementRef, inject, Input, OnInit, ProviderToken} from "@angular/core";
import {Observer, PartialObserver, ReplaySubject, Subscription} from "rxjs";
import {OnAttach} from "./attach";
import {track} from "./proxy";

@Directive()
export abstract class TemplateProvider extends ReplaySubject<unknown> implements OnInit {
   private _firstValue = false

   abstract value: unknown

   @Input("value") set __value(value: this["value"]) {
      this._firstValue = true
      this.next(value)
   }

   ngOnInit() {
      if (!this._firstValue) {
         this.next(this.value)
      }
   }

   override subscribe(next: (value: this['value']) => void): Subscription;
   override subscribe(observer?: Partial<Observer<this['value']>>): Subscription
   override subscribe(observer?: any): Subscription {
      return super.subscribe(observer);
   }

   constructor() {
      super(1)
      const style = inject(ElementRef).nativeElement?.style
      if (style) style.display = "contents"
   }
}
