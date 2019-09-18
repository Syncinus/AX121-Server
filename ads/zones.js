const EventEmitter = require("events");
const util = require("../lib/util.js");
const Utility = require("./utility.js");
const ADSZ = {
  Behaviour: {},
  Zones: [],
  ROOT: {
		default: "root",
		items: [
			"root"
		]
  }
};

ADSZ.Behaviour = ({
  name = "",
  cache = {}
}, behaviour) => {
  behaviour.cache = cache;
  ADSZ.Behaviour[name] = behaviour.bind(cache);
}

ADSZ.Zone = ({
  name = "",
  type = null,
  order = 0,
  behaviour = [],
  setup = {},
	children = [],
	parents = [],
	initilizer = {},
	root = ADSZ.ROOT.default
}) => {
  if (type == null) {
    type = [name];
	}
  if (!Array.isArray(type)) {
    type = [type];
	}
  if (!type.includes(name)) {
    type.push(name);
	}
	if (!ADSZ.ROOT.items.includes(root)) {
		throw new Error("Invalid root " + '"' + root + '"');
	}
	const emitter = new EventEmitter();
	emitter.setMaxListeners(0);
	const zone = {
		name,
		root,
		type,
		order,
		emitter,
		initilizer: util.Utility.Overlap({
			base: [],
			length: 0,
			fill: null,
			key: null
		}, initilizer),
		children,
		parents: [],
		adoption: (parent) => {
			zone.parents.unshift(parent);
			for (let i = 0, length = children.length; i < length; i++) {
				children[i].adoption(parent);
			}
		}
	};
	for (let i = 0, length = parents.length; i < length; i++) {
		let parentRoot = parents[i].split(".")[0];
		if (!ADSZ.ROOT.items.find(parentRoot)) {
			parentRoot = root;
		} else {
			parents[i] = parents[i].split(".").slice(1).join(".");
		}
		const find = parents[i].split(".");
		if (find.length !== 0) {
			const TargetSettingObject = zones.find((zone) => zone.root === parentRoot && zone.name === find[0]);
			for (let j = 1, length2 = find.length; j < length2; j++) {
				TargetSettingObject = TargetSettingObject.children.find((zone) => zone.name === find[j]);
			}
			TargetSettingObject.children.push(zone);
			zone.adoption(TargetSettingObject);
		}
	}
	for (let i = 0, length = children.length; i < length; i++) {
		children[i].adoption(zone);
	}
	zone.trigger = (event, ...args) => {
		const callback = [];
		emitter.emit(event, callback, ...args);
		if (callback.length === 0) {
			return true;
		} else {
			return callback;
		}
	}
	for (let i = 0, length = behaviour.length; i < length; i++) {
		if (ADSZ.Behaviour[behaviour[i]] != null) {
			const executionFunctions = ADSZ.Behaviour[behaviour[i]](setup);
			for (const execution in executionFunctions) {
				emitter.on(execution, (...args) => {
					const run = executionFunctions[execution].apply(zone, args.slice(1));
					if (run == null) {
						args[0].push(true);
					} else {
						args[0].push(run); // CALLBACK ARRAY
					}
				});
			}
		} else {
			throw new Error("Non-existent behaviour " + '"' + behaviour[i] + '"');
		}
	}
	zone.trigger("mount");
	/*
  const zone = {
		configuration: {
		name,
		identifier: name,
		root,
		type,
		order,
		parent: [],
		adoption: (parent) => {
			zone.parent.unshift(parent);
			for (let i = 0, length = children.length; i < length; i++) {
				children[i].adoption(parent);
			}
			zone.name = zone.parent.map((item) => item.identifier).join(".") + "." + zone.identifier;
		}
	};
	for (let i = 0, length = children.length; i < length; i++) {
		children[i].adoption(zone);
	}
  for (let i = 0, length = behaviour.length; i < length; i++) {
    if (ADSZ.Behaviour[behaviour[i]]) {
      const executionFunctions = ADSZ.Behaviour[behaviour[i]](setup);
      for (let execution in executionFunctions) {
				emitter.on(execution, executionFunctions[execution]);
      }
  	} else {
      throw new Error("Non-existent behaviour + " + '"' + behaviour[i] + '"');
    }
	}
	ADSZ.Zones.push(zone);
	return zone;
	*/
	ADSZ.Zones.push(zone);
	return zone;
}

ADSZ.Behaviour({
  name: "testBehaviour",
  cache: {}
}, (zone) => {
  return {
    mount: () => {
      console.log("Mounted to a zone");
		},
		set: (key, value) => {
			return true;
		}
  }
});

ADSZ.Zone({
	name: "hello",
	behaviour: ["testBehaviour"],
	initilizer: {
		base: {},
		length: 10,
		key: "item_"
	},
	children: [
		ADSZ.Zone({
			name: "child",
			children: [
				ADSZ.Zone({
					name: "little child"
				})
			]
		})
	]
});

ADSZ.ZoneMap = {};
ADSZ.Add = (zone) => {
	const compiled = Utility.CompileZone(zone);
	let TargetSettingObject = ADSZ.ZoneMap[zone.root];
  for (let j = 0, length2 = zone.parents.length; j < length2; j++) {
    TargetSettingObject = TargetSettingObject[zone.parents[j].name];
  }
	Reflect.set(TargetSettingObject, "CHILDREN_" + zone.name, compiled);
	return compiled;
}
ADSZ.Remove = (zone) => {
	if (typeof zone !== "string") {
		zone = zone.root + "." + zone.parents.map((parent) => parent.name).join(".") + zone.name;
	}
	let root = zone.split(".")[0];
	if (!ADSZ.ROOT.items.find(root)) {
		root = ADSZ.ROOT.default;
	} else {
		zone = zone.split(".").slice(1).join(".");
	}
	zone = root + "." + zone;
	const split = zone.split(".");
	const TargetRemovalObject = ADSZ.ZoneMap;
	for (let i = 0, length = split.length; i < length; i++) {
		TargetRemovalObject = TargetRemovalObject[split[i]];
	}
	Reflect.set(TargetRemovalObject, "REMOVED_CLEAN", true);
}
ADSZ.Find = (zone) => {
	if (typeof zone !== "string") {
		zone = zone.root + "." + zone.parents.map((parent) => parent.name).join(".") + zone.name;
	}
	let root = zone.split(".")[0];
	if (!ADSZ.ROOT.items.find(root)) {
		root = ADSZ.ROOT.default;
	} else {
		zone = zone.split(".").slice(1).join(".");
	}
	zone = root + "." + zone;
	const split = zone.split(".");
	const TargetFindObject = ADSZ.ZoneMap;
	for (let i = 0, length = split.length; i < length; i++) {
		TargetFindObject = TargetFindObject[split[i]];
	}
	return TargetFindObject;
}
ADSZ.Zones.sort((a, b) => a.parents.length - b.parents.length);
module.exports = [(engines) => Utility.FormatZones(ADSZ, ADSZ.Zones, ADSZ.ROOT.items, engines), ADSZ.ROOT];
