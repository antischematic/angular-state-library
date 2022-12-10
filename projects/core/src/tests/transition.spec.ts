import {discardPeriodicTasks, tick} from "@angular/core/testing";
import {render} from "@testing-library/angular";
import {SlowTransition} from "./fixtures/transition/slow-transition";
import {TimeoutTransition} from "./fixtures/transition/timeout-transition";
import {UseTransition} from "./fixtures/transition/use-transition";
import {withFakeAsync} from "./utils/with-fake-async";

describe("Transition", () => {
   it("should run in transition zone", async () => {
      const { container } = await render(UseTransition)

      const error = withFakeAsync(() => {
         UseTransition.start()

         expect(container).toHaveTextContent("loading: true")
         expect(container).toHaveTextContent("press: true")

         tick(1000)

         expect(container).toHaveTextContent("loading: false")
         expect(container).toHaveTextContent("press: false")

         UseTransition.start()

         expect(container).toHaveTextContent("loading: true")
         expect(container).toHaveTextContent("press: true")

         tick(1000)

         expect(container).toHaveTextContent("loading: false")
         expect(container).toHaveTextContent("press: false")

      })

      expect(error).toBeNull()
   })

   it("should mark the transition as slow", async () => {
      const { container } = await render(SlowTransition)

      const error = withFakeAsync(() => {
         UseTransition.start()

         expect(container).toHaveTextContent("slow: false")
         expect(container).toHaveTextContent("loading: true")
         expect(container).toHaveTextContent("press: true")

         tick(500)

         expect(container).toHaveTextContent("slow: true")
         expect(container).toHaveTextContent("loading: true")
         expect(container).toHaveTextContent("press: true")

         tick(500)

         expect(container).toHaveTextContent("slow: false")
         expect(container).toHaveTextContent("loading: false")
         expect(container).toHaveTextContent("press: false")

      })

      expect(error).toBeNull()
   })

   it("should timeout the transition", async () => {
      const { container } = await render(TimeoutTransition)

      const error = withFakeAsync(() => {
         TimeoutTransition.start()

         expect(container).toHaveTextContent("timeout: false")
         expect(container).toHaveTextContent("press: true")

         tick(500)

         expect(container).toHaveTextContent("error: Transition timed out after 500ms")
         expect(container).toHaveTextContent("timeout: true")
         expect(container).toHaveTextContent("press: false")
      })

      expect(error).toBeNull()
   })
})
