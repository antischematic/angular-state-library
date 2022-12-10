import {tick} from "@angular/core/testing";
import {render} from "@testing-library/angular";
import {BasicMutation} from "./fixtures/data/basic-mutation";
import {BasicQuery} from "./fixtures/data/basic-query";
import {EventLog} from "./utils/event-log";
import {withFakeAsync} from "./utils/with-fake-async";

describe("Data", () => {
   it("should emit cached results", async () => {
      const { container, fixture, changeInput } = await render(BasicQuery, {
         detectChangesOnRender: false,
         autoDetectChanges: false,
         componentInputs: {
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

         changeInput({ multiplier: 10 })
         tick(1000)

         expect(container).toHaveTextContent("multiplier: 10")
         expect(container).toHaveTextContent("result: [100]")

         changeInput({ multiplier: 5 })

         expect(container).toHaveTextContent("multiplier: 5")
         expect(container).toHaveTextContent("result: [50]")
      })

      expect(error).toBeNull()
   })

   it("should invalidate cached results", async () => {
      const { container, fixture } = await render(BasicMutation, {
         detectChangesOnRender: false,
         autoDetectChanges: false,
         componentInputs: {
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
