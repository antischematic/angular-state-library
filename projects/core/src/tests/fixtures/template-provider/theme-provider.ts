import {get, Invoke, Layout, Select, Store, TemplateProvider} from "@antischematic/angular-state-library";
import {ChangeDetectionStrategy, Component, Directive, ElementRef, inject, Input} from "@angular/core";

@Directive({ standalone: true, selector: 'ui-theme' })
export class UITheme extends TemplateProvider {
   value = {
      color: "rgb(255, 0, 0)"
   }
}

@Store()
@Component({
   standalone: true,
   selector: 'button[theme]',
   template: `
      <ng-content></ng-content>
   `,
   host: {
      "[style.color]": "theme.color"
   },
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class UIThemeButton {
   @Select(UITheme) theme = get(UITheme)
}

@Component({
   imports: [UIThemeButton],
   standalone: true,
   selector: 'child',
   template: `
      <button theme>Current</button>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})

export class Child {}

@Store()
@Component({
   imports: [UITheme, UIThemeButton, Child],
   standalone: true,
   template: `
      <ui-theme>
         <button theme>Default</button>
         <ui-theme [value]="theme">
            <child></child>
         </ui-theme>
      </ui-theme>
   `,
   changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeProvider {
   @Input() theme = {
      color: "rgb(0, 255, 0)"
   }
}
