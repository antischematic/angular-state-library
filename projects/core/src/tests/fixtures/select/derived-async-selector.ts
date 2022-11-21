import {ChangeDetectionStrategy, Component, inject} from "@angular/core";
import {ComponentFixture} from "@angular/core/testing";
import {get, Select, Selector, Store, withState} from "@antischematic/angular-state-library";
import {map} from "rxjs";

const Todos = new Selector("Todos", () => withState([
   { id: 0, title: "hello world", completed: true },
   { id: 1, title: "angular state library", completed: false },
]))

const Remaining = new Selector("Remaining", () => inject(Todos).pipe(
   map(todos => todos.filter(todo => !todo.completed))
))

const Completed = new Selector("Remaining", () => inject(Todos).pipe(
   map(todos => todos.filter(todo => todo.completed))
))

const SELECTORS = [Todos, Remaining, Completed]

@Store()
@Component({
   standalone: true,
   template: `
      remaining: {{ remaining[0].title }}
      completed: {{ completed[0].title }}
   `,
   providers: [SELECTORS],
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class DerivedAsyncSelector {
   @Select(Remaining) remaining = get(Todos)
   @Select(Completed) completed = get(Todos)

   static start(fixture: ComponentFixture<DerivedAsyncSelector>) {
      fixture.autoDetectChanges(true)
   }
}
