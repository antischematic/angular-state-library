import {tick} from "@angular/core/testing";
import {BasicAsyncSelector} from "./fixtures/select/basic-async-selector";
import {BasicSelectWithGetter} from "./fixtures/select/basic-select-getter";
import {DerivedAsyncSelector} from "./fixtures/select/derived-async-selector";
import {ObservableInputs} from "./fixtures/select/observable-inputs";
import {PierceOnPushBoundary} from "./fixtures/select/pierce-on-push-boundary.component";
import {SelectAssigned} from "./fixtures/select/select-assigned";
import {Parent} from "./fixtures/select/select-parent-store";
import {SelectWithState} from "./fixtures/select/select-with-state";
import {SelectorChain} from "./fixtures/select/selector-chain";
import {SliceState} from "./fixtures/select/slice-state";
import {UnselectableError} from "./fixtures/select/unselectable-error";
import {EventLog} from "./utils/event-log";
import {eventsContaining} from "./utils/event-matcher";
import {render} from "./utils/render";
import {withFakeAsync} from "./utils/with-fake-async";

describe("Select", () => {
   it("should get the selected value", async () => {
      const { container, fixture, change } = await render(BasicSelectWithGetter, {
         detectChanges: false,
         componentProperties: {
            count: 1
         }
      })

      BasicSelectWithGetter.start(fixture)

      expect(container).toHaveTextContent("count: 1")
      expect(container).toHaveTextContent("double: 2")

      change({ count: 10 })

      expect(container).toHaveTextContent("count: 10")
      expect(container).toHaveTextContent("double: 20")
   })

   it("should chain selectors", async () => {
      const { container, fixture, change } = await render(SelectorChain, {
         detectChanges: false,
         componentProperties: {
            count: 1
         }
      })

      SelectorChain.start(fixture)

      expect(container).toHaveTextContent("count: 1")
      expect(container).toHaveTextContent("sum: 4")
      expect(container).toHaveTextContent("read: 3")

      change({ count: 10 })

      expect(container).toHaveTextContent("count: 10")
      expect(container).toHaveTextContent("sum: 31")
      expect(container).toHaveTextContent("read: 6")
   })

   it("should dispatch action when async selector emits", async () => {
      const expected = [
         { id: 0, name: "count", value: 1 },
         { id: 1, name: "count", value: 2 },
         { id: 2, name: "count", value: 3 },
         { id: 3, name: "count", value: 4 },
         { id: 4, name: "count", value: 5 },
         { id: 5, name: "count", value: 6 },
         { id: 6, name: "count", value: 7 },
         { id: 7, name: "count", value: 8 },
         { id: 8, name: "count", value: 9 },
         { id: 9, name: "count", value: 10 },
      ]
      const { container, fixture } = await render(BasicAsyncSelector, { detectChanges: false })

      const error = withFakeAsync(() => {
         EventLog.monitor(fixture)
         BasicAsyncSelector.start(fixture)
         tick(10000)
      })

      expect(error).toBeNull()
      expect(container).toHaveTextContent("count: 10")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should select with state", async () => {
      const expected = [
         { id: 0, name: "count", value: 0 },
         { id: 1, name: "count", value: 1 },
         { id: 2, name: "count", value: 2 },
         { id: 3, name: "count", value: 3 },
         { id: 4, name: "count", value: 4 },
         { id: 5, name: "count", value: 5 },
         { id: 6, name: "count", value: 6 },
         { id: 7, name: "count", value: 7 },
         { id: 8, name: "count", value: 8 },
         { id: 9, name: "count", value: 9 },
         { id: 10, name: "count", value: 10 },
      ]
      const { container, fixture } = await render(SelectWithState, { detectChanges: false })

      const error = withFakeAsync(() => {
         EventLog.monitor(fixture)
         SelectWithState.start(fixture)
         tick(10000)
      })

      expect(error).toBeNull()
      expect(container).toHaveTextContent("count: 10")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should throw when value is not selectable", async () => {
      const expectedError = "Object does not implement OnSelect or Subscribable interfaces"
      const { fixture } = await render(UnselectableError, { detectChanges: false })

      const error = withFakeAsync(() => {
         EventLog.suppressErrors()
         UnselectableError.start(fixture)
      })

      expect(error).toEqual(new Error(expectedError))
   })

   it("should select assigned object", async () => {
      const { container } = await render(SelectAssigned)

      expect(container).toHaveTextContent("transition: false")

      withFakeAsync(() => {
         SelectAssigned.start()
         tick(1000)

         expect(container).toHaveTextContent("transition: true")

         tick(1000)

         expect(container).toHaveTextContent("transition: false")
      })
   })

   it("should derive state from other selectors", async () => {
      const expected = [
         { id: 0, name: "remaining", value: [{ id: 1, title: "angular state library", completed: false }] },
         { id: 1, name: "completed", value: [{ id: 0, title: "hello world", completed: true }] },
      ]
      const { container, fixture } = await render(DerivedAsyncSelector, { detectChanges: false })

      EventLog.monitor(fixture)
      DerivedAsyncSelector.start(fixture)

      expect(container).toHaveTextContent("remaining: angular state library")
      expect(container).toHaveTextContent("completed: hello world")
      expect(EventLog.getEvents()).toEqual(eventsContaining(expected))
   })

   it("should derive from parent store asynchronously", async () => {
      const { container, fixture } = await render(Parent, { detectChanges: false })

      const error = withFakeAsync(() => {
         Parent.start(fixture)
         tick(10000)
      })

      expect(error).toBeNull()
      expect(container).toHaveTextContent("parent: 10")
      expect(container).toHaveTextContent("child: 10")
   })

   it("should pierce OnPush boundary", async () => {
      const { container, fixture } = await render(PierceOnPushBoundary, {
         detectChanges: false
      })

      const error = withFakeAsync(() => {
         PierceOnPushBoundary.start(fixture)

         expect(container).toHaveTextContent("count: 0")
         expect(container).toHaveTextContent("quadruple: 0")
         expect(container).toHaveTextContent("read: 1")

         tick(1000)

         expect(container).toHaveTextContent("count: 1")
         expect(container).toHaveTextContent("quadruple: 4")
         expect(container).toHaveTextContent("read: 2")

         tick(9000)

         expect(container).toHaveTextContent("count: 10")
         expect(container).toHaveTextContent("quadruple: 40")
         expect(container).toHaveTextContent("read: 11")
      })

      expect(error).toBeNull()
   })

   it("should slice state", async () => {
      const { container } = await render(SliceState)

      expect(container).toHaveTextContent("count: 0")
      expect(container).toHaveTextContent("double: 0")
      expect(container).toHaveTextContent("many: 0 0")

      SliceState.increment()

      expect(container).toHaveTextContent("count: 1")
      expect(container).toHaveTextContent("double: 2")
      expect(container).toHaveTextContent("many: 1 2")

      SliceState.increment()

      expect(container).toHaveTextContent("count: 2")
      expect(container).toHaveTextContent("double: 4")
      expect(container).toHaveTextContent("many: 2 4")
   })

   it("should observe input changes", async () => {
      const { container, fixture, change } = await render(ObservableInputs, {
         detectChanges: false,
         componentProperties: {
            count: 0
         }
      })

      ObservableInputs.start(fixture)

      expect(container).toHaveTextContent("count: 0")
      expect(container).toHaveTextContent("previous: empty")
      expect(container).toHaveTextContent("count: 0")
      expect(container).toHaveTextContent("firstChange: true")
      expect(container).toHaveTextContent("read: 2")

      change({ count: 10 })

      expect(container).toHaveTextContent("count: 10")
      expect(container).toHaveTextContent("previous: 0")
      expect(container).toHaveTextContent("count: 10")
      expect(container).toHaveTextContent("firstChange: false")
      expect(container).toHaveTextContent("read: 4")
   })

   it("should should pipe", () => {

   })

   it("should handle errors", () => {

   })

   it("should mutate selector", () => {

   })
})
