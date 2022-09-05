import {StoreToken} from "@mmuscat/angular-state-library";
import { type AppComponent } from "./app.component";

export interface Todo {
  id?: string
  userId?: string
  title: string
  completed: boolean
}

export const App = new StoreToken<AppComponent>("App")
