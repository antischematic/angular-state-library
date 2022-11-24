import {JsonPipe} from "@angular/common";
import {Component} from "@angular/core";
import {
   action,
   Action,
   actionEvent, dispatch, next, nextEvent,
   Select,
   Selector,
   Store,
   UnknownEvent
} from "@antischematic/angular-state-library";
import {fireEvent, screen} from "@testing-library/angular";
import {map, of} from "rxjs";

const Result = new Selector("Result", () => next(ObservableNext, "setInput").pipe(
   map((value) => JSON.stringify(value))
))
const Event = new Selector("Result", () => nextEvent(ObservableNext, "setInput").pipe(
   map((event) => JSON.stringify({
      name: event.name,
      type: event.type,
      value: event.value
   }))
))

@Store()
@Component({
   imports: [JsonPipe],
   standalone: true,
   providers: [Result, Event],
   template: `
      input: {{input}}
      result: {{result}}
      event: [{{ event }}]
      <button (custom)="setInput($event.detail)">Dispatch</button>
   `
})
export class ObservableNext {
   input?: any

   @Select(Result) result?: any

   @Select(Event) event?: UnknownEvent

   @Action() setInput(input: any) {
      this.input = JSON.stringify(input)
      dispatch(of(input))
   }

   static dispatch(detail: any) {
      fireEvent(screen.getByText("Dispatch"), new CustomEvent("custom", { detail }))
   }
}
