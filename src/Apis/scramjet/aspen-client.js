export async function outEval(code) {
  const res = await fetch("https://aspen/eval/" + encodeURIComponent(code));
  const text = await res.text();
  if (!res.ok) throw new Error(text || `aspen eval failed (${res.status})`);
  return text ? JSON.parse(text) : undefined;
}

function makeProxy(path) {
  return new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") {
        const result = outEval(path);
        return result.then.bind(result);
      }
      if (typeof prop === "symbol") return undefined;
      return makeProxy(`${path}.${String(prop)}`);
    },
    apply(_target, _thisArg, args) {
      return outEval(`${path}(${args.map((a) => JSON.stringify(a)).join(",")})`);
    },
    construct(_target, args) {
      return outEval(`new ${path}(${args.map((a) => JSON.stringify(a)).join(",")})`);
    },
  });
}

export const aspen = makeProxy("window.__API");

if (typeof window !== "undefined") {
  window.aspen = aspen;
  window.outEval = outEval;
}
