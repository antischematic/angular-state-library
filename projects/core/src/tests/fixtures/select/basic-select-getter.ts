import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Action, Select, Store} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
      double: {{ double }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasicSelectWithGetter {
   @Input() count = 0

   @Select() get double() {
      return this.count * 2
   }

   static start(fixture: ComponentFixture<BasicSelectWithGetter>) {
      fixture.autoDetectChanges(true)
   }
}
