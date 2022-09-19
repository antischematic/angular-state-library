import {AfterViewInit, Directive, ElementRef, inject, OnDestroy} from "@angular/core";

@Directive()
export class Fragment implements AfterViewInit, OnDestroy {
   __element__ = inject(ElementRef).nativeElement
   __nodes__: ChildNode[] = []

   ngAfterViewInit() {
      const el = this.__element__
      const parent = el.parentNode;
      this.__nodes__ = [...el.childNodes]

      while (el.firstChild) parent.insertBefore(el.firstChild, el);

      parent.removeChild(el);
   }

   ngOnDestroy() {
      for (const node of this.__nodes__) node.remove()
   }
}
