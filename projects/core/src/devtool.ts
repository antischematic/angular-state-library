import {
   ChangeDetectorRef,
   Component,
   EnvironmentInjector,
   inject,
   Injectable,
   INJECTOR
} from "@angular/core";
import {
   ActionType,
   DISPATCHER,
   EventType,
   getMeta,
   isRunning,
   pause,
   resume,
   setMeta
} from "./actions";
import {DatePipe, NgForOf, SlicePipe} from "@angular/common";

@Injectable({ providedIn: "root" })
export class Devtool {
   dispatcher = inject(DISPATCHER)
   eventStore = [] as EventType[]
   head: number = Infinity
   pause = pause
   resume = resume

   findEvents(from: number, to: number) {
      return this.eventStore.filter(event => {
         return event.timestamp >= to && event.timestamp <= from
      })
   }

   rewind(from: number = Date.now(), to = 0) {
      this.head = to
      this.pause()
      this.applyChanges(this.findEvents(from, to).reverse())
   }

   fastForward(from: number, to = Date.now()) {
      this.head = to
      if (to >= this.eventStore[this.eventStore.length - 1].timestamp) {
         this.resume()
      }
      this.applyChanges(this.findEvents(to, from), false)
   }

   jumpTo(event: EventType) {
      if (event.timestamp < this.head) {
         this.rewind(this.head, event.timestamp)
      }
      if (event.timestamp > this.head) {
         this.fastForward(this.head, event.timestamp)
      }
   }

   private applyChanges(events: EventType[], previous = true) {
      console.log('apply', events)
      for (const event of events) {
         const { context, changelist, name } = event
         for (const [key, [previousValue, currentValue]] of changelist) {
            (context as any)[key] = previous ? previousValue : currentValue
         }
         if (event.type === ActionType.Dispatch) {
            const [previousDeps, currentDeps] = event.deps
            setMeta("deps", previous ? previousDeps : currentDeps, context, name)
         }
         this.dispatcher.next({
            id: -1,
            type: ActionType.Dispatch,
            context,
            name: "@@applyChanges",
            timestamp: Date.now(),
            changelist: [],
            deps: [],
            value: []
         })
      }
   }

   constructor() {
      this.dispatcher.subscribe((event) => {
         if (event.name !== "ngOnChanges" && event.name !== "@@applyChanges" && isRunning()) {
            this.head = event.timestamp
            this.eventStore.push(event)
         }
      })
   }
}


@Component({
   imports: [NgForOf, SlicePipe, DatePipe],
   standalone: true,
   selector: "ui-devtool",
   template: `
      <div class="flex" *ngFor="let event of devtool.eventStore | slice:0:100">
         <button type="button" (click)="devtool.jumpTo(event)">Jump to</button>
         <span>{{event.id}}:{{event.name}}:{{event.type}}</span>
      </div>
   `,
   styles: [`
     :host {
        display: block;
        position: fixed;
        top: 24px;
        right: 24px;
        z-index: 999;
        width: 376px;
        height: calc(100% - 48px);
        overflow: auto;
        padding: 24px;
        box-shadow: 0 0 2px rgba(0,0,0,.15)
     }

     button {
        whitespace: nowrap;
     }

     .flex {
        display: flex;
        gap: 16px;
     }
   `]
})
export class UIDevtool {
   devtool = inject(Devtool)
}
