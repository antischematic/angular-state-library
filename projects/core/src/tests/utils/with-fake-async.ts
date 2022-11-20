import {fakeAsync} from "@angular/core/testing";

export function withFakeAsync(fn: Function): unknown {
   try {
      fakeAsync(fn)()
      return null
   } catch (error) {
      return error
   }
}
