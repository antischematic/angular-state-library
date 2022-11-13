import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import {STriangleModule} from "./s-triangle/s-triangle.module";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
     STriangleModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
