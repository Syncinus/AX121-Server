"use strict";
const WebSocket = require("ws");
const EventEmitter = require("events");
const http = require("http");
const url = require("url");
const util = require("./lib/util.js");
const protocol = require("./lib/fasttalk.js");
const definitionData = require("./ads/definitions.js");
const definitions = definitionData[0];
const zones = definitionData[1];
const zoneRoot = definitionData[2];
const config = require("./config.json");
const Utility = util.Utility;
const CONFIG = config.server;

const Room = (() => {
  const GenerateRoomRegion = ({ position = [0, 0], shape = 0, radius = 0, color = "#FFFFFF" }) => {
    return [
      position[0],
      position[1],
      shape,
      radius,
      color
    ];
  }
  const CalculateRoomRegions = () => {
    let regions = [];
    for (let i = 0, length = CONFIG.room.regions.length; i < length; i++) {
      regions = regions.concat(GenerateRoomRegion(CONFIG.room.regions[i]));
    }
    return regions;
  }
  const CalculateRoomDimensions = () => {
    return {
      width: CONFIG.room.width,
      height: CONFIG.room.height,
      shape: CONFIG.room.shape
    };
  }
  return {
    dimensions: CalculateRoomDimensions(),
    regions: CalculateRoomRegions(),
    entities: [],
    zones: zones[2],
    clients: [],
    lastCycle: null
  }
})();

const Property = (object, name, data, index, initial, multidata = false, reference = null, onChange = null) => {
  const config = [multidata, typeof initial === "object", reference != null, onChange != null];
  if (config[0]) {
    for (let i = 0, length = data.length; i < length; i++) {
      data[i][index[i]] = initial;
    }
  } else {
    data[index] = initial;
  }
  
  if (config[1]) {
    const handler = {
      get: (target, property) => (config[0]) ? data[0][index[0]][property] : data[index][property],
      set: (target, property, value, received) => {
        if (!Utility.Equals((config[0]) ? data[0][index[0]][property] : data[index][property], value)) {
          if (config[0]) {
            for (let i = 0, length = data.length; i < length; i++) {
              data[i][index[i]][property] = value;
            }
          } else {
            data[index][property] = value;
          }
        
          if (config[2]) {
            for (let i = 0, length = reference.length; i < length; i++) {
              for (let j = 0, length2 = reference[i][1].length; j < length2; j++) {
                reference[i][0][reference[i][1][j]] = value;
              }
            }
          }
        
          if (config[3]) {
            onChange(value);
          }
        
          target[property] = value;
          return true;
        } else {
          return false;
        }
      }
    }
    
    let proxy = new Proxy((config[0]) ? new Array(data[0][index[0]].length) : data[index], handler);
    Object.defineProperty(object, name, {
      enumerable: true,
      configurable: true,
      get: () => proxy,
      set: (value) => {
        if (config[0]) {
          for (let i = 0, length = data.length; i < length; i++) {
            data[i][index[i]] = value;
          }
        } else {
          data[index] = value;
        }
        if (value != null) {
          proxy = new Proxy((config[0]) ? new Array(value.length) : data[index], handler);
        } else {
          proxy = value;
        }
      }
    });
  } else {
    Object.defineProperty(object, name, {
      enumerable: true,
      configurable: true,
      get: () => (config[0]) ? data[0][index[0]] : data[index],
      set: (value) => {
        if (!Utility.Equals((config[0]) ? data[0][index[0]] : data[index])) {
          if (config[0]) {
            for (let i = 0, length = data.length; i < length; i++) {
              data[i][index[i]] = value;
            }
          } else {
            data[index] = value;
          }
          
          if (config[2]) {
            for (let i = 0, length = reference.length; i < length; i++) {
              for (let j = 0, length2 = reference[i][1].length; j < length2; j++) {
                reference[i][0][reference[i][1][j]] = value;
              }
            }
          }
          
          if (config[3]) {
            onChange(value);
          }
        } 
      }
    });
  }
}

// ENTITIES

