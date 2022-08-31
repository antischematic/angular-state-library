import { Component } from '@angular/core';

@Component({
   standalone: true,
   selector: 'ui-spinner',
   template: `
    <div class="lds-ellipsis">
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  `,
   styles: [
      `
    .lds-ellipsis {
      display: inline-block;
      position: relative;
      width: 80px;
      height: 20px;
  }
  .lds-ellipsis div {
      position: absolute;
      top: 6px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #777777;
      animation-timing-function: cubic-bezier(0, 1, 1, 0);
  }
  .lds-ellipsis div:nth-child(1) {
      left: 8px;
      animation: lds-ellipsis1 0.6s infinite;
  }
  .lds-ellipsis div:nth-child(2) {
      left: 8px;
      animation: lds-ellipsis2 0.6s infinite;
  }
  .lds-ellipsis div:nth-child(3) {
      left: 24px;
      animation: lds-ellipsis2 0.6s infinite;
  }
  .lds-ellipsis div:nth-child(4) {
      left: 40px;
      animation: lds-ellipsis3 0.6s infinite;
  }
  @keyframes lds-ellipsis1 {
      0% {
        transform: scale(0);
      }
      100% {
        transform: scale(1);
      }
  }
  @keyframes lds-ellipsis3 {
      0% {
        transform: scale(1);
      }
      100% {
        transform: scale(0);
      }
  }
  @keyframes lds-ellipsis2 {
      0% {
        transform: translate(0, 0);
      }
      100% {
        transform: translate(16px, 0);
      }
  }
  `,
   ],
})
export class UISpinner {}
