# Angular State Library

Manage state in your Angular applications. **Status: in development**

[Read the Intro](https://dev.to/antischematic/angular-state-library-3gkl)

[Try it on StackBlitz](https://stackblitz.com/edit/angular-state-library?file=src%2Fapp%2Fui-todos.component.ts)

## API

Version: 0.7.0<br/>
<small>Bundle size: ~20kb min. ~7kb gzip</small>

This API is experimental.

<details>
   <summary>Table of Contents</summary>

   <!-- TOC -->
* [Angular State Library](#angular-state-library)
   * [API](#api)
      * [Store](#store)
      * [Action](#action)
      * [Invoke](#invoke)
      * [Before](#before)
      * [Layout](#layout)
      * [Select](#select)
      * [Caught](#caught)
      * [TemplateProvider](#templateprovider)
      * [configureStore](#configurestore)
      * [Observables](#observables)
         * [events](#events)
         * [EVENTS](#events-1)
         * [select](#select-1)
         * [selectStore](#selectstore)
         * [Selector](#selector)
         * [actionEvent](#actionevent)
         * [nextEvent](#nextevent)
         * [errorEvent](#errorevent)
         * [completeEvent](#completeevent)
      * [Action Hooks](#action-hooks)
         * [dispatch](#dispatch)
         * [loadEffect](#loadeffect)
         * [addTeardown](#addteardown)
         * [useChanges](#usechanges)
         * [useOperator](#useoperator)
      * [Reactivity](#reactivity)
         * [track (alias: `$`)](#track--alias---)
         * [untrack (alias: `$$`)](#untrack--alias---)
         * [isTracked](#istracked)
      * [Extensions](#extensions)
         * [Transition](#transition)
         * [TransitionToken](#transitiontoken)
         * [useTransition](#usetransition)
         * [useQuery](#usequery)
         * [useMutation](#usemutation)
   * [Testing Environment](#testing-environment)
<!-- TOC -->
</details>

### Core

Angular State Library is built around class decorators.

#### Store

> Note:
> `@Store` only works on classes decorated with `@Component` or `@Directive`

Marks the decorated directive as a store. This decorator is required for all other decorators to function.

**Basic usage**

```ts
@Store()
@Component()
export class UICounter {}
```

#### Action

Marks the decorated method as an action. Each action runs in its own `EnvironmentInjector` context. When the action is
called it automatically schedules a `Dispatch` event for the next change detection cycle.

**Example: Basic action**

```ts
@Store()
@Component()
export class UICounter {
   @Input() count = 0

   @Action() increment() {
      this.count++
   }
}
```

**Example: Action with dependency injection**

```ts
@Store()
@Component()
export class UITodos {
   todos = []

   @Action() loadTodos() {
      const endpoint = "https://jsonplaceholder.typicode.com/todos"
      const loadTodos = inject(HttpClient).get(endpoint)

      dispatch(loadTodos, (todos) => {
         this.todos = todos
      })
   }
}
```

#### Invoke

See `Action`. The method receives a reactive `this` context that tracks dependencies. The action is called automatically
during `ngDoCheck` on the first change detection cycle and again each time its reactive dependencies change.

**Example: Reactive actions**

This example logs the value of `count` whenever it changes via `@Input` or `increment`.

```ts
@Store()
@Component()
export class UICounter {
   @Input() count = 0

   @Action() increment() {
      this.count++
   }

   @Invoke() logCount() {
      console.log(this.count)
   }
}
```

#### Before

See `Invoke`. Dependencies are checked during `ngAfterContentChecked`. Use this when an action depends on `ContentChild`
or `ContentChildren`.

**Example: Reactive content query**

This example creates an embedded view using `ContentChild`.

```ts
@Store()
@Component()
export class UIDynamic {
   @ContentChild(TemplateRef)
   template?: TemplateRef

   @Before() createView() {
      const viewContainer = inject(ViewContainerRef)
      if (this.template) {
         viewContainer.createEmbeddedView(this.template)
      }
   }
}
```

#### Layout

See `Invoke`. Dependencies are checked during `ngAfterViewChecked`. Use this when an action depends on `ViewChild`
or `ViewChildren`.

**Example: Reactive view query**

This example logs when the number of child components change.

```ts
@Store()
@Component()
export class UIParent {
   @ViewChildren(UIChild)
   viewChildren?: QueryList<UIChild>

   @Layout() countElements() {
      const {length} = $(this.viewChildren)
      console.log(`There are ${length} elements on the page`)
   }
}
```

#### Select

Marks the decorated property, accessor or method as a selector. Use selectors to derive state from other stores or class properties. Can be
chained with other selectors. Selectors receive a reactive `this` context that tracks dependencies. Selectors are
memoized until their dependencies change. Selectors are not evaluated until its value is read. The memoization cache is
purged each time reactive dependencies change.

For method selectors, arguments must be serializable with `JSON.stringify`.

For property selectors, they must implement the `OnSelect` or `Subscribable` interface.

**Example: Computed properties**

```ts
@Store()
@Component()
export class UICounter {
   @Input() count = 0

   @Select() get double() {
      return this.count * 2
   }
}
```

**Example: Computed methods**

```ts
@Store()
@Component()
export class UITodos {
   todos = []

   @Select() getTodosByUserId(userId: string) {
      return this.todos.filter(todo => todo.userId === userId)
   }
}
```

**Example: Select theme from a template provider**

```ts
@Store()
@Component()
export class UIButton {
   @select(UITheme) theme = get(UITheme)

   @HostBinding("style.color") get color() {
      return this.theme.color
   }
}
```

**Example: Select parent store**

```ts
@Store()
@Component()
export class UIComponent {
   @Select() uiTodos = inject(UITodos)

   @Select() get todos() {
      return this.uiTodos.todos
   }
}
```

**Example: Select a transition**

```ts
@Store()
@Component()
export class UIComponent {
   @Select() loading = new Transition()
}
```

#### Caught

Marks the decorated method as an error handler. Unhandled exceptions inside `Action`, `Invoke`, `Before`, `Layout`
and `Select` are forwarded to the first error handler. Unhandled exceptions from dispatched effects are also captured.
If the class has multiple error handlers, rethrown errors will propagate to the next error handler in the chain from top
to bottom.

**Example: Handling exceptions**

```ts
@Store()
@Component()
export class UITodos {
   @Action() loadTodos() {
      throw new Error("Whoops!")
   }

   @Caught() handleError(error: unknown) {
      console.debug("Error caught", error)
   }
}
```

#### TemplateProvider

Provide values from a component template reactively. Template providers are styled with `display: contents` so they
don't break grid layouts. Only use template providers with an element selector on a `@Directive`. Use with `Select` to
keep dependant views in sync.

**Example: Theme Provider**

```ts
export interface Theme {
   color: string
}

@Directive({
   standalone: true,
   selector: "ui-theme"
})
export class UITheme extends TemplateProvider {
   value: Theme = {
      color: "red"
   }
}
```

```html

<ui-theme>
   <ui-button>Red button</ui-button>
   <ui-theme [value]="{ color: 'green' }">
      <ui-button>Green button</ui-button>
   </ui-theme>
</ui-theme>
```

#### configureStore

Add configuration for all stores, or override configuration for a particular store.

```ts
interface StoreConfig {
   root?: boolean // default: false
   actionProviders?: Provider[]
}
```

`root` Set to true so stores inherit the configuration. Set to false to configure a specific store.

`actionProviders` Configure action providers. Each method decorated with `Action`, `Invoke`, `Before`, or `Layout` will
receive a unique instance of each provider.

### Observables

Every store can be observed through its event stream.

#### events

Returns an observable stream of events emitted from a store. Actions automatically dispatch events when they are called.
The next, error and complete events from dispatched effects can also be observed. Effects must be returned from an
action for the type to be correctly inferred. This method must be called inside an injection context.

**Example: Observe store events**

```ts
events(UITodos).subscribe(event => {
   switch (event.name) {
      case "loadTodos": {
         switch (event.type) {
            case EventType.Next: {
               console.log('todos loaded!', event.value)
            }
         }
      }
   }
})
```

#### EVENTS

Injects the global event observer. Use this to observe all store events in the application.

**Example: Log all store events in the application**

```ts
@Component()
export class UIApp {
   constructor() {
      inject(EVENTS).subscribe((event) => {
         console.log(event)
      })
   }
}
```

#### select

Observe changes to individual store properties. Values are checked after actions have run. This method must be called
inside an injection context.

**Example: Select partial store state**

```ts
const {todos, userId} = select(UITodos)

todos.subscribe(current => {
   console.log("todos", current)
})

userId.subscribe(current => {
   console.log("userId", current)
})
```

#### selectStore

Observe when any store property has changed. Values are checked after actions have run. This method must be called
inside an injection context.

**Example: Select full store state**

```ts
const store = selectStore(UITodos)

store.subscribe(current => {
   console.log("store", current)
})
```

#### Selector

Creates an injectable selector that derives a value from the event stream. Selectors can return an `Observable` or `WithState` object. If a `WithState` object is returned, the selector state can be mutated by calling `next`. The mutation action can be intercepted by providing the subject as the first argument to the selector.

**Example: Selector with observable**

```ts
const Count = new Selector(() => action(UICounter, "increment").pipe(
   scan(count => count + 1, 0)
))

@Store()
@Directive()
export class UICounter {
   @Select(Count) count = 0

   @Action() increment!: Action<() => void>
}
```

**Example: Selector with state mutation**

```ts
const Count = new Selector(() => withState(0))

@Store()
@Directive()
export class UICounter {
   @Select(Count) count = get(Count) // 0

   @Action() increment() {
      inject(Count).next(this.count + 1)
   }
}
```

**Example: Selector with debounced state**

```ts
const Count = new Selector((state) => withState(0, {
   from: state.pipe(debounce(1000))
}))

@Store()
@Directive()
export class UICounter {
   @Select(Count) count = get(Count) // 0

   @Action() increment() {
      inject(Count).next(this.count + 1)
   }
}
```

**Example: Selector with state from events**

```ts
const Count = new Selector(() =>
   withState(0, {
      from: action(UICounter, "setCount")
   })
)

@Store()
@Directive()
export class UICounter {
   @Select(Count) count = get(Count) // 0

   @Action() setCount: Action<(count: number) => void>
}
```

#### actionEvent

Returns a `DispatchEvent` stream. Use `action` if you only want the value.

**Example: Get a `DispatchEvent` stream from an action**

```ts
@Store()
@Directive()
export class UIStore {
   action(value: number) {}
}

actionEvent(UIStore, "action") // Observable<DispatchEvent>
action(UIStore, "action") // Observable<number>
```

#### nextEvent

Returns a `NextEvent` stream. Use `next` if you only want the value.

**Example: Get a `NextEvent` stream from an action**

```ts
@Store()
@Directive()
export class UIStore {
   action(value: number) {
      return dispatch(of(number.toString()))
   }
}

nextEvent(UIStore, "action") // Observable<NextEvent>
next(UIStore, "action") // Observable<string>
```

#### errorEvent

Returns an `ErrorEvent` stream. Use `error` if you only want the error.

**Example: Get an `ErrorEvent` stream from an action**

```ts
@Store()
@Directive()
export class UIStore {
   action(value: number) {
      return dispatch(throwError(() => new Error("Oops!")))
   }
}

errorEvent(UIStore, "action") // Observable<ErrorEvent>
error(UIStore, "action") // Observable<unknown>
```


#### completeEvent

Returns a `CompleteEvent` stream.

**Example: Get a `CompleteEvent` stream from an action**

```ts
@Store()
@Directive()
export class UIStore {
   action(value: number) {
      return dispatch(EMPTY)
   }
}

completeEvent(UIStore, "action") // Observable<ErrorEvent>
complete(UIStore, "action") // Observable<void>
```

### Action Hooks

Use action hooks to configure the behaviour of actions and effects. Action hooks can only be called inside a method
decorated with `@Action`, `@Invoke`, `@Before` or `@Layout`.

#### dispatch

Dispatch an effect from an action. Observer callbacks are bound to the directive instance.

**Example: Dispatching effects**

```ts
@Store()
@Component()
export class UITodos {
   @Input() userId: string

   todos: Todo[] = []

   @Invoke() loadTodos() {
      const endpoint = "https://jsonplaceholder.typicode.com/todos"
      const loadTodos = inject(HttpClient).get(endpoint, {
         params: {userId: this.userId}
      })

      dispatch(loadTodos, (todos) => {
         this.todos = todos
      })
   }
}
```

#### loadEffect

Creates an action hook that lazy loads an effect. The effect is loaded the first time it is called inside an action.

**Example: Lazy load effects**

```ts
// load-todos.ts
export default function loadTodos(userId: string) {
   const endpoint = "https://jsonplaceholder.typicode.com/todos"
   return inject(HttpClient).get(endpoint, {
      params: {userId}
   })
}
```

```ts
const loadTodos = loadEffect(() => import("./load-todos"))

@Store()
@Component()
export class UITodos {
   @Input() userId: string

   todos: Todo[] = []

   @Invoke() loadTodos() {
      dispatch(loadTodos(this.userId), (todos) => {
         this.todos = todos
      })
   }
}
```

#### addTeardown

Adds a teardown function or subscription to be executed the next time an action runs or when the component is destroyed.

**Example: Using third party DOM plugins**

```ts
@Store()
@Component()
export class UIPlugin {
   @Layout() mount() {
      const {nativeElement} = inject(ElementRef)
      const teardown = new ThirdPartyDOMPlugin(nativeElement)

      addTeardown(teardown)
   }
}
```

#### useChanges

Returns a reactive `SimpleChanges` object for the current component. Use this to track changes to input values.

**Example: Reacting to `@Input` changes**

```ts
@Store()
@Component()
export class UITodos {
   @Input() userId!: string

   todos: Todo[] = []

   @Invoke() loadTodos() {
      const {userId} = useChanges<UITodos>()

      dispatch(loadTodos(userId.currentValue), (todos) => {
         this.todos = todos
      })
   }
}
```

#### useOperator

Sets the merge strategy for effects dispatched from an action. The default strategy is `switchAll`. Once `useOperator`
is called, the operator is locked and cannot be changed.

Shortcuts for common operators such as `useMerge`, `useConcat` and `useExhaust` are also available.

**Example: Debounce effects**

```ts
function useSwitchDebounce(milliseconds: number) {
   return useOperator(source => {
      return source.pipe(
         debounceTime(milliseconds),
         switchAll()
      )
   })
}
```

```ts
@Store()
@Component()
export class UITodos {
   @Input() userId: string

   todos: Todo[] = []

   @Invoke() loadTodos() {
      useSwitchDebounce(1000)

      dispatch(loadTodos(this.userId), (todos) => {
         this.todos = todos
      })
   }
}
```

**Example: Compose hooks with effects**

```ts
export default function loadTodos(userId: string) {
   useSwitchDebounce(1000)
   return inject(HttpClient).get(endpoint, {
      params: {userId}
   })
}
```

### Reactivity

Reactivity is enabled through the use of proxy objects. The reactivity API makes it possible to run actions and change
detection automatically when data dependencies change.

#### track (alias: `$`)

Track arbitrary objects or array mutations inside reactive actions and selectors.

**Example: Track array mutations**

```ts
@Component()
export class UIButton {
   todos: Todo[] = []

   @Select() remaining() {
      return $(this.todos).filter(todo => !todo.completed)
   }

   @Action() addTodo(todo) {
      this.todos.push(todo)
   }
}
```

#### untrack (alias: `$$`)

Unwraps a proxy object, returning the original object. Use this to avoid object identity hazards or when accessing
private fields.

#### isTracked

Returns `true` if the value is a proxy object created with `track`

### Extensions

These APIs integrate with Angular State Library, but they can also be used on their own.

#### Transition

Transitions use Zone.js to observe the JavaScript event loop. Transitions are a drop in replacement for `EventEmitter`.
When used as an event emitter,
any async activity is tracked in a transition zone. The transition ends once all async activity has settled.

**Example: Button activity indicator**

```ts
@Component({
   template: `
      <div><ng-content></ng-content></div>
      <ui-spinner *ngIf="press.unstable"></ui-spinner>
   `
})
export class UIButton {
   @Select() @Output() press = new Transition()

   @HostListener("click", ["$event"])
   handleClick(event) {
      this.press.emit(event)
   }
}
```

**Example: Run code inside a transition**

```ts
const transition = new Transition()

transition.run(() => {
   setTimeout(() => {
      console.log("transition complete")
   }, 2000)
})
```

#### TransitionToken

Creates an injection token that injects a transition.

```ts
const Loading = new TransitionToken("Loading")

@Component()
export class UITodos {
   @Select() loading = inject(Loading)
}
```

#### useTransition

Runs the piped observable in a transition.

**Example: Observe the loading state of todos**

```ts

const endpoint = "https://jsonplaceholder.typicode.com/todos"

function loadTodos(userId: string, loading: Transition<Todo[]>) {
   return inject(HttpClient).get<Todo[]>(endpoint, { params: { userId }}).pipe(
      useTransition(loading),
      useQuery({
         key: [endpoint, userId],
         refreshInterval: 10000,
         refreshOnFocus: true,
         refreshOnReconnect: true
      })
   )
}

@Store()
@Component({
   template: `
      <ui-spinner *ngIf="loading.unstable"></ui-spinner>
      <ui-todo *ngFor="let todo of todos" [value]="todo"></ui-todo>
   `
})
export class UITodos {
   @Input() userId!: string

   todos: Todo[] = []

   @Select() loading = new Transition<Todo[]>()

   @Action() setTodos(todos: Todo[]) {
      this.todos = todos
   }

   @Invoke() loadTodos() {
      dispatch(loadTodos(this.userId, this.loading), {
         next: this.setTodos
      })
   }
}
```

#### useQuery

Caches an observable based on a query key, with various options to refresh data. Returns a shared observable with the query result.

**Example: Fetch todos with a query**

```ts
const endpoint = "https://jsonplaceholder.typicode.com/todos"

function loadTodos(userId: string) {
   return inject(HttpClient).get<Todo[]>(endpoint, { params: { userId }}).pipe(
      useQuery({
         key: [endpoint, userId],
         refreshInterval: 10000,
         refreshOnFocus: true,
         refreshOnReconnect: true
      })
   )
}

@Store()
@Component({
   template: `
      <ui-spinner *ngIf="loading.unstable"></ui-spinner>
      <ui-todo *ngFor="let todo of todos" [value]="todo"></ui-todo>
   `
})
export class UITodos {
   @Input() userId!: string

   todos: Todo[] = []

   @Select() loading = new Transition<Todo[]>()

   @Action() setTodos(todos: Todo[]) {
      this.todos = todos
   }

   @Invoke() loadTodos() {
      dispatch(loadTodos(this.userId, this.loading), {
         next: this.setTodos
      })
   }
}
```

#### useMutation

Subscribes to a source observable and invalidates a list of query keys when the observable has settled. In-flight queries are cancelled.

**Example: Create a todo and refresh the data**

```ts
const endpoint = "https://jsonplaceholder.typicode.com/todos"

function loadTodos(userId: string) {
   return inject(HttpClient).get<Todo[]>(endpoint, { params: { userId }}).pipe(
      useQuery({
         key: [endpoint, userId],
         refreshInterval: 10000,
         refreshOnFocus: true,
         refreshOnReconnect: true,
         resource: inject(ResourceManager) // optional when called from an action
      })
   )
}

function createTodo(userId: string, todo: Todo) {
   return inject(HttpClient).post(endpoint, todo).pipe(
      useMutation({
         invalidate: [endpoint, userId],
         resource: inject(ResourceManager) // optional when called from an action
      })
   )
}

@Store()
@Component({
   template: `
      <ui-spinner *ngIf="loading.unstable"></ui-spinner>
      <ui-todo (save)="createTodo($event)"></ui-todo>
      <hr>
      <ui-todo *ngFor="let todo of todos" [value]="todo"></ui-todo>
   `
})
export class UITodos {
   @Input() userId!: string

   todos: Todo[] = []

   @Select() loading = new Transition<Todo[]>()

   @Action() setTodos(todos: Todo[]) {
      this.todos = todos
   }

   @Invoke() loadTodos() {
      dispatch(loadTodos(this.userId, this.loading), {
         next: this.setTodos
      })
   }

   @Action() createTodo(todo: Todo) {
      dispatch(createTodo(this.userId, todo))
   }
}
```

## Testing Environment

For Angular State Library to function correctly in unit tests, some additional setup is required. For a default Angular
CLI setup, import the ` initStoreTestEnvironment` from `@antischematic/angular-state-library/testing` and call it just
after the test environment is initialized. Sample code is provided below.

```ts
// test.ts (or your test setup file)

import {initStoreTestEnvironment} from "@antischematic/angular-state-library/testing"; // <--------- ADD THIS LINE

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
   BrowserDynamicTestingModule,
   platformBrowserDynamicTesting(),
);
// Now setup store hooks
initStoreTestEnvironment() // <--------- ADD THIS LINE

// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().forEach(context);
```
