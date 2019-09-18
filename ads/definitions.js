"use strict";
const Utility = require("./utility.js");
const Components = require("./components.js");
const Zones = require("./zones.js");
const util = require("../lib/util.js");
const config = require("../config.json").definitions;
let INDEX = 0;
const ADS = {
  Components: Components,
  Required: Components.filter((component) => component.configuration.required),
  Definitions: [],
  Engines: []
}
ADS.Definition = (name, {
  templates = [],
  components = [],
  zones = [Zones[1].default],
  configuration = {}
}, definition) => {
  configuration = util.Utility.Overlap({
    dataview: false
  }, configuration);
  for (let i = 0, length = templates.length; i < length; i++) {
    templates[i] = ADS.Definitions.find((definition) => definition[0] === templates[i]);
  }
  definition = Utility.Template(templates, definition);
  definition.components = [];
  for (let i = 0, length = components.length; i < length; i++) {
    const add = ADS.Components.find((component) => component.name === components[i]);
    if (add != null) {
      definition.components.push(add);
    } else {
      throw new Error("Component " + components[i] + " does not exist!");
    }
  }
  definition.zones = zones;
  Utility.AddRequired(ADS.Required, definition.components);
  definition.configuration = configuration;
  ADS.Definitions.push([name, definition]);
}
ADS.EngineFunction = (name, {
  frequency = 0,
  requirements = [],
  root = Zones[1].default,
  zones = [],
  flags = {}
}, engine) => {
  const engineFunction = {
    name,
    frequency,
    requirements,
    flags,
    zones: zones.map((zone) => {
      if (!Zones[1].items.includes(zone.split(".")[0])) {
        return root + "." + zone;
      } else {
        return zone;
      }
    }),
    engine
  };
  ADS.Engines.push(engineFunction);
}
///
/// <DEFINITIONS>
///
ADS.Definition("basic", {
  components: ["info", "testRenderer", "entityTransform", "testMovement"]
}, {
  info: {
    label: "Basic Tank"
  },
  testRenderer: {
    shape: 4,
    size: 10,
    fov: 100,
    color: "#FF0000"
  }
});

ADS.EngineFunction("engine", {
  zones: ["root.hello.child.little child"],
  frequency: 1000 / 10,
}, () => null);
///
/// </DEFINITIONS>
///
const Compile = (zones) => {
  const Compiled = {}, globalCache = {};
  const splitVersion = config.version.split(":");
  const systemName = splitVersion[0].toUpperCase();
  const versionType = (splitVersion[1][0] === "r") ? "Release" : (splitVersion[1][0] === "b") ? "Beta" : (splitVersion[1][0] === "a") ? "Alpha" : (splitVersion[1][0] === "v") ? "Velocity" : "Unknown version";
  const versionNumber = splitVersion[1].substr(1);
  util.log("Definition system: " + systemName + " - " + versionType + " " + versionNumber);
  const compilationStart = util.time();
  for (let i = 0, length = ADS.Definitions.length; i < length; i++) {
    const compiled = Utility.Compile(ADS.Components, ADS.Definitions[i][1], globalCache, zones);
    compiled[0].index = INDEX++;
    Compiled[ADS.Definitions[i][0]] = compiled;
  }
  util.log("Definition compilation took " + (util.time() - compilationStart) + " microseconds");
  return Compiled;
}

const ZoneData = Zones[0](ADS.Engines);
module.exports = [Compile(ZoneData), ZoneData, Zones[1]];