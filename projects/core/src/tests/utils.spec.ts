import {EventType} from "@antischematic/angular-state-library";
import {render} from "@testing-library/angular";
import {ObservableAction} from "./fixtures/utils/observable-action";
import {ObservableComplete} from "./fixtures/utils/observable-complete";
import {ObservableError} from "./fixtures/utils/observable-error";
import {ObservableNext} from "./fixtures/utils/observable-next";
import {EventLog} from "./utils/event-log";
import {withFakeAsync} from "./utils/with-fake-async";

describe("utils", () => {
   it("should select action event stream", async () => {
      const expected = { bogus: true }
      const expectedString = JSON.stringify(expected)
      const { container, fixture } = await render(ObservableAction)

      EventLog.monitor(fixture)
      ObservableAction.dispatch(expected)

      expect(container).toHaveTextContent(`input: ${expectedString}`)
      expect(container).toHaveTextContent(`result: ${expectedString}`)
      expect(container).toHaveTextContent(`event: [${JSON.stringify({ name: "setInput", type: EventType.Dispatch, value: expected })}]`)
   })

   it("should select next event stream", async () => {
      const expected = { bogus: true }
      const expectedString = JSON.stringify(expected)
      const { container, fixture } = await render(ObservableNext)

      EventLog.monitor(fixture)
      ObservableNext.dispatch(expected)

      expect(container).toHaveTextContent(`input: ${expectedString}`)
      expect(container).toHaveTextContent(`result: ${expectedString}`)
      expect(container).toHaveTextContent(`event: [${JSON.stringify({ name: "setInput", type: EventType.Next, value: expected })}]`)
   })

   it("should select complete event stream", async () => {
      const expected = { bogus: true }
      const expectedString = JSON.stringify(expected)
      const { container, fixture } = await render(ObservableComplete)

      EventLog.monitor(fixture)
      ObservableComplete.dispatch(expected)

      expect(container).toHaveTextContent(`input: ${expectedString}`)
      expect(container).toHaveTextContent(`result: []`)
      expect(container).toHaveTextContent(`event: [${JSON.stringify({ name: "setInput", type: EventType.Complete })}]`)
   })

   it("should select error event stream", async () => {
      const expected = { bogus: true }
      const expectedString = JSON.stringify(expected)
      const { container, fixture } = await render(ObservableError)

      const error = withFakeAsync(() => {
         EventLog.monitor(fixture)
         ObservableComplete.dispatch(expected)
      })

      expect(error).toEqual(expected)
      expect(container).toHaveTextContent(`input: ${expectedString}`)
      expect(container).toHaveTextContent(`result: ${expectedString}`)
      expect(container).toHaveTextContent(`event: [${JSON.stringify({ name: "setInput", type: EventType.Error, value: expected })}]`)
   })
})
