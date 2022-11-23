import {tick} from "@angular/core/testing";
import {BasicMutation} from "./fixtures/data/basic-mutation";
import {BasicQuery} from "./fixtures/data/basic-query";
import {EventLog} from "./utils/event-log";
import {render} from "./utils/render";
import {withFakeAsync} from "./utils/with-fake-async";

describe("Data", () => {
   it("should emit cached results", async () => {
      const { container, fixture, change } = await render(BasicQuery, {
         detectChanges: false,
         componentProperties: {
            multiplier: 5
         }
      })

      const error = withFakeAsync(() => {
         EventLog.monitor(fixture)
         BasicQuery.start(fixture)

         expect(container).toHaveTextContent("multiplier: 5")
         expect(container).toHaveTextContent("result: [0]")

         tick(1000)

         expect(container).toHaveTextContent("multiplier: 5")
         expect(container).toHaveTextContent("result: [50]")

         change({ multiplier: 10 })
         tick(1000)

         expect(container).toHaveTextContent("multiplier: 10")
         expect(container).toHaveTextContent("result: [100]")

         change({ multiplier: 5 })

         expect(container).toHaveTextContent("multiplier: 5")
         expect(container).toHaveTextContent("result: [50]")
      })

      expect(error).toBeNull()
   })

   it("should invalidate cached results", async () => {
      const { container, fixture, change } = await render(BasicMutation, {
         detectChanges: false,
         componentProperties: {
            multiplier: 5
         }
      })

      const error = withFakeAsync(() => {
         EventLog.monitor(fixture)
         BasicMutation.start(fixture)
         tick(1000)

         expect(container).toHaveTextContent("multiplier: 5")
         expect(container).toHaveTextContent("result: [50]")

         BasicMutation.mutate()
         tick(1000)

         expect(container).toHaveTextContent("multiplier: 5")
         expect(container).toHaveTextContent("result: [100]")
      })

      expect(error).toBeNull()
   })
})
