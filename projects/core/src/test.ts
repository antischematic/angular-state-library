// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js';
import 'zone.js/testing';
import {getTestBed} from '@angular/core/testing';
import {
   BrowserDynamicTestingModule,
   platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';
import {initStoreTestEnvironment} from "../testing/init-store-test-environment";
// @ts-ignore
import JasmineDOM from '@testing-library/jasmine-dom';
import {autoUnsubscribe} from "@hirez_io/observer-spy";

beforeAll(() => {
   jasmine.addMatchers(JasmineDOM);
});

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);
autoUnsubscribe()
initStoreTestEnvironment()
