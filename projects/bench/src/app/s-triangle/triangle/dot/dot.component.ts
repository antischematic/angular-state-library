import {ChangeDetectionStrategy, Component, HostBinding, InjectionToken, Input} from "@angular/core"
import {Select, Store} from "@antischematic/angular-state-library";
import {interval, map} from "rxjs";

function calcStyle(size: number, x: number, y: number) {
   const s = size * 1.3
   return `width: ${s}px; height: ${s}px; left: ${x}px; top: ${y}px; border-radius: ${
      s / 2
   }px; line-height: ${s}px;`
}

@Store()
@Component({
   selector: "app-dot",
   templateUrl: "./dot.component.html",
   styleUrls: ["./dot.component.css"],
   host: {
      "(mouseover)": "hover = true",
      "(mouseleave)": "hover = false",
      "[style]": "style",
   },
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class DotComponent {
   @Input() x = 0
   @Input() y = 0
   @Input() size = 0
   @Input() count = 0

   @HostBinding("class.hover") hover = false

   @Select() get style() {
      return calcStyle(this.size, this.x, this.y)
   }
}
