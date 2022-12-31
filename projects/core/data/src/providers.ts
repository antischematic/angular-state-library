import {QueryStore} from "./interfaces";
import {QueryClient} from "./query";
import {createEnvironmentInjector, EnvironmentInjector, InjectionToken, Injector} from "@angular/core";
import {Observable} from "rxjs";

function createQueryConfig() {
   return {
      store: new Map<string, QueryStore>(),
      timers: new Map<number, Observable<number>>(),
      clients: new Set<QueryClient<any, any, any, any>>()
   }
}

export const QUERY_CONFIG = new InjectionToken("QUERY_CONFIG", {
   factory: createQueryConfig
})

export const nullInjector = createEnvironmentInjector(
   [
      { provide: QUERY_CONFIG, useFactory: createQueryConfig }
   ],
   Injector.NULL as EnvironmentInjector
)
