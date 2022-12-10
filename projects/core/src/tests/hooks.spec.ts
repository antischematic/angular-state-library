import {tick} from "@angular/core/testing";
import {EventType} from "@antischematic/angular-state-library";
import {render} from "@testing-library/angular";
import {UseConcat} from "./fixtures/hooks/use-concat";
import {UseExhaust} from "./fixtures/hooks/use-exhaust";
import {UseMerge} from "./fixtures/hooks/use-merge";
import {UseSwitch} from "./fixtures/hooks/use-switch";
import {EventLog} from "./utils/event-log";
import {eventsContaining} from "./utils/event-matcher";
import {withFakeAsync} from "./utils/with-fake-async";

describe("hooks", () => {
   it("should switch between dispatched effects", async () => {
      const expected = [
         { id: 0, name: "next", type: EventType.Dispatch },
         { id: 1, name: "next", type: EventType.Dispatch },
         { id: 2, name: "next", type: EventType.Dispatch },
         { id: 3, name: "next", type: EventType.Next },
         { id: 4, name: "next", type: EventType.Complete },
      ]
      const { container, fixture } = await render(UseSwitch)

      EventLog.monitor(fixture)

      const error = withFakeAsync(() => {
         UseSwitch.next()
         UseSwitch.next()
         UseSwitch.next()
         tick(1000)
      })

      expect(error).toBeNull()
      expect(container).toHaveTextContent("results: [3]")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should merge dispatched effects", async () => {
      const expected = [
         { id: 0, name: "next", type: EventType.Dispatch },
         { id: 1, name: "next", type: EventType.Dispatch },
         { id: 2, name: "next", type: EventType.Dispatch },
         { id: 3, name: "next", type: EventType.Next },
         { id: 4, name: "next", type: EventType.Complete },
         { id: 5, name: "next", type: EventType.Next },
         { id: 6, name: "next", type: EventType.Complete },
         { id: 7, name: "next", type: EventType.Next },
         { id: 8, name: "next", type: EventType.Complete },
      ]
      const { container, fixture } = await render(UseMerge)

      EventLog.monitor(fixture)

      const error = withFakeAsync(() => {
         UseMerge.next()
         UseMerge.next()
         UseMerge.next()
         tick(1000)
      })

      expect(error).toBeNull()
      expect(container).toHaveTextContent("results: [1 2 3]")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })



   it("should merge dispatched effects with max concurrent", async () => {
      const expected = [
         { id: 0, name: "next", type: EventType.Dispatch },
         { id: 1, name: "next", type: EventType.Dispatch },
         { id: 2, name: "next", type: EventType.Dispatch },
         { id: 3, name: "next", type: EventType.Next },
         { id: 4, name: "next", type: EventType.Complete },
         { id: 5, name: "next", type: EventType.Next },
         { id: 6, name: "next", type: EventType.Complete },
         { id: 7, name: "next", type: EventType.Next },
         { id: 8, name: "next", type: EventType.Complete },
      ]
      const { container, fixture } = await render(UseMerge)

      EventLog.monitor(fixture)

      const error = withFakeAsync(() => {
         UseMerge.next(2)
         UseMerge.next(2)
         UseMerge.next(2)
         tick(1000)

         expect(container).toHaveTextContent("results: [1 2]")

         tick(1000)

         expect(container).toHaveTextContent("results: [1 2 3]")
      })

      expect(error).toBeNull()
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should concat dispatched effects", async () => {
      const expected = [
         { id: 0, name: "next", type: EventType.Dispatch },
         { id: 1, name: "next", type: EventType.Dispatch },
         { id: 2, name: "next", type: EventType.Dispatch },
         { id: 3, name: "next", type: EventType.Next },
         { id: 4, name: "next", type: EventType.Complete },
         { id: 5, name: "next", type: EventType.Next },
         { id: 6, name: "next", type: EventType.Complete },
         { id: 7, name: "next", type: EventType.Next },
         { id: 8, name: "next", type: EventType.Complete },
      ]
      const { container, fixture } = await render(UseConcat)

      EventLog.monitor(fixture)

      const error = withFakeAsync(() => {
         UseConcat.next()
         UseConcat.next()
         UseConcat.next()
         tick(1000)

         expect(container).toHaveTextContent("results: [1]")

         tick(1000)

         expect(container).toHaveTextContent("results: [1 2]")

         tick(1000)

         expect(container).toHaveTextContent("results: [1 2 3]")
      })

      expect(error).toBeNull()
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should exhaust dispatched effects", async () => {
      const expected = [
         { id: 0, name: "next", type: EventType.Dispatch },
         { id: 1, name: "next", type: EventType.Dispatch },
         { id: 2, name: "next", type: EventType.Dispatch },
         { id: 3, name: "next", type: EventType.Next },
         { id: 4, name: "next", type: EventType.Complete },
      ]
      const { container, fixture } = await render(UseExhaust)

      EventLog.monitor(fixture)

      const error = withFakeAsync(() => {
         UseExhaust.next()
         UseExhaust.next()
         UseExhaust.next()
         tick(1000)
      })

      expect(container).toHaveTextContent("results: [1]")
      expect(error).toBeNull()
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })
})
