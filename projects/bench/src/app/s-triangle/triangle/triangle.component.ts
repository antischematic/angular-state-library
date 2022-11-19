import {ChangeDetectionStrategy, Component, Input} from "@angular/core"
import {Select, Store} from "@antischematic/angular-state-library";

@Store()
@Component({
   selector: "app-triangle",
   templateUrl: "./triangle.component.html",
   styleUrls: ["./triangle.component.css"],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class TriangleComponent {
   @Input() x = 0
   @Input() y = 0
   @Input() s = 0
   @Input() count = 0

   targetSize = 25

   @Select() get halfTargetSize() {
      return this.targetSize / 2
   }

   @Select() get halfS() {
      return this.s / 2
   }

   @Select() get half2S() {
      return this.halfS / 2
   }

   @Select() get isFinal() {
      return this.s < this.targetSize
   }
}
