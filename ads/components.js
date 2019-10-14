"use strict";
const Utility = require("./utility.js");
const {
  DynamicVariable,
  TypedVariable,
  TypedArrayVariable,
  SyncedVariable,
  SyncedArrayVariable,
  FunctionTemplate,
  SyncedMethod,
  DynamicVariableIdentifier,
  TypedVariableIdentifier,
  SyncedVariableIdentifier,
  FunctionTemplateIdentifier,
  SyncedMethodIdentifier
} = Utility.Variables;
const util = require("../lib/util.js");
const Components = [];
let COMPONENTID = 0;
const Component = (() => {
  return {
    Component: ({
      original = null,
      name = "",
      type = null,
      dependencies = [],
      zones = [],
      fields = {},
      properties = {},
      triggers = {},
      client = {},
      methods = {},
      compilation = null,
    }, {
      required = null,
      resettable = null,
      attached = null,
    }) => {
      if (type == null) {
        type = [name];
      }
      if (typeof type !== "object") {
        type = [type];
      }
      if (!type.includes(name)) {
        type.push(name);
      }
      if (original != null) {
        original = Components.find((component) => component.name === original);
        type = type.concat(original.type);
        for (let i = 0, length = original.dependencies.length; i < length; i++) {
          if (!dependencies.includes(original.dependencies[i])) {
            dependencies.push(original.dependencies[i]);
          }
        }
        fields = util.Utility.Overlap(util.Utility.Clone(original.fields), fields);
        properties = util.Utility.Overlap(util.Utility.Clone(original.properties), properties);
        triggers = util.Utility.Overlap(util.Utility.Clone(original.triggers), triggers);
        client = util.Utility.Overlap(util.Utility.Clone(original.client), client);
        methods = util.Utility.Overlap(util.Utility.Clone(original.methods), methods);
        if (resettable == null) {
          resettable = original.configuration.resettable;
        }
        if (attached == null) {
          attached = original.configuration.attached;
        }
      }
      for (const trigger in triggers) {
        if (triggers[trigger].cache == null) {
          triggers[trigger].cache = {};
        }
        if (triggers[trigger].execute == null) {
          triggers[trigger].execute = {};
        }
      }
      const component = {
        name,
        type,
        dependencies,
        zones,
        fields,
        properties,
        triggers, 
        client,
        methods,
        compilation,
        configuration: {
          required: required || false,
          resettable: resettable || true,
          attached: attached || false
        },
        id: COMPONENTID++
      };
      Components.push(component);
    }
  }
})();

Component.Component({
  name: "transform",
  properties: {
    position: [0, 0],
    velocity: [0, 0],
    acceleration: [0, 0],
    facing: 0,
    vfacing: 0
  }
}, {
  required: true,
  resettable: false
});

const z = 0.00001;
const d = 0.004;
const k = Math.exp((1000 / 20) * Math.log(z) / d);
const ef = (1 - k);
Component.Component({
  original: "transform",
  name: "entityTransform",
  fields: {
    damp: 0.05,
    maxSpeed: 0
  },
  triggers: {
    update: ({componentInterface, zoneInterface}) => {
      const transform = componentInterface.getComponent("entityTransform");
      transform.velocity[0] += transform.acceleration[0], transform.velocity[1] += transform.acceleration[1];
      transform.acceleration[0] = 0, transform.acceleration[1] = 0;
      
      let v = 1;

      const dir = Math.atan2(transform.velocity[1], transform.velocity[0]);
      const tv = Math.sqrt(Math.pow(transform.velocity[0], 2) + Math.pow(transform.velocity[1], 2));
      v = k * v + ef * tv;

      transform.position[0] += v * Math.cos(dir);
      transform.position[1] += v * Math.sin(dir);

      const motion = Math.sqrt(Math.pow(transform.velocity[0], 2) + Math.pow(transform.velocity[1], 2));
      const excess = motion - transform.maxSpeed;
      if (excess > 0 && transform.damp) {
        const rk = transform.damp;
        const drag = excess / (rk + 1);
        const finalVelocity = transform.maxSpeed / drag;
        const resistance = ((motion - finalVelocity) / (1 + (motion / drag))) / 10;

        transform.velocity[0] -= resistance * transform.velocity[0] / motion;
        transform.velocity[1] -= resistance * transform.velocity[1] / motion;
      }
    }
  }
}, {});