let ENTITYID = 0;
const MakeEntity = (() => {
  return (definition, x, y, flags = null) => {
    const componentInterface = {}, zoneInterface = {}, renderBlocks = {}, entityInfo = Utility.Clone(definition[0], true), emitter = new EventEmitter();
    let triggerKeys = Object.keys(definition[1]), triggerLength = triggerKeys.length;
    // SET UP COMPONENT INTERFACE
    componentInterface.client = null;
    componentInterface.emitter = emitter;
    componentInterface.getComponent = (component) => entityInfo[component];
    componentInterface.checkComponent = (component) => entityInfo[component] != null;
    componentInterface.call = (method, args) => {
      for (let i = 0; i < triggerLength; i++) {
        if (triggerKeys[i] === method) {
          for (let j = 0, length = definition[1][triggerKeys[i]].length; j < length; j++) {
            definition[1][triggerKeys[i]][j].apply(definition[1][triggerKeys[i]][j].cache, [{componentInterface, zoneInterface}].concat(args));
          }
        }
      }
    }
		// SET UP EVENT EMITTER
		componentInterface.emitter.setMaxListeners(0); // Set infinite max listeners to prevent problems on entities with lots of triggers
    for (let i = 0; i < triggerLength; i++) {
      componentInterface.emitter.on(triggerKeys[i], (...args) => {
        const argumentArray = [{componentInterface, zoneInterface}].concat(args);
        for (let j = 0, length = definition[1][triggerKeys[i]].length; j < length; j++) {
          definition[1][triggerKeys[i]][j].apply(definition[1][triggerKeys[i]][j].cache, argumentArray);
        }
      });
    }
    // ADD METHODS TO ENTITYINFO
    entityInfo.entityId = ENTITYID++;
    entityInfo.setSyncedVariable = (syncedVariableId, value, array = false, index = null) => definition[4][1][syncedVariableId](value, false, array, index);
    entityInfo.componentPacket = (packet) => {
      for (let i = 0, length = definition[4][0].length; i < length; i++) {
        definition[4][0][i](packet);
      }
    }
    entityInfo.trigger = (trigger, ...args) => componentInterface.emitter.emit(trigger, ...args);
    entityInfo.define = (newDefinition, flags = null) => {
      const keys1 = Object.keys(entityInfo), keys2 = Object.keys(newDefinition[0]);
      for (let i = 0, j = 0, length = keys1.length, length2 = keys2.length; i < length && j < length2;) {
        if (newDefinition[0][keys1[i]] == null && !((keys1[i] === "componentInterface" || keys1[i] === "trigger" || keys1[i] === "define" || keys1[i] === "entityId" || keys1[i] === "setSyncedVariable" || keys1[i] === "componentPacket") || entityInfo[keys1[i]].configuration.attached)) {
          delete entityInfo[keys1[i]];
        }
        if (newDefinition[0][keys1[i]] != null) {
          if (!newDefinition[0][keys1[i]].configuration.resettable) {
            if (newDefinition[0][keys1[i]].configuration.id !== entityInfo[keys1[i]].configuration.id) {
              entityInfo[keys1[i]] = Utility.Overlap(newDefinition[0][keys1[i]], entityInfo[keys1[i]]); 
            }
          } else {
            entityInfo[keys1[i]] = Utility.Clone(newDefinition[0][keys1[i]]);
          }
        }
        if (entityInfo[keys2[j]] == null) {
          entityInfo[keys2[j]] = Utility.Clone(newDefinition[0][keys2[j]]);
        }
        if (i < length) {
          i++;
        }
        if (j < length2) {
          j++;
        }
      }
      definition[3] = newDefinition[3];
      definition[0] = newDefinition[0];
      triggerKeys = Object.keys(newDefinition[1]);
      triggerLength = triggerKeys.length;
      componentInterface.emitter.removeAllListeners();
      for (let i = 0; i < triggerLength; i++) {
        componentInterface.emitter.on(triggerKeys[i], (...args) => {
          const argumentArray = [componentInterface].concat(...args);
          for (let j = 0, length = definition[1][triggerKeys[i]].length; j < length; j++) {
            definition[1][triggerKeys[i]][j].apply(definition[1][triggerKeys[i]][j].cache, argumentArray);
          }
        });
      }
      definition[1] = newDefinition[1];
      definition[2] = newDefinition[2];
      componentInterface.emitter.emit("attachment");
    }
    // SYNCED VARIABLE STUFF
    definition[4][2] = (update, array, syncedVariableId, index, value, name, clientSync) => {
      if (update) {
        for (let i = 0, length = Room.clients.length; i < length; i++) {
          if (!array) {
            Room.clients[i].injection.updateSync(entityInfo.entityId, syncedVariableId, value);
          } else {
            Room.clients[i].injection.updateArraySync(entityInfo.entityId, syncedVariableId, index, value);
          }
        }
      } else {
        let clientCallback = false;
        if (typeof clientSync === "function") {
          clientCallback = clientSync.toString();
        }
        for (let i = 0, length = Room.clients.length; i < length; i++) {
          if (!array) {
            Room.clients[i].injection.addSync(entityInfo.entityId, syncedVariableId, name, value, clientCallback);
          } else {
            Room.clients[i].injection.addArraySync(entityInfo.entityId, syncedVariableId, name, value, clientCallback);
          }
        }
      }
    }
    if (definition[4][3]) {
      for (let i = 0, length = definition[4][3].length; i < length; i += 2) {
        for (let j = 0, length2 = Room.clients.length; j < length2; j++) {
          Room.clients[j].injection.add([entityInfo.entityId, definition[4][3][i], definition[4][3][i + 1]]);
        }
      }
    }
    for (let i = 0, length = definition[4][1].length; i < length; i++) {
      definition[4][1][i](null, true);
    }
    // SET UP RENDERBLOCKS
    renderBlocks.info = [entityInfo.entityId, 0, 0, 0, 0];
    renderBlocks.views = [];
    renderBlocks.position = (motion) => {
      renderBlocks.info[2] = motion[0];
      renderBlocks.info[3] = motion[1];
    }
    renderBlocks.rotate = (angle) => {
      renderBlocks.info[1] = angle;
    }
    renderBlocks.calculateAABB = () => {
      const aabb = [[-Infinity, -Infinity], [Infinity, Infinity]];
      for (let i = 5; i < 5 + renderBlocks.info[4]; i++) {
        if (Array.isArray(renderBlocks.info[i])) {
          const scale = [renderBlocks.info[i][4], renderBlocks.info[i][5]], 
                cos = Math.cos(renderBlocks.info[1] + renderBlocks.info[i][6]),
                sin = Math.sin(renderBlocks.info[1] + renderBlocks.info[i][6]),
                position = [renderBlocks.info[2] + renderBlocks.info[i][2], renderBlocks.info[3] + renderBlocks.info[i][3]];
          for (let j = 7; j < 7 + renderBlocks.info[i][0]; j += 2) {
            const point = [
              position[0] + (scale[0]) * (renderBlocks.info[i][j] * cos - renderBlocks.info[i][j + 1] * sin),
              position[1] + (scale[1]) * (renderBlocks.info[i][j + 1] * cos - renderBlocks.info[i][j] * sin)
            ];
            if (point[0] > aabb[0][0]) {
              aabb[0][0] = point[0];
            }
            if (point[0] < aabb[1][0]) {
              aabb[1][0] = point[0];
            }
            if (point[1] > aabb[0][1]) {
              aabb[0][1] = point[0];
            }
            if (point[1] < aabb[1][1]) {
              aabb[1][1] = point[0];
            }
          }
        }
      }
      return aabb;
    }
    renderBlocks.addData = (data) => {
      renderBlocks.info.push(data);
    }
    renderBlocks.removeData = (data) => {
      util.remove(renderBlocks.info, renderBlocks.info.indexOf(data));
    }
    renderBlocks.exportData = () => {
      renderBlocks.info[4] = renderBlocks.info.length - 5;
      const AABB = renderBlocks.calculateAABB();
      for (let i = 0, length = Room.clients.length; i < length; i++) {
        if (Room.clients[i].view.check(AABB)) {
          if (!Room.clients[i].view.contains(renderBlocks.info)) {
            Room.clients[i].view.add(renderBlocks.info);
            renderBlocks.views.push(renderBlocks.info);
          }
        } else if (renderBlocks.views.includes(Room.clients[i])) {
          Room.clients[i].view.remove(renderBlocks.info);
          util.remove(renderBlocks.views, renderBlocks.views.indexOf(Room.clients[i]));
        }
      }
    }
    // LINK EVERYTHING TOGETHER
    componentInterface.entityInfo = entityInfo;
    componentInterface.renderBlocks = renderBlocks;
    componentInterface.zoneInterface = zoneInterface;
    entityInfo.componentInterface = componentInterface;
    entityInfo.renderBlocks = renderBlocks;
    entityInfo.zoneInterface = zoneInterface;
    zoneInterface.entityInfo = entityInfo;
    zoneInterface.componentInterface = componentInterface;
    // SET UP TRANSFORM
    entityInfo.transform.position = [x || 0, y || 0];
    // EMIT THE ATTACHMENT EVENT
    componentInterface.emitter.emit("attachment", definition);
    // CREATE ENTITYINFO DESTROY
    entityInfo.DESTROY = () => {
      // Remove it from the entities array
      util.remove(Room.entities, Room.entities.indexOf(entityInfo));
      // Remove it from zones
      zoneInterface.delete();
      // Emit the destruction event to undo components
      componentInterface.emitter.emit("destruction");
      // Remove all the client events
      for (let i = 0, length = definition[4][3].length; i < length; i += 2) {
        for (let j = 0, length2 = Room.clients.length; j < length2; j++) {
          Room.clients[j].injection.remove([entityInfo.entityId, definition[4][3][i], definition[4][3][i + 1]]);
        }
      }
      // Delete circular references
      delete componentInterface.entityInfo;
      delete componentInterface.renderBlocks;
      delete componentInterface.zoneInterface;
      delete entityInfo.componentInterface;
      delete entityInfo.renderBlocks;
      delete entityInfo.zoneInterface;
      delete zoneInterface.entityInfo;
      delete zoneInterface.componentInterface;
    }
    // SET UP ZONE INTERFACE
    zoneInterface.zones = [];
    for (let i = 0, length = definition[5].length; i < length; i++) {
      const accessor = definition[5][i].split(".");
      let TargetSettingObject = Room.zones;
      for (let j = 0, length2 = accessor.length; j < length2; j++) {
        TargetSettingObject = TargetSettingObject[accessor[j]];
      }
      TargetSettingObject.push(entityInfo);
      zoneInterface.zones.push(TargetSettingObject);
    }
    zoneInterface.delete = () => {
      for (let i = 0, length = zoneInterface.zones.length; i < length; i++) {
        util.remove(zoneInterface.zones[i], zoneInterface.zones[i].indexOf(entityInfo));
      }
      zoneInterface.zones.splice(0, zoneInterface.zones.length);
    }
    zoneInterface.emit = (event, zoneName = null) => {
      for (let i = 0, length = zoneInterface.zones.length; i < length; i++) {
        if (zoneInterface.zones[i].name === zoneName || zoneName == null) {
          zoneInterface.zones[i].emit(event);
        }
      }
    }
    zoneInterface.call = (func, zoneName = null) => {
      for (let i = 0, length = zoneInterface.zones.length; i < length; i++) {
        if (zoneInterface.zones[i].name === zoneName || zoneName == null) {
          for (let j = 0, length2 = zoneInterface.zones[i].length; j < length2; j++) {
            func(zoneInterface.zones[i][j]);
          }
        }
      }
    }
    return entityInfo;
  }
})();

