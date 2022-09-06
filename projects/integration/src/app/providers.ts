import {StoreToken} from "@mmuscat/angular-state-library";
import {type AppComponent} from "./app.component";
import {type UICounter} from "./ui-counter.component";

export const AppStore = new StoreToken<AppComponent>("AppStore")
export const Counter = new StoreToken<UICounter>("Counter")
