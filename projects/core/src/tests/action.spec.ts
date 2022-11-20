import {configureStore, EventType} from "@antischematic/angular-state-library";
import {render} from "@testing-library/angular";
import {BasicAction} from "./fixtures/basic-action.component";
import {
   DispatchActionsInCallOrder,
   DispatchActionsInCallOrderWithEffect, DispatchActionsInCallOrderWithEffectError
} from "./fixtures/dispatch-actions-in-order.component";
import {DispatchAfterSubscribe} from "./fixtures/dispatch-after-subscribe";
import {EventLog} from "./fixtures/event-log";
import {
   InjectableAction,
   InjectableActionWithEffect,
   InjectableActionWithEffectError
} from "./fixtures/injectable-action";
import {eventsContaining} from "./utils/event-matcher";
// noinspection ES6UnusedImports
import {pretty} from "./utils/pretty";
import {withFakeAsync} from "./utils/with-fake-async";

describe("Action", () => {
   it("should dispatch events", async () => {
      const expected = [
         { id: 1, name: "increment", type: EventType.Dispatch },
         { id: 2, name: "increment", type: EventType.Dispatch },
         { id: 3, name: "increment", type: EventType.Dispatch },
      ]
      const { container, fixture } = await render(BasicAction)

      EventLog.monitor(fixture)
      BasicAction.start()
      BasicAction.start()
      BasicAction.start()

      expect(container).toHaveTextContent("count: 3")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should dispatch actions in order they are called", async () => {
      const expected = [
         { id: 1, name: "start", type: EventType.Dispatch },
         { id: 2, name: "next", type: EventType.Dispatch },
         { id: 3, name: "next", type: EventType.Dispatch },
         { id: 4, name: "next", type: EventType.Dispatch },
         { id: 5, name: "finally", type: EventType.Dispatch }
      ]
      const { container, fixture } = await render(DispatchActionsInCallOrder)

      EventLog.monitor(fixture)
      DispatchActionsInCallOrder.start()

      expect(container).toHaveTextContent("count: 5")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should dispatch actions in order they are called with effect", async () => {
      const expected = [
         { id: 1, name: "start", type: EventType.Dispatch },
         { id: 2, name: "start", type: EventType.Next, value: 1 },
         { id: 3, name: "setCount", type: EventType.Dispatch, value: 1 },
         { id: 4, name: "start", type: EventType.Next, value: 2 },
         { id: 5, name: "setCount", type: EventType.Dispatch, value: 2 },
         { id: 6, name: "start", type: EventType.Next, value: 3 },
         { id: 7, name: "setCount", type: EventType.Dispatch, value: 3 },
         { id: 8, name: "start", type: EventType.Complete },
         { id: 9, name: "setComplete", type: EventType.Dispatch },
         { id: 10, name: "finally", type: EventType.Dispatch }
      ]
      const { container, fixture } = await render(DispatchActionsInCallOrderWithEffect)

      EventLog.monitor(fixture)
      DispatchActionsInCallOrderWithEffect.start()

      expect(container).toHaveTextContent("count: 3")
      expect(container).toHaveTextContent("complete: true")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should dispatch actions in order they are called with effect error", async () => {
      const expected = [
         { id: 1, name: "start", type: EventType.Dispatch },
         { id: 2, name: "start", type: EventType.Next, value: 1 },
         { id: 3, name: "setCount", type: EventType.Dispatch, value: 1 },
         { id: 4, name: "start", type: EventType.Next, value: 2 },
         { id: 5, name: "setCount", type: EventType.Dispatch, value: 2 },
         { id: 6, name: "start", type: EventType.Next, value: 3 },
         { id: 7, name: "setCount", type: EventType.Dispatch, value: 3 },
         { id: 8, name: "start", type: EventType.Error, value: new Error("BOGUS") },
         { id: 9, name: "setError", type: EventType.Dispatch, value: new Error("BOGUS") },
         { id: 10, name: "finally", type: EventType.Dispatch }
      ]
      const { container, fixture } = await render(DispatchActionsInCallOrderWithEffectError)

      const error = withFakeAsync(() => {
         EventLog.monitor(fixture)
         DispatchActionsInCallOrderWithEffectError.start()
      })

      expect(container).toHaveTextContent("count: 3")
      expect(container).toHaveTextContent("error: BOGUS")
      expect(error).toEqual(new Error("BOGUS"))
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should dispatch actions after subscribing to effects", async () => {
      const button = 10
      const value = new MouseEvent("click", { button })
      const expected = [
         { id: 1, name: "start", type: EventType.Dispatch, value },
         { id: 2, name: "start", type: EventType.Next, value },
      ]
      const { container, fixture } = await render(DispatchAfterSubscribe)

      EventLog.monitor(fixture)
      DispatchAfterSubscribe.start(button)

      expect(container).toHaveTextContent(`count: ${button}`)
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should be injectable with action providers", async () => {
      const { container } = await render(InjectableAction, {
         providers: [
            configureStore({
               root: true,
               actionProviders: [{ provide: InjectableAction.INCREMENT, useValue: 10 }]
            })
         ]
      })

      InjectableAction.start()

      expect(container).toHaveTextContent("count: 10")
   })

   it("should be injectable with action providers in dispatch observer", async () => {
      const { container } = await render(InjectableActionWithEffect, {
         providers: [
            configureStore({
               root: true,
               actionProviders: [{ provide: InjectableAction.INCREMENT, useValue: 10 }]
            })
         ]
      })

      InjectableActionWithEffect.start()

      expect(container).toHaveTextContent("count: 30")
   })

   it("should be injectable with actions providers in dispatch error observer", async () => {
      const { container } = await render(InjectableActionWithEffectError, {
         providers: [
            configureStore({
               root: true,
               actionProviders: [{ provide: InjectableAction.INCREMENT, useValue: 10 }]
            })
         ]
      })

      const error = withFakeAsync(() => {
         InjectableActionWithEffectError.start()
      })

      expect(error).toEqual(new Error("BOGUS"))
      expect(container).toHaveTextContent("count: 10")
   })
})
