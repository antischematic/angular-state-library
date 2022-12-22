import {UnknownEvent} from "@antischematic/angular-state-library";

export function eventsContaining(events: Array<Partial<UnknownEvent>>) {
   return events.map((event) => {
      return jasmine.objectContaining(event)
   })
}

export function arrayContaining(values: Array<{}>) {
   return values.map((value) => {
      return jasmine.objectContaining(value)
   })
}
