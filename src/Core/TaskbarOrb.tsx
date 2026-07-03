import "./TaskbarOrb.css";

import type { Component } from "solid-js";

interface TaskbarOrbProps {
  onClick?: () => void;
}

const TaskbarOrb: Component<TaskbarOrbProps> = (props) => {
  return <div id="taskbar-orb" onClick={() => props.onClick?.()} />;
};

export default TaskbarOrb;
