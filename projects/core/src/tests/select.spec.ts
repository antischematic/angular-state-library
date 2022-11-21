import {fakeAsync, flush, tick} from "@angular/core/testing";
import {EventType} from "@antischematic/angular-state-library";
import {BasicAsyncSelector} from "./fixtures/select/basic-async-selector";
import {BasicSelectWithGetter} from "./fixtures/select/basic-select-getter";
import {DerivedAsyncSelector} from "./fixtures/select/derived-async-selector";
import {SelectAssigned} from "./fixtures/select/select-assigned";
import {Parent} from "./fixtures/select/select-parent-store";
import {SelectWithState} from "./fixtures/select/select-with-state";
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

   it("should chain selectors", () => {

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

   it("should derive from computed grandparent", () => {

   })

   it("should slice state", () => {

   })

   it("should observe input changes", () => {

   })

   it("should handle errors", () => {

   })

   it("should mutate selector", () => {

   })
})
