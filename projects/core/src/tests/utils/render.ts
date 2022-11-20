import {Provider, Type} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";

interface Options {
   providers?: Provider[]
   detectChanges?: boolean
   componentProperties?: {}
}

export function render<T>(componentType: Type<T>, options: Options = {}): Promise<{ container: HTMLElement, fixture: ComponentFixture<T> }> {
   const { detectChanges = true, providers = [], componentProperties = {}} = options
   TestBed.configureTestingModule({
      providers: [providers]
   })
   const fixture = TestBed.createComponent(componentType)
   const componentRef = fixture.componentRef

   if (detectChanges) {
      fixture.autoDetectChanges(detectChanges)
   }

   for (const [key, value] of Object.entries(componentProperties)) {
      componentRef.setInput(key, value)
   }

   return fixture.whenStable().then(() => {
      return {
         fixture,
         container: fixture.nativeElement
      }
   })
}
