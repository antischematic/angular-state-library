import {ChangeDetectionStrategy, Component, inject, InjectionToken} from "@angular/core"

import {DomSanitizer} from "@angular/platform-browser"
import {Invoke, Select, Store} from "@antischematic/angular-state-library";
import {animationFrameScheduler, interval, map} from "rxjs"

export function calculateScaleX(elapsed: number) {
   const t = (elapsed / 100) % 10
   const scale = 1 + (t > 5 ? 10 - t : t) / 10
   return scale / 2.1
}

export function getTransform(elapsed: number) {
   return `scale(${calculateScaleX(elapsed)}, 0.7) translate3d(0, 0, 0)`
}

const Interval = new InjectionToken("Interval", {
   factory: () => interval(0, animationFrameScheduler)
})

const Counter = new InjectionToken("Counter", {
   factory: () => interval(1000).pipe(
      map(count => 1 + (count % 10)),
   )
})

@Store()
@Component({
   selector: "app-s-triangle",
   templateUrl: "./s-triangle.component.html",
   styleUrls: ["./s-triangle.component.css"],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class STriangleComponent {
   title = "bench"

   @Select(Interval) elapsed = 0

   @Select(Counter) count = 0

   @Select() get transform() {
      return inject(DomSanitizer).bypassSecurityTrustStyle(getTransform(this.elapsed))
   }
}