Component.Component({
  name: "testMovement",
  dependencies: ["entityTransform"],
  properties: {
    movement: SyncedArrayVariable("int8", 2)
  },
  triggers: {
    update: ({componentInterface, zoneInterface}) => {
      const transform = componentInterface.getComponent("entityTransform"), movement = componentInterface.getComponent("testMovement");
      transform.acceleration[0] = movement.movement[0];
      transform.acceleration[1] = movement.movement[1];
    }
  },
  client: {
    variables: {
      commands: [
        false, // UP
        false, // DOWN
        false, // LEFT
        false  // RIGHT
      ],
      flagged: false
    },
    triggers: {
      windowEvents: {
        keydown: function(event) {
          console.log(this);
          if (event.code === "ArrowUp" || event.code === "KeyW") {
            this.commands[0] = true;
            this.flagged = true;
          } else if (event.code === "ArrowDown" || event.code === "KeyS") {
            this.commands[1] = true;
            this.flagged = true;
          } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
            this.commands[2] = true;
            this.flagged = true;
          } else if (event.code === "ArrowRight" || event.code === "KeyD") {
            this.commands[3] = true;
            this.flagged = true;
          }
        },
        keyup: function(event) {
          if (event.code === "ArrowUp" || event.code === "KeyW") {
            this.commands[0] = false;
            this.flagged = true;
          } else if (event.code === "ArrowDown" || event.code === "KeyS") {
            this.commands[1] = false;
            this.flagged = true;
          } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
            this.commands[2] = false;
            this.flagged = true;
          } else if (event.code === "ArrowRight" || event.code === "KeyD") {
            this.commands[3] = false;
            this.flagged = true;
          }
        }
      },
      frame: function() {
        if (this.flagged == true) {
          this.movement[0] = this.commands[3] - this.commands[2];
          this.movement[1] = this.commands[1] - this.commands[0];
          this.flagged = false;
        }
      }
    }
  }
}, {});

Component.Component({
  name: "info",
  dependencies: [],
  fields: {
    label: "",
    name: ""
  },
  properties: {
    thing: SyncedVariable("int8", 10),
    otherarraything: SyncedArrayVariable("int32", 2),
    arraything: SyncedArrayVariable("int16", 4),
    lastthing: 10
  },
  triggers: {
    update: ({componentInterface, zoneInterface}) => {
      const info = componentInterface.getComponent("info");
      if (info.thing !== info.lastthing) {
        console.log(info.thing);
        info.thing = info.thing + 1;
        info.lastthing = info.thing;
        info.arraything[0] += 1;
        console.log(info.arraything);
      }
    }
  },
  client: {
    triggers: {
      window: {
        keydown: function() {
          console.log("a key was down");
          console.log(this);
          console.log(this.thing);
          console.log(this.blocks);
          console.log(this.arraything.join(","));
          this.arraything[0] += 20;
          this.thing += 1;
        }
      }
    }
  }
}, {});

Component.Component({
  name: "testRenderer",
  type: "renderer",
  dendencies: ["transform"],
  fields: {
    shape: 0,
    size: FunctionTemplate((input) => {
      if (Array.isArray(input)) {
        return input;
      } else {
        return [input, input];
      }
    }),
    color: "#000000",
    fov: 0
  },
  properties: {
    camera: [0, 0]
  },
  compilation: function({instance, construct, information, shareCache}) {
    const points = [];
    let angle = 0;
    if (!(information.shape % 2)) {
      angle = Math.PI / information.shape;
    }
    for (let i = 0; i < information.shape; i++) {
      const theta = (i / information.shape) * 2 * Math.PI;
      points.push([
        Math.cos(theta + angle),
        Math.sin(theta + angle)
      ]);
    }
    this.rendered = Utility.RenderBlocks.Create(information.color, [0, 0], information.size, 0, points);
  },
  triggers: {
    attachment: function({componentInterface, renderBlocks}) {
      renderBlocks.addData(this.sharedCache.rendered);
    },
    update: function({componentInterface, renderBlocks}) {
      const transform = componentInterface.getComponent("transform"), renderer = componentInterface.getComponent("testRenderer");
      const distance = Math.sqrt(Math.pow(transform.position[0] - renderer.camera[0], 2) + Math.pow(transform.position[1] - renderer.camera[1], 2));
      if (distance > 0) {
        const dir = Math.atan2(transform.position[1] - renderer.camera[1], transform.position[0] - renderer.camera[0]);
        const v = k + ef * (distance / 1.2);
        renderer.camera[0] += v * Math.cos(dir);
        renderer.camera[1] += v * Math.sin(dir);
      }
      renderBlocks.position(transform.position);
      renderBlocks.exportData();
    }
  }
}, {});

module.exports = Components;