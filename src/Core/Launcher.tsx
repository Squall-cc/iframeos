import "./Launcher.css";

import type { Component } from "solid-js";
import { For } from "solid-js";

import browser from "../SysApps/browser";
import draw from "../SysApps/draw";
import hello from "../SysApps/hello";
import hi from "../SysApps/hi";
import launch from "../SysApps/launch";

import { spawn } from "./windowhelpers";

const apps = new Map([
  ["hi", hi],
  ["hello", hello],
  ["draw", draw],
  ["launch", launch],
  ["browser", browser],
]);

const Launcher: Component = () => {
  return (
    <div id="launcher">
      <For each={[...apps]}>
        {([key, run]) => <button onClick={() => spawn(key, run)}>{key}</button>}
      </For>
    </div>
  );
};

export default Launcher;
