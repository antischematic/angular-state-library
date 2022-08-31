import {
   HttpHandler,
   HttpInterceptor,
   HttpRequest,
   HttpResponse,
   HTTP_INTERCEPTORS,
} from '@angular/common/http';
import { Injectable, NgModule } from '@angular/core';
import { map } from 'rxjs';
import { Todo } from './interfaces';

let id = 1000;

// Simulate Todo CRUD API
@Injectable({ providedIn: 'root' })
export class FakeBackend implements HttpInterceptor {
   cache = new Map<number, Todo[]>();

   intercept(req: HttpRequest<any>, next: HttpHandler) {
      if (req.url.startsWith('https://jsonplaceholder.typicode.com/todos')) {
         return next.handle(req.clone()).pipe(
            map((event) => {
               if (event instanceof HttpResponse) {
                  const userId = req.params.get('userId') ?? req.body?.userId;
                  let todos = this.cache.get(+userId) as Todo[];
                  switch (req.method) {
                     case 'GET':
                        if (!todos) {
                           todos = event.body;
                        }
                        this.cache.set(+userId, todos);
                        return new HttpResponse({ status: 200, body: todos });
                     case 'POST':
                        const newTodo = {
                           id: id++,
                           ...req.body,
                        };
                        todos = todos.concat(newTodo);
                        this.cache.set(+userId, todos);
                        return new HttpResponse({ status: 200, body: newTodo });
                     case 'PUT':
                        todos = todos.map((existing) =>
                           existing.id === req.body.id ? req.body : existing
                        );
                        this.cache.set(+userId, todos);
                        return new HttpResponse({ status: 200, body: { ...req.body } });
                  }
               }
               return event;
            })
         );
      } else {
         return next.handle(req);
      }
   }
}

@NgModule({
   providers: [
      [
         {
            provide: HTTP_INTERCEPTORS,
            multi: true,
            useClass: FakeBackend,
         },
      ],
   ],
})
export class FakeBackendModule {}
