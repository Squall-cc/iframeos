//old v2 vanta except i prettified it
function topology(t, e = {}) {
    let o = e.colorR ?? 137,
        r = e.colorG ?? 171,
        l = e.colorB ?? 14,
        n = e.backgroundColor ?? "#008542",
        a = e.particles ?? 4500,
        i = new Float64Array(257);
    for (let t = 0; t <= 256; t++) i[t] = .5 * (1 - Math.cos(t / 256 * Math.PI));

    function c(t) {
        let e = 256 * t,
            o = 0 | e;
        return i[o] + (e - o) * (i[o + 1] - i[o])
    }
    let s = new Float64Array(100),
        u = new Float64Array(100);
    for (let t = 0; t < 100; t++) {
        let e = t / 100 * Math.PI * 2;
        s[t] = .1 * Math.cos(e), u[t] = .1 * Math.sin(e)
    }
    let d = new Float64Array(4096);
    for (let t = 0; t <= 4095; t++) d[t] = Math.random();

    function y(t, e) {
        t < 0 && (t = -t), e < 0 && (e = -e);
        let o = 0 | t,
            r = 0 | e,
            l = t - o,
            n = e - r,
            a = 0,
            i = .5;
        for (let t = 0; t < 4; t++) {
            let t = o + (r << 4),
                e = c(l),
                s = c(n),
                u = d[4095 & t];
            u += e * (d[t + 1 & 4095] - u);
            let y = d[t + 16 & 4095];
            y += e * (d[t + 16 + 1 & 4095] - y), u += s * (y - u), a += u * i, i *= .5, o <<= 1, r <<= 1, n *= 2, (l *= 2) >= 1 && (o++, l--), n >= 1 && (r++, n--)
        }
        return a
    }
    let f, h, w, g, p, m, A, F, b, M, v, S, k = t.getContext("2d"),
        C = null;

    function q() {
        f = t.width = t.clientWidth || window.innerWidth, h = t.height = t.clientHeight || window.innerHeight, k.fillStyle = n, k.fillRect(0, 0, f, h),
            function() {
                w = (f + 200) / 10 | 0, g = (h + 200) / 10 | 0;
                let t = w * g;
                p = new Float32Array(t), m = new Float32Array(t);
                for (let t = 0; t < g; t++) {
                    let e = .003 * t,
                        o = t * w;
                    for (let t = 0; t < w; t++) {
                        let r = .003 * t,
                            l = 0,
                            n = 1,
                            a = 0,
                            i = 0,
                            c = 0,
                            d = 0;
                        for (let t = 0; t < 100; t++) {
                            let o = r + s[t],
                                f = e + u[t],
                                h = y(o, f);
                            h > l && (l = h, a = o, i = f), h < n && (n = h, c = o, d = f)
                        }
                        let f = c - a,
                            h = d - i,
                            w = Math.sqrt(f * f + h * h) || 1,
                            g = l - n,
                            A = o + t;
                        p[A] = f / w * g, m[A] = h / w * g
                    }
                }
            }(),
            function() {
                let t = f + 200,
                    e = h + 200;
                A = new Float32Array(a), F = new Float32Array(a), b = new Float32Array(a), M = new Float32Array(a), v = new Float32Array(a), S = new Float32Array(a);
                for (let o = 0; o < a; o++) A[o] = b[o] = Math.random() * t, F[o] = M[o] = Math.random() * e
            }()
    }
    let E = "rgba(" + o + "," + r + "," + l + ",0.05)",
        I = () => q();
    return window.addEventListener("resize", I), q(),
        function t() {
            (function() {
                let t = f + 200,
                    e = h + 200,
                    o = t - 1,
                    r = e - 1,
                    l = w - 1,
                    n = g - 1;
                for (let i = 0; i < a; i++) {
                    let a = A[i];
                    a < 0 ? a = 0 : a > o && (a = o);
                    let c = F[i];
                    c < 0 ? c = 0 : c > r && (c = r);
                    let s = .1 * a | 0;
                    s > l && (s = l);
                    let u = .1 * c | 0;
                    u > n && (u = n);
                    let d = u * w + s;
                    b[i] = A[i], M[i] = F[i];
                    let y = A[i] + v[i],
                        f = F[i] + S[i];
                    A[i] = (y % t + t) % t, F[i] = (f % e + e) % e;
                    let h = v[i] + 3 * p[d],
                        g = S[i] + 3 * m[d],
                        k = 2.2 / (Math.sqrt(h * h + g * g) || 1);
                    v[i] = h * k, S[i] = g * k
                }
                k.strokeStyle = E, k.lineWidth = 1, k.beginPath();
                for (let t = 0; t < a; t++) {
                    let e = b[t] - A[t],
                        o = M[t] - F[t];
                    e * e + o * o < 100 && (k.moveTo(b[t] - 100, M[t] - 100), k.lineTo(A[t] - 100, F[t] - 100))
                }
                k.stroke()
            })(), C = requestAnimationFrame(t)
        }(), {
        destroy() {
            null !== C && cancelAnimationFrame(C), window.removeEventListener("resize", I)
        }
    }
}
export const VANTA = {
    TOPOLOGY(t = {}) {
        var e;
        let o = "string" == typeof t.el ? document.querySelector(t.el) : t.el,
            r = document.createElement("canvas");
        Object.assign(r.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            display: "block",
            zIndex: "0",
            pointerEvents: "none"
            // eslint-disable-next-line no-undef
        }), "static" === getComputedStyle(o).position && (o.style.position = "relative"), o.prepend(r);
        let [l, n, a] = function(t, e, o, r) {
            if (null == t) return [e, o, r];
            let l = "number" == typeof t ? t : parseInt(String(t).replace("#", ""), 16);
            return isNaN(l) ? [e, o, r] : [l >> 16 & 255, l >> 8 & 255, 255 & l]
        }(t.color, 137, 171, 14), i = null == (e = t.backgroundColor) ? "#008542" : "number" == typeof e ? "#" + e.toString(16).padStart(6, "0") : String(e), c = topology(r, {
            colorR: l,
            colorG: n,
            colorB: a,
            backgroundColor: i
        });
        return {
            destroy() {
                c.destroy(), r.remove()
            }
        }
    }
};