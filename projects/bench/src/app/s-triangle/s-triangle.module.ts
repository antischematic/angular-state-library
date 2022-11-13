import { NgModule } from "@angular/core"
import { BrowserModule } from "@angular/platform-browser"

import { STriangleComponent } from "./s-triangle.component"
import { TriangleModule } from "./triangle/triangle.module"

@NgModule({
   declarations: [STriangleComponent],
   exports: [STriangleComponent],
   imports: [BrowserModule, TriangleModule],
})
export class STriangleModule {}
