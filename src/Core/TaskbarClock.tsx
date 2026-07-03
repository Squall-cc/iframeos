import "./TaskbarClock.css";

import type { Component } from "solid-js";
import { createSignal, onCleanup } from "solid-js";

const TaskbarClock: Component = () => {
  const [time, setTime] = createSignal(new Date());

  const interval = setInterval(() => {
    setTime(new Date());
  }, 1000);
  onCleanup(() => clearInterval(interval));

  const formattedTime = () => {
    const t = time();
    const hours = t.getHours() % 12 || 12;
    return `${hours}:${t.getMinutes().toString().padStart(2, "0")} ${t.getHours() > 12 ? "PM" : "AM"}\n${t.getDate()}/${t.getMonth() + 1}/${t.getFullYear()}`;
  };

  return <div id="taskbar-clock">{formattedTime()}</div>;
};

export default TaskbarClock;