const EntityGetter = (id) => {
  for (let i = 0, length = Room.entities.length; i < length; i++) {
    if (Room.entities[i].entityId == id) {
      return Room.entities[i];
    }
  }
  return null;
}
const Entity = (definition, x, y, flags = null) => {
  const entity = MakeEntity(definition, x, y, flags);
  Room.entities.push(entity);
  return entity;
}

const Loops = {};
Loops.Primary = () => {
  if (Room.entities.length && Room.clients.length) {
    zones[0](Room);
    for (let i = 0, length = Room.entities.length; i < length; i++) {
      Room.entities[i].trigger("update");
    }
    for (let i = 0, length = Room.clients.length; i < length; i++) {
      Room.clients[i].cycle();
    }
  }
  setTimeout(Loops.Primary, CONFIG.roomSpeed);
};
Loops.Engines = [];
for (let i = 0, length = zones[1].length; i < length; i++) {
  Loops.Engines.push(setInterval(() => zones[1][i][0](Room.zones, zones[1][i][3]), zones[1][i][1]));
}
Loops.Primary();

// WEB SERVER

const Socket = (() => {
  const Initilize = (socket) => {
    socket.talk(["I", util.serverStartTime, Room.dimensions.shape, Room.dimensions.width, Room.dimensions.height].concat(Room.regions));
    socket.initilized = true;
  }
  
  const Message = (socket, message) => {
    const m = protocol.decode(message);
    if (m === -1) {
      throw new Error("Malformed Packet");
    }
    
    const messageType = m.shift();
    switch (messageType) {
      // Synced variables
      case "s": {
        if (m.length < 1) {
          throw new Error("Ill-sized variable sync packet");
        } else {
          const syncedLength = m[0], syncedData = m.slice(1);
          for (let i = 0; i < syncedLength; i += 5) {
            const entity = EntityGetter(syncedData[i]);
            if (entity) {
              entity.setSyncedVariable(syncedData[i + 1], syncedData[i + 2], syncedData[i + 3], syncedData[i + 4]);
            }
          }
        }
      } break;
      // Component sync packet
      case "C": {
        if (m.length < 1) {
          throw new Error("Ill-sized component sync packet");
        } else {
          for (let i = 0, length = m.length; i < length;) {
            const entity = EntityGetter(m[i]), dataLength = m[i + 1], syncInformation = [];
            for (let j = 0; j < dataLength; j++) {
              syncInformation.push(m[i + 2 + j]);
            }
            entity.componentPacket(syncInformation);
          }
        }
      } break;
      // Screen size
      case "Z": {
        if (m.length !== 2) {
          throw new Error("Ill-sized screen size packet");
        } else {
          socket.view.size[0] = m[0];
          socket.view.size[1] = m[1];
          Initilize(socket);
        }
      } break;
      // Clock sync
      case "S": {
        if (m.length !== 1) {
          throw new Error("Ill-sized clock sync packet");
        } else {
          const tick = m[0];
          if (typeof tick !== "number") {
            throw new Error("Wierd clock sync packet");
          } else {
            socket.talk(["S", tick, util.time()]);
          }
        }
      } break;
      default: {
        throw new Error("Unknown message type " + messageType);
      } break;
    }
  }
  
  const Uplink = (socket) => {
    if (socket.initilized && socket.body.renderer != null) {
      socket.view.box[0][0] = socket.body.renderer.camera[0] - ((socket.body.renderer.fov * (socket.view.size[0] / socket.body.renderer.fov)) / 2);
      socket.view.box[0][1] = socket.body.renderer.camera[1] - ((socket.body.renderer.fov * (socket.view.size[1] / socket.body.renderer.fov)) / 2);
      socket.view.box[1][0] = socket.body.renderer.camera[0] + ((socket.body.renderer.fov * (socket.view.size[0] / socket.body.renderer.fov)) / 2);
      socket.view.box[1][1] = socket.body.renderer.camera[1] + ((socket.body.renderer.fov * (socket.view.size[1] / socket.body.renderer.fov)) / 2);
      const data = socket.view.info.flat(Infinity), injection = socket.injection.injected.flat(), removed = socket.injection.removal.flat();
      socket.talk(["u", util.time(), socket.body.renderer.camera[0], socket.body.renderer.camera[1], socket.body.renderer.fov].concat([injection.length].concat(injection)).concat([removed.length].concat(removed)).concat(data));
      socket.injection.injected.length = 0;
      socket.injection.removal.length = 0;
      if (socket.injection.syncVariables.length > 0) {
        const synced = socket.injection.syncVariables.flat();
        socket.talk(["s", synced.length].concat(synced));
        socket.injection.syncVariables.length = 0;
      }
    }
  }
  
  return (websocket) => {
    const socket = {};
    socket.websocket = websocket;
    socket.talk = (message) => {
      if (socket.websocket.readyState === socket.websocket.OPEN) {
        socket.websocket.send(protocol.encode(message), { binary: true });
      }
    }
    socket.initilized = false;
    socket.injection = {
      injected: [],
      removal: [],
      syncVariables: [],
      addSync: (entityId, variableId, name, value, clientCallback) => socket.injection.syncVariables.push([false, entityId, variableId, false, name, value, clientCallback]),
      addArraySync: (entityId, variableId, name, value, clientCallback) => socket.injection.syncVariables.push([false, entityId, variableId, true, name, value.length].concat(value.decode).concat([clientCallback])),
      updateSync: (entityId, variableId, value) => socket.injection.syncVariables.push([true, entityId, variableId, false, value]),
      updateArraySync: (entityId, variableId, index, value) => socket.injection.syncVariables.push([true, entityId, variableId, true, index, value]),
      add: (func) => socket.injection.injected.push(func),
      remove: (func) => socket.injection.removal.push(func)
    };
    socket.view = {
      info: [],
      size: [0, 0],
      box: [[Infinity, Infinity], [-Infinity, -Infinity]],
      check: (aabb) => Utility.Boxes.BoxOverlap(socket.view.box, aabb),
      contains: (data) => socket.view.info.includes(data),
      add: (data) => socket.view.info.push(data),
      remove: (data) => util.remove(socket.view.info, socket.view.info.indexOf(data))
    };
    
    socket.cycle = () => Uplink(socket);
    
    Room.clients.push(socket);
    socket.body = Entity(definitions.basic, 0, 0);
    socket.componentInterace = {
      
    };
    socket.body.componentInterface.client = socket.componentInterface;
    socket.websocket.on("message", (message) => Message(socket, message));
    socket.websocket.on("close", () => socket.body.DESTROY());
  }
})();

