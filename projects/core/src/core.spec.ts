import {Action, Store} from "@antischematic/angular-state-library";
import {Component} from "@angular/core";
import {TestBed} from "@angular/core/testing";

describe("Core", () => {
   describe("Action", () => {
      it("should decorate a method", () => {
         @Store()
         @Component({ template: "" })
         class UITest {
            @Action() action() {}
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
