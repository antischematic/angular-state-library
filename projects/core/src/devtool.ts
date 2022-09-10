import {
   ChangeDetectorRef,
   Component,
   EnvironmentInjector,
   inject,
   Injectable,
   INJECTOR, Pipe
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
   pipe = new FilterPipe

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
      const events = this.pipe.transform(this.eventStore)
      this.applyChanges(this.findEvents(to, from), false)
      if (to > events[events.length - 1].timestamp) {
         setTimeout(() => {
            this.resume()
         })
      }
   }

   jumpTo(timestamp: number) {
      if (timestamp < this.head) {
         this.rewind(this.head, timestamp)
      }
      if (timestamp > this.head) {
         this.fastForward(this.head, timestamp)
      }
   }

   private applyChanges(events: EventType[], previous = true) {
      const contexts = new Set<any>()
      if (previous) {
         events = events.slice(events.length - 2)
      }
      for (const event of events) {
         contexts.add(event.context)
         const { context, changelist, name } = event
         for (const [key, [previousValue, currentValue]] of changelist) {
            (context as any)[key] = previous ? previousValue : currentValue
         }
         if (event.type === ActionType.Dispatch) {
            const [previousDeps, currentDeps] = event.deps
            setMeta("deps", previous ? previousDeps : currentDeps, context, name)
         }
      }
      for (const context of contexts) {
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
         if (event.name !== "@@applyChanges") {
            if (event.name !== "ngOnChanges") {
               this.head = event.timestamp
            }
            if (event.changelist.length) {
               this.eventStore = this.eventStore.concat(event)
            }
         }
      })
   }
}

@Pipe({
   name: "filter",
   pure: true,
   standalone: true
})
class FilterPipe {
   transform(value: EventType[]) {
      return value.filter(val => val.name !== "ngOnChanges")
   }
}

@Component({
   imports: [NgForOf, SlicePipe, DatePipe, FilterPipe],
   standalone: true,
   selector: "ui-devtool",
   template: `
      <button type="button" (click)="devtool.jumpTo(0)" style="margin-bottom: 1em">Start</button>
      <div class="flex" *ngFor="let event of devtool.eventStore | filter | slice:0:100">
         <button type="button" (click)="devtool.jumpTo(event.timestamp)">Jump to</button>
         <span>{{event.name}}:{{event.type}}</span>
      </div>
      <button type="button" (click)="devtool.jumpTo(end)" style="margin-top: 1em">Resume</button>
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

   end = Infinity
}
