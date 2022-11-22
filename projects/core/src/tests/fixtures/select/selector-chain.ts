import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {$$, Action, Select, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      sum: {{ sum }}
      read: {{ read }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectorChain {
   @Input() count = 0

   read = 0

   @Select() get double() {
      $$(this).read++
      return this.count * 2
   }

   @Select() get plusOne() {
      $$(this).read++
      return this.count + 1
   }

   @Select() get sum() {
      $$(this).read++
      return this.double + this.plusOne
   }

   static start(fixture: ComponentFixture<SelectorChain>) {
      fixture.autoDetectChanges(true)
   }
}
