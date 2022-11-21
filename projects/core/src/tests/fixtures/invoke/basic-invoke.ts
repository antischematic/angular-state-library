import {ChangeDetectionStrategy, Component, Input} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {Invoke, Store} from "@antischematic/angular-state-library";

@Store()
@Component({
   standalone: true,
   template: `
      count: {{ count }}
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class BasicInvoke {
   @Input() count = 0

   @Invoke() increment() {
      this.count++
   }

   static start(fixture: ComponentFixture<BasicInvoke>) {
      fixture.detectChanges(true)
   }
}
