import {SimpleChange} from "@angular/core";
import {EventType} from "@antischematic/angular-state-library";
import {EventLog} from "./utils/event-log";
import {BasicInvoke} from "./fixtures/invoke/basic-invoke";
import {BatchInvoke} from "./fixtures/invoke/batch-invoke";
import {ComputedInvoke} from "./fixtures/invoke/computed-invoke";
import {InputInvoke} from "./fixtures/invoke/input-invoke";
import {MultipleInvoke} from "./fixtures/invoke/multiple-invoke";
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

   it("should dispatch actions that depend on the same value when it changes", async () => {
      const expected = [
         { id: 0, name: "one" },
         { id: 1, name: "two" },
         { id: 2, name: "three" },
         { id: 3, name: "ngOnChanges", value: { count: new SimpleChange(undefined, 10, true) }},
         { id: 4, name: "one" },
         { id: 5, name: "two" },
         { id: 6, name: "three" },
      ]
      const { container, fixture, change } = await render(MultipleInvoke, {
         detectChanges: false
      })

      EventLog.monitor(fixture)
      MultipleInvoke.start(fixture)

      expect(container).toHaveTextContent("count: 0")
      expect(container).toHaveTextContent("first: 3")
      expect(container).toHaveTextContent("second: 2")
      expect(container).toHaveTextContent("third: 1")

      change({ count: 10 })

      expect(container).toHaveTextContent("count: 10")
      expect(container).toHaveTextContent("first: 6")
      expect(container).toHaveTextContent("second: 4")
      expect(container).toHaveTextContent("third: 2")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should dispatch action when computed values change", async () => {
      const expected = [
         { id: 0, name: "read" },
         { id: 1, name: "increment" },
         { id: 2, name: "read" },
         { id: 3, name: "increment" },
         { id: 4, name: "read" },
         { id: 5, name: "increment" },
         { id: 6, name: "read" },
      ]
      const { container, fixture } = await render(ComputedInvoke, {
         detectChanges: false
      })

      EventLog.monitor(fixture)
      ComputedInvoke.start(fixture)

      expect(container).toHaveTextContent("sum: 111")
      expect(container).toHaveTextContent("computed: 1")
      expect(container).toHaveTextContent("read: 1")

      ComputedInvoke.increment()
      ComputedInvoke.increment()
      ComputedInvoke.increment()

      expect(container).toHaveTextContent("sum: 120")
      expect(container).toHaveTextContent("computed: 4")
      expect(container).toHaveTextContent("read: 4")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should dispatch action when inputs change", async () => {
      const expected = [
         { id: 0, name: "read", type: EventType.Dispatch },
         { id: 1, name: "ngOnChanges", type: EventType.Dispatch, value: { count: new SimpleChange(undefined, 10, true) }},
         { id: 2, name: "read", type: EventType.Dispatch },
         { id: 3, name: "ngOnChanges", type: EventType.Dispatch, value: { count: new SimpleChange(10, 100, false) }},
         { id: 4, name: "read", type: EventType.Dispatch },
      ]
      const { container, fixture, change } = await render(InputInvoke, {
         detectChanges: false,
      })

      EventLog.monitor(fixture)
      InputInvoke.start(fixture)

      expect(container).toHaveTextContent("read: 1")
      expect(container).toHaveTextContent("count: 1")

      change({ count: 10 })

      expect(container).toHaveTextContent("read: 2")
      expect(container).toHaveTextContent("count: 10")

      change({ count: 100 })

      expect(container).toHaveTextContent("read: 3")
      expect(container).toHaveTextContent("count: 100")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })
});
