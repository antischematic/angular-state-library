import {
   ChangeDetectionStrategy,
   Component,
   EventEmitter,
   Input,
   Output,
} from '@angular/core';
import { createDispatch, Invoke, Store } from '@antischematic/angular-state-library';
import {Observable, timer} from 'rxjs';
import { Counter } from './providers';

@Store()
@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
   providers: [Counter.Provide(UICounter)],
   selector: 'ui-counter',
   standalone: true,
   template: `
    <p>UICounter: {{ count }}</p>
    <dd>
      <ng-content></ng-content>
    </dd>
  `,
})
export class UICounter {
   @Input() count = 0;
   @Output() countChange = new EventEmitter<number>(true);

   @Invoke() autoIncrement(): Observable<number> {
      this.count++;
      this.countChange.emit(this.count);

      return dispatch(timer(1000), {
         next: this.autoIncrement,
      });
   }
}

const dispatch = createDispatch(UICounter);