const Server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  const ip = (req.headers["x-forwarded-for"] || "").split(",").map((r) => r.trim()).filter((r) => r.length);
  if (req.connection.remoteAddress) {
    ip.push(req.connection.remoteAddress.replace(/^.*:/, ""));
  }
  const path = pathname.replace(/\/+$/, "");
  util.log("Responding to HTTP request " + pathname + " from " + ip);
  switch (path) {
    case "": {
      res.writeHead(200);
      res.end("<!DOCTYPE HTML>AX-121 Server");
    } break;
    default: {
      res.writeHead(404);
      res.end();
    } break;
  }
});

Server.listen(8080, () => {
  const splitVersion = CONFIG.version.split(":");
  const systemName = splitVersion[0].toUpperCase();
  const versionType = (splitVersion[1][0] === "r") ? "Release" : (splitVersion[1][0] === "b") ? "Beta" : (splitVersion[1][0] === "a") ? "Alpha" : (splitVersion[1][0] === "v") ? "Velocity" : "Unknown version";
  const versionNumber = splitVersion[1].substr(1);
  util.log(systemName + " - " + versionType + (versionNumber.length > 0 ? " " + versionNumber : "") + " server running on port " + Server.address().port);
});

const Sockets = new WebSocket.Server({ server: Server }).on("connection", Socket);