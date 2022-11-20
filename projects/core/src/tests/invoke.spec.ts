import {EventLog} from "./fixtures/action/event-log";
import {BasicInvoke} from "./fixtures/invoke/basic-invoke";
import {BatchInvoke} from "./fixtures/invoke/batch-invoke";
import {eventsContaining} from "./utils/event-matcher";
import {render} from "./utils/render";

describe("Invoke", () => {
   it("should dispatch action on first render", async () => {
      const expected = [
         { id: 0, name: "increment" }
      ]
      const { container, fixture } = await render(BasicInvoke, {
         detectChanges: false,
      })

      EventLog.monitor(fixture)
      BasicInvoke.start(fixture)

      expect(container).toHaveTextContent("count: 1")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should only dispatch action once when multiple dependencies change", async () => {
      const expected = [
         { id: 0, name: "read" },
         { id: 1, name: "increment" },
         { id: 2, name: "read" },
         { id: 3, name: "increment" },
         { id: 4, name: "read" },
      ]
      const { container, fixture } = await render(BatchInvoke, {
         detectChanges: false
      })

      EventLog.monitor(fixture)
      BatchInvoke.start(fixture)

      expect(container).toHaveTextContent("read: 1")

      BatchInvoke.increment()
      BatchInvoke.increment()

      expect(container).toHaveTextContent("read: 3")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })
});
