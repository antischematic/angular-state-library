import {Action, Caught, Store, dispatch } from "@antischematic/angular-state-library";
import {Component} from "@angular/core";
import {TestBed} from "@angular/core/testing";
import {of} from "rxjs";
import {fromStore, Invoke} from "./core";
import {EventType} from "./interfaces";

describe("Core", () => {
   describe("Action", () => {
      it("should decorate a method", () => {
         @Store()
         @Component({ template: "" })
         class UITest {
            value = 0

            setValue(value: number) {
               this.value = value
            }

            @Action() action() {
               dispatch(of(1337), {
                  next: this.setValue
               })
            }

            @Caught("action") handleError(error: any) {

            }

            @Invoke() saga() {
               fromStore(UITest).subscribe(event => {
                  if (event.type === EventType.Next && event.name === "action") {
                     event.value
                  }
               })
            }
         }
         TestBed.configureTestingModule({
            declarations: [UITest]
         })
         expect(TestBed.createComponent(UITest)).toBeTruthy()
      })
   })

   xdescribe("Select", () => {

   })

   xdescribe("Caught", () => {

   })
})
