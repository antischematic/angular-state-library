import {inject, Injectable, INJECTOR, Input} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {events, EventType, UnknownEvent} from "@antischematic/angular-state-library";
import {Subscription} from "rxjs";

interface EventMatcher { name?: string, type?: EventType | string }

@Injectable({ providedIn: "root" })
export class EventLog {
   @Input() fixture!: ComponentFixture<any>

   events: UnknownEvent[] = []
   injector = inject(INJECTOR)
   subscription = new Subscription()

   monitor(context: any) {
      const subscription = events(context, this.injector).subscribe((event) => {
         this.events.push(event)
      })
      this.subscription.add(subscription)
      return subscription
   }

   ngOnDestroy() {
      this.subscription.unsubscribe()
   }

   static getEvents() {
      return TestBed.inject(EventLog).events
   }

   static findEvents({ name = "[^\s]*", type = "[^\s]*" }: EventMatcher) {
      const nameMatch = new RegExp(name)
      const typeMatch = new RegExp(type)
      return TestBed.inject(EventLog).events.filter(event => nameMatch.test(event.name) && typeMatch.test(event.type))
   }

   static monitor(fixture: ComponentFixture<any>) {
      TestBed.inject(EventLog).monitor(fixture.componentInstance)
   }

   static suppressErrors() {
      spyOn(console, "error")
   }
}
