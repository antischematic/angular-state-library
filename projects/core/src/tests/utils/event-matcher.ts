import {UnknownEvent} from "@antischematic/angular-state-library";

export function eventsContaining(events: Array<Partial<UnknownEvent>>) {
   return events.map(event => jasmine.objectContaining(event as {}))
}
