import {tick} from "@angular/core/testing";
import {UseTransition} from "./fixtures/transition/use-transition";
import {render} from "./utils/render";
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
})
