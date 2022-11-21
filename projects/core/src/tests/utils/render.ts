import {Provider, Type} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";

interface Options<T> {
   providers?: Provider[]
   detectChanges?: boolean
   componentProperties?: Partial<T>
}

export type Change<T> = (updates: Partial<T>) => void
export interface ComponentHelper<T> {
   container: HTMLElement,
   fixture: ComponentFixture<T>,
   change: Change<T>
}

export function render<T extends {}>(componentType: Type<T>, options: Options<T> = {}): Promise<ComponentHelper<T>> {
   const { detectChanges = true, providers = [], componentProperties = {}} = options
   TestBed.configureTestingModule({
      providers: [providers]
   })
   const fixture = TestBed.createComponent(componentType)
   const componentRef = fixture.componentRef

   change(componentProperties, detectChanges)

   if (detectChanges) {
      fixture.autoDetectChanges(detectChanges)
   }

   function change(componentProperties: Partial<T>, detectChanges = true) {
      for (const [key, value] of Object.entries(componentProperties)) {
         componentRef.setInput(key, value)
      }
      if (detectChanges) {
         fixture.detectChanges(true)
      }
   }

   return fixture.whenStable().then(() => {
      return {
         fixture,
         container: fixture.nativeElement,
         change
      }
   })
}
