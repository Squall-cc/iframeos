// isapi.js — the iSApi bridge for raw (HTML) apps.
//
// Raw apps are plain HTML pages loaded through a scramjet iframe backed by the
// virtual filesystem transport (the same mechanism the app store uses, except
// served from the VFS instead of the internet). This script gives them the
// same platform API surface the TypeScript apps get: filesystem, registry,
// shell dialogs, launching apps and control of their own window.
//
// It is loaded inside the app's iframe with <script src="/iSi/js/isapi.js">.
// Every call is forwarded to the host page with an aspen "eval" request, which
// evaluates the code where window.__API lives (see fstransport.handleEval).

(function () {
  "use strict";

  function outEval(code) {
    return fetch("https://aspen/eval/" + encodeURIComponent(code)).then(
      function (res) {
        return res.text().then(function (text) {
          if (!res.ok) throw new Error(text || "aspen eval failed");
          return text ? JSON.parse(text) : undefined;
        });
      },
    );
  }

  function j(v) {
    return JSON.stringify(v);
  }

  function call(expr, args) {
    return outEval(
      "window.__API." +
        expr +
        "(" +
        args
          .map(function (a) {
            return a === undefined ? "undefined" : JSON.stringify(a);
          })
          .join(",") +
        ")",
    );
  }

  function currentQuery() {
    return new URLSearchParams(window.location.search);
  }

  var api = {
    version: "1.0.0",

    fs: {
      exists: function (p) {
        return call("fs.exists", [p]);
      },
      isFile: function (p) {
        return call("fs.isFile", [p]);
      },
      isDirectory: function (p) {
        return call("fs.isDirectory", [p]);
      },
      getTimestamps: function (p) {
        return call("fs.getTimestamps", [p]);
      },
      listDirectory: function (p) {
        return call("fs.listDirectory", [p]);
      },
      createDirectory: function (p) {
        return call("fs.createDirectory", [p]);
      },
      createFile: function (p) {
        return call("fs.createFile", [p]);
      },
      deleteFile: function (p) {
        return call("fs.deleteFile", [p]);
      },
      deleteDirectory: function (p) {
        return call("fs.deleteDirectory", [p]);
      },
      deleteDirectoryRecursive: function (p) {
        return call("fs.deleteDirectoryRecursive", [p]);
      },
      rename: function (oldPath, newPath) {
        return call("fs.rename", [oldPath, newPath]);
      },
      readFile: function (p) {
        return outEval(
          "(async()=>{var h=window.__API.fs.openFile(" +
            j(p) +
            ");return await h.read();})()",
        );
      },
      writeFile: function (p, data) {
        return outEval(
          "(async()=>{var fs=window.__API.fs;var b=new Blob([" +
            j(data) +
            "]);await fs.data.write(" +
            j(p) +
            ",b);fs.updateFileMeta(" +
            j(p) +
            ",b);})()",
        );
      },
      appendFile: function (p, data) {
        return outEval(
          "(async()=>{var fs=window.__API.fs;var e=await fs.data.read(" +
            j(p) +
            ");var b=new Blob([e?e:new Blob([]),new Blob([" +
            j(data) +
            "])]);await fs.data.write(" +
            j(p) +
            ",b);fs.updateFileMeta(" +
            j(p) +
            ",b);})()",
        );
      },
    },

    registry: {
      getValue: function (path, name) {
        return outEval(
          "new window.__API.registry.RegistryInstanceAccess()._load(" +
            j(path) +
            ").then(function(r){return r?r.values[" +
            j(name) +
            "]??null:null;})",
        );
      },
      setValue: function (path, name, value) {
        return outEval(
          "new window.__API.registry.RegistryInstanceAccess()._write(" +
            j(path) +
            "," +
            j(name) +
            "," +
            j(value) +
            ")",
        );
      },
      deleteValue: function (path, name) {
        return outEval(
          "new window.__API.registry.RegistryInstanceAccess()._deleteValue(" +
            j(path) +
            "," +
            j(name) +
            ")",
        );
      },
      deleteKey: function (path) {
        return outEval(
          "new window.__API.registry.RegistryInstanceAccess()._deleteKey(" +
            j(path) +
            ")",
        );
      },
    },

    shellModal: function (type, title, content) {
      return outEval(
        "window.__API.shellModal(" +
          j(type) +
          ", Symbol(), " +
          j(title) +
          ", " +
          j(content) +
          ")",
      );
    },

    shellAsk: function (fields, title, content, options) {
      return outEval(
        "window.__API.shellAsk(" +
          j(fields) +
          ", " +
          j(title) +
          ", " +
          j(content || undefined) +
          ", " +
          j(options || undefined) +
          ")",
      );
    },

    shellSelectFile: function (options) {
      return outEval("window.__API.shellSelectFile(" + j(options || undefined) + ")");
    },

    shellSelectDir: function (options) {
      return outEval("window.__API.shellSelectDir(" + j(options || undefined) + ")");
    },

    shellOpen: function (filename) {
      return outEval("window.__API.shellOpen(" + j(filename) + ")");
    },

    shellOpenWithPicker: function (filename) {
      return outEval("window.__API.shellOpenWithPicker(" + j(filename) + ")");
    },

    shellOpenWith: function (filename) {
      return outEval("window.__API.shellOpenWith(" + j(filename) + ")");
    },

    getAllInstalledApps: function () {
      return outEval("window.__API.getAllInstalledApps()");
    },

    launchSpaApp: function (key) {
      return outEval("window.__API.launchSpaApp(" + j(key) + ")");
    },

    launchRawApp: function (key) {
      return outEval("window.__API.launchRawApp(" + j(key) + ")");
    },

    getInstalledAppType: function (key) {
      return outEval("window.__API.getInstalledAppType(" + j(key) + ")");
    },

    // ---- info passed to the app when it was launched ----

    // the file that was passed to a file handler, from ?file=/path
    getFileArg: function () {
      return currentQuery().get("file");
    },

    // the ulid of this app's window, from ?hwnd=<ulid>
    getHWndArg: function () {
      return currentQuery().get("hwnd");
    },

    // a WindowHandle-like proxy for this app's own window (null if it wasn't
    // given a hwnd). DOM content can't be pushed across the iframe boundary,
    // so setContent is intentionally absent.
    getWindow: function () {
      var ulid = currentQuery().get("hwnd");
      if (!ulid) return null;
      var get = function (method, args) {
        return outEval(
          "(function(){var w=window.__API.WindowHandle.fromHWnd(" +
            j(ulid) +
            ");if(!w)return null;return w." +
            method +
            "(" +
            args
              .map(function (a) {
                return a === undefined ? "undefined" : JSON.stringify(a);
              })
              .join(",") +
            ");})()",
        );
      };
      return {
        close: function () {
          return get("close", []);
        },
        minimize: function () {
          return get("minimize", []);
        },
        maximize: function () {
          return get("maximize", []);
        },
        bringupwards: function () {
          return get("bringupwards", []);
        },
        getTitle: function () {
          return get("getTitle", []);
        },
        dimensions: function () {
          return get("dimensions", []);
        },
        setDimensions: function (d) {
          return get("setDimensions", [d]);
        },
        position: function () {
          return get("position", []);
        },
        setPosition: function (p) {
          return get("setPosition", [p]);
        },
        setCenter: function (c) {
          return get("setCenter", [c]);
        },
        setMinSize: function (minWidth, minHeight) {
          return get("setMinSize", [minWidth, minHeight]);
        },
        getMouseInfo: function () {
          return get("getMouseInfo", []);
        },
      };
    },
  };

  window.isapi = api;
  window.shellModal = api.shellModal;
  window.shellAsk = api.shellAsk;
  window.shellSelectFile = api.shellSelectFile;
  window.shellSelectDir = api.shellSelectDir;
  window.shellOpen = api.shellOpen;
  window.shellOpenWithPicker = api.shellOpenWithPicker;
  window.shellOpenWith = api.shellOpenWith;
  window.getAllInstalledApps = api.getAllInstalledApps;
  window.launchSpaApp = api.launchSpaApp;
  window.launchRawApp = api.launchRawApp;
  window.getInstalledAppType = api.getInstalledAppType;
  window.getFileArg = api.getFileArg;
  window.getWindow = api.getWindow;
})();
