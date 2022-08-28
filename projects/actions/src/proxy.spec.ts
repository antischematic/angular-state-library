import {createProxy, getContext, isProxy, runInContext, size, track} from "./proxy";


function createProxyTest<T extends object>(object: T): [T, T] {
  const proxy = createProxy(object)
  return [proxy, object]
}


describe("proxy", () => {
  it("should create a proxy object", () => {
    const deps = new Map()
    runInContext(deps, () => {
      const object = {}
      const proxy = createProxy(object)
      expect(isProxy(proxy)).toBeTrue()
    })
  })

  it("should track property access", () => {
    const deps = new Map()
    runInContext(deps, () => {
      const [proxy, object] = createProxyTest({a: 1})

      void proxy.a

      expect(deps.get(object)).toEqual(new Map([["a", 1]]))
    })
  })

  it("should not track deep property access", () => {
    const deps = new Map()
    runInContext(deps, () => {
      const [proxy, object] = createProxyTest({a: {b: 2}})

      void proxy.a.b

      expect(deps.get(object)).toEqual(new Map([["a", { b: 2 }]]))
      expect(deps.get(object.a)).toEqual(undefined)
    })
  })

  it("should track ECMAScript Sets", () => {
    const deps = new Map()
    runInContext(deps, () => {
      const b = { b: 2 }
      const c = { c: 3 }
      const [proxy, object] = createProxyTest(new Set([b, c]))

      void proxy.has(b)
      void proxy.size

      expect(deps.get(object)).toEqual(new Map<any, any>([[b, b], [size, 2]]))
    })
  })

  it("should track ECMAScript Maps", () => {
    const deps = new Map()
    runInContext(deps, () => {
      const b = { b: 2 }
      const c = { c: 3 }
      const [proxy, object] = createProxyTest(new Map([[b, c]]))

      void proxy.has(b)
      void proxy.size

      expect(deps.get(object)).toEqual(new Map<any, any>([[b, c], [size, 1]]))
    })
  })

  it("should track deep property access when using the track helper", () => {
    const deps = new Map()
    runInContext(deps, () => {
      const [proxy, object] = createProxyTest({a: { b: 2 } })

      void track(proxy.a).b

      expect(deps.get(object)).toEqual(new Map([["a", { b: 2 }]]))
      expect(deps.get(object.a)).toEqual(new Map([["b", 2]]))
    })
  })
})
