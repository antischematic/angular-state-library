import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output,} from '@angular/core';
import {dispatch, Invoke, Store} from '@antischematic/angular-state-library';
import {timer} from 'rxjs';

@Store()
@Component({
   changeDetection: ChangeDetectionStrategy.OnPush,
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

   @Invoke() autoIncrement() {
      this.count++;
      this.countChange.emit(this.count);

      dispatch(timer(1000), {
         next: this.autoIncrement,
      });
   }
}
