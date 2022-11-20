import {Component, ElementRef, inject, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Action, Invoke, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";

@Store()
@Component({
   standalone: true,
   template: `
      count1: {{ count1 }}
      count2: {{ count2 }}
      count3: {{ count3 }}
      read: {{ times }}
      <button (click)="increment()">Increment</button>
   `
})
export class BatchInvoke {
   @Input() count1 = 1
   @Input() count2 = 10
   @Input() count3 = 100

   times = 0

   @Action() increment() {
      this.count1++
      this.count2++
      this.count3++
   }

   @Invoke() read() {
      void this.count1
      void this.count2
      void this.count3
      this.times++
   }

   static start(fixture: ComponentFixture<BatchInvoke>) {
      fixture.autoDetectChanges()
   }

   static increment() {
      fireEvent.click(screen.getByText("Increment"))
   }
}
