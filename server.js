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
require("./commands.js");

if (CONFIG.room.width % CONFIG.chunkSize !== 0) {
  throw new Error("Room width needs to be a multiple of chunk size");
}

if (CONFIG.room.height % CONFIG.chunkSize !== 0) {
  throw new Error("Room height needs to be a multiple of chunk size");
}

const ChunkCount = (CONFIG.room.width / CONFIG.chunkSize) * (CONFIG.room.height / CONFIG.chunkSize);

const ActiveChunkArray = new Uint32Array(Math.ceil(ChunkCount / 32));
const GenerateChunkAccessor = (chunk) => [~~(chunk / 32), 1 << (chunk % 32)];
const ActiveChunkAccess = {
  Refresh: () => {
    for (let i = 0, length = ActiveChunkArray.length; i < length; i++) {
      ActiveChunkArray[i] = 0b00000000000000000000000000000;
    }
  },
  Set: (chunk, active) => {
    const accessor = GenerateChunkAccessor(chunk);
    if (active) {
      ActiveChunkArray[accessor[0]] |= accessor[1];
    } else {
      ActiveChunkArray[accessor[0]] &= ~accessor[1];
    }
  },
  Get: (chunk) => {
    const accessor = GenerateChunkAccessor(chunk);
    return (ActiveChunkArray[accessor[0]] & accessor[1]) !== 0;
  }
}

const ChunkColumnArray = new Int16Array(CONFIG.room.width / CONFIG.chunkSize), ChunkRowArray = new Int16Array(CONFIG.room.height / CONFIG.chunkSize);
let column = 0, row = 0;
for (let x = 0; x < CONFIG.room.width; x += CONFIG.chunkSize) {
  ChunkColumnArray[column] = x;
  column++;
}
for (let y = 0; y < CONFIG.room.height; y += CONFIG.chunkSize) {
  ChunkRowArray[row] = y;
  row++;
}
global.Callbacks = [
  [],
  {}
];

const PointColumnRow = (point) => {
  const ColumnRow = new Uint8Array(2);
  for (let x = 0, length = ChunkColumnArray.length; x < length; x++) {
    if (point[0] >= ChunkColumnArray[x] && point[0] < (ChunkColumnArray[x + 1] || Infinity)) {
      ColumnRow[0] = x;
      break;
    }
  }
  for (let y = 0, length = ChunkRowArray.length; y < length; y++) {
    if (point[1] >= ChunkRowArray[y] && point[1] < (ChunkRowArray[y + 1] || Infinity)) {
      ColumnRow[1] = y;
      break;
    }
  }
  return ColumnRow;
}
const PointChunk = (point) => {
  const ColumnRow = PointColumnRow(point);
  return (ColumnRow[1] * ChunkRowArray.length) + ColumnRow[0];
}

const LoadChunks = (aa, bb) => {
  const extent1 = PointColumnRow(aa), extent2 = PointColumnRow(bb);
  for (let x = extent1[0]; x <= extent2[0]; x++) {
    for (let y = extent1[1]; y <= extent2[1]; y++) {
      ActiveChunkAccess.Set((y * ChunkRowArray.length) + x, true);
    }
  }
}

const ChunkLoaders = [];
const ChunkLoader = (() => {
  const ChunkLoaderPositionHandler = (corner1, corner2) => {
    return {
      get: (target, property, receiver) => {
        return Reflect.get(target, property, receiver);
      },
      set: (target, property, value) => {
        if (property === "0" || property === "1") {
          const difference = value - target[property];
          corner1[property] += difference;
          corner2[property] += difference;
        }
        return Reflect.set(target, property, value);
      }
    };
  }
  const ChunkLoaderScaleHandler = (corner1, corner2) => {
    return {
      get: (target, property, receiver) => {
        return Reflect.get(target, property, receiver);
      },
      set: (target, property, value) => {
        if (property === "0" || property === "1") {
          const difference = value - target[property], change = difference / 2;
          corner1[property] -= change; corner2[property] += change;
        }
        return Reflect.set(target, property, value);
      }
    };
  }
  return (position, scale) => {
    const corner1 = new Int16Array(2), corner2 = new Int16Array(2), positionValues = new Int16Array(position), scaleValues = new Int16Array(scale);
    const positionProxy = new Proxy(positionValues, ChunkLoaderPositionHandler(corner1, corner2)), scaleProxy = new Proxy(scaleValues, ChunkLoaderScaleHandler(corner1, corner2));
    corner1[0] = position[0] + (scale[0] / 2);
    corner1[1] = position[1] + (scale[1] / 2);
    corner2[0] = position[0] - (scale[0] / 2);
    corner2[1] = position[1] - (scale[1] / 2);
    const loader = {
      get position() {
        return positionProxy;
      },
      set position(value) {
        if (value == null) {
          throw new Error("Cannot set ChunkLoader's position to " + value.toString());
        } else {
          positionProxy[0] = value[0];
          positionProxy[1] = value[1];
        }
      },
      get scale() {
        return scaleProxy;
      },
      set scale(value) {
        if (value == null) {
          throw new Error("Cannot set ChunkLoader's scale to " + value.toString());
        } else {
          scaleProxy[0] = value[0];
          scaleProxy[1] = value[1];
        }
      },
      get box() {
        return [corner1, corner2];
      },
      set box(value) {
        if (value == null) {
          throw new Error("Cannot set ChunkLoader's box to " + value.toString());
        } else {
          corner1[0] = value[0][0];
          corner1[1] = value[0][1];
          corner2[0] = value[1][0];
          corner2[1] = value[1][1];
        }
      },
      Load: () => LoadChunks(corner1, corner2)
    };
    ChunkLoaders.push(loader);
    return loader;
  }
})();

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

for (let i = 0; i < ChunkCount; i++) {
  Room.entities.push(new Set());
}

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
const EntityGet = {};
const Entity = (definition, x, y, flags = {}) => {
  const entityId = ENTITYID++;
  let renderBlocksId = 0;
  // PASS INTERFACE FUNCTIONS TO THE DEFINITION IN ORDER TO GENERATE THEM
  const interfaceGenerator = (instance, triggers) => {
    const interfaces = {
      componentInterface: { 
        getComponent: (name) => instance[name],
        checkComponent: (name) => instance[name] != null,
        // ADDCOMPONENT AND REMOVECOMPONENT
        call: (method, args) => {
          for (let i = 0, length = triggers[method].length; i < length; i++) {
            triggers[method][i].execute[entityId](args);
          }``
        }
      },
      renderBlocks: {
        info: [entityId, renderBlocksId++, 0, 0, 0, 0],
        views: [],
        rotate: (angle) => {
          interfaces.renderBlocks.info[2] = angle;
        },
        position: (location) => {
          interfaces.renderBlocks.info[3] = location[0];
          interfaces.renderBlocks.info[4] = location[1];
        },
        calculateAABB: () => {
          const aabb = [[-Infinity, -Infinity], [Infinity, Infinity]];
          for (let i = 6; i < 6 + interfaces.renderBlocks.info[5]; i++) {
            if (Array.isArray(interfaces.renderBlocks.info[i])) {
              const scale = [interfaces.renderBlocks.info[i][4], interfaces.renderBlocks.info[i][5]], 
                    cos = Math.cos(interfaces.renderBlocks.info[2] + interfaces.renderBlocks.info[i][6]),
                    sin = Math.sin(interfaces.renderBlocks.info[2] + interfaces.renderBlocks.info[i][6]),
                    position = [interfaces.renderBlocks.info[3] + interfaces.renderBlocks.info[i][2], interfaces.renderBlocks.info[4] + interfaces.renderBlocks.info[i][3]];
              for (let j = 7; j < 7 + interfaces.renderBlocks.info[i][0]; j += 2) {
                const point = [
                  position[0] + (scale[0]) * (interfaces.renderBlocks.info[i][j] * cos - interfaces.renderBlocks.info[i][j + 1] * sin),
                  position[1] + (scale[1]) * (interfaces.renderBlocks.info[i][j + 1] * cos - interfaces.renderBlocks.info[i][j] * sin)
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
        },
        addData: (data) => {
          interfaces.renderBlocks.info.push(data);
        },
        removeData: (data) => {
          util.remove(interfaces.renderBlocks.info, interfaces.renderBlocks.info.indexOf(data));
        },
        exportData: () => {
          interfaces.renderBlocks.info[5] = interfaces.renderBlocks.info.length - 6;
          const AABB = interfaces.renderBlocks.calculateAABB();
          for (let i = 0, length = Room.clients.length; i < length; i++) {
            if (Room.clients[i].view.check(AABB)) {
              if (!Room.clients[i].view.contains(interfaces.renderBlocks.info)) {
                Room.clients[i].view.add(interfaces.renderBlocks.info);
                interfaces.renderBlocks.views.push(interfaces.renderBlocks.info);
              }
            } else if (interfaces.renderBlocks.views.includes(Room.clients[i])) {
              Room.clients[i].view.remove(interfaces.renderBlocks.info);
              util.remove(interfaces.renderBlocks.views, interfaces.renderBlocks.views.indexOf(Room.clients[i]));
            }
          }
        }
      }
    };
    instance.trigger = (method, ...args) => interfaces.componentInterface.call(method, args);
    return interfaces;
  }
  const instance = definition[0](flags.client, entityId, Room, interfaceGenerator);
  instance.trigger("attachment");

  instance.chunk = PointChunk(instance.transform.position);
  instance.reloadChunk = () => {
    if (PointChunk(instance.transform.position) !== instance.chunk) {
      Room.entities[instance.chunk].delete(instance);
      instance.chunk = PointChunk(instance.transform.position);
      Room.entities[instance.chunk].add(instance);
    }
  }

  instance.DESTROY = () => {
    // delete from zones

    instance.trigger("destruction");
    
    delete EntityGet[entityId];

    Room.entities[instance.chunk].delete(instance);
  }

  Room.entities[instance.chunk].add(instance);
  EntityGet[entityId] = instance;
  return instance;
  //instance.trigger("attachment");
  /*

    // SET UP COMPONENT INTERFACE
    componentInterface.client = null;
    if (flags.client != null) {
      componentInterface.client = flags.client;
    }
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
    /*
    definition[4][2] = (update, array, syncedVariableId, index, value, name, clientSync) => {
      if (update) {
        if (flags.client != null) {
          if (!array) {
            flags.client.injection.updateSync(entityInfo.entityId, syncedVariableId, value);
          } else {
            flags.client.injection.updateArraySync(entityInfo.entityId, syncedVariableId, index, value);
          }
        }
      } else {
        let clientCallback = false;
        if (typeof clientSync === "function") {
          clientCallback = clientSync.toString();
        }
        if (flags.client != null) {
          if (!array) {
            flags.client.injection.addSync(entityInfo.entityId, syncedVariableId, name, value, clientCallback);
          } else {
            flags.client.injection.addArraySync(entityInfo.entityId, syncedVariableId, name, value, clientCallback);
          }
        }
      }
    }
    if (definition[4][3] && flags.client != null) {
      for (let i = 0, length = definition[4][3].length; i < length; i += 2) {
        flags.client.injection.add([entityInfo.entityId, definition[4][3][i], definition[4][3][i + 1]]);
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
      Room.entities[entityInfo.chunk].delete(entityInfo);
      // Remove it from zones
      zoneInterface.delete();
      // Emit the destruction event to undo components
      componentInterface.emitter.emit("destruction");
      // Remove all the client events
      if (flags.client != null) {
        for (let i = 0, length = definition[4][3].length; i < length; i += 2) {
          flags.client.injection.remove([entityInfo.entityId, definition[4][3][i], definition[4][3][i + 1]]);
        }
      }
      // Remove it from the entity getter
      delete EntityGet[entityInfo.entityId];
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
    // CHUNK LOADING STUFF
    entityInfo.chunk = PointChunk(entityInfo.transform.position);
    entityInfo.reloadChunk = () => {
      if (PointChunk(entityInfo.transform.position) !== entityInfo.chunk) {
        Room.entities[entityInfo.chunk].delete(entityInfo);
        entityInfo.chunk = PointChunk(entityInfo.transform.position);
        Room.entities[entityInfo.chunk].add(entityInfo);
      }
    }

    Room.entities[entityInfo.chunk].add(entityInfo);
    EntityGet[entityInfo.entityId] = entityInfo;
    return entityInfo;
    */
}

global.Callbacks[0].push([]);
global.Callbacks[1].WaitForPrimaryLoop = () => {
  return new Promise((resolve, reject) => {
    global.Callbacks[0][0].push(resolve);
  });
}
const EntityGetter = (id) => EntityGet[id];
const Loops = {};
Loops.Primary = () => {
  ActiveChunkAccess.Refresh();
  for (let i = 0, length = ChunkLoaders.length; i < length; i++) {
    ChunkLoaders[i].Load();
  }
  if (Room.clients.length) {
    zones[0](Room);
    for (let i = 0; i < ChunkCount; i++) {
      if (ActiveChunkAccess.Get(i)) {
        for (let iterator = Room.entities[i].values(), entity = null; entity = iterator.next().value;) {
          entity.trigger("update");
          entity.reloadChunk();
        }
      }
    }
    for (let i = 0, length = Room.clients.length; i < length; i++) {
      Room.clients[i].cycle();
    }
  }
  if (global.Callbacks[0][0].length !== 0) {
    for (let i = 0, length = Global.callbacks[0][0].length; i < length; i++) {
      Global.callbacks[0][0][i](true);
    }
    Global.callbacks[0][0].length = 0;
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
          for (let i = 0, length = m.length; i < length; ) {
            if (m[i] == false) {
              // update normal syncedvariable
              socket.body.syncedVariableModule[0][m[i + 1]](m[i + 2]);
              i += 3;
            } else {
              socket.body.syncedVariableModule[0][m[i + 1]](m[i + 2], m[i + 3]);
              i += 4;
              // update array syncedvariable
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
          socket.view.chunkLoader.scale = socket.view.size;
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
      //socket.view.box[0][0] = socket.body.renderer.camera[0] - ((socket.body.renderer.fov * (socket.view.size[0] / socket.body.renderer.fov)) / 2);
      //socket.view.box[0][1] = socket.body.renderer.camera[1] - ((socket.body.renderer.fov * (socket.view.size[1] / socket.body.renderer.fov)) / 2);
      //socket.view.box[1][0] = socket.body.renderer.camera[0] + ((socket.body.renderer.fov * (socket.view.size[0] / socket.body.renderer.fov)) / 2);
      //socket.view.box[1][1] = socket.body.renderer.camera[1] + ((socket.body.renderer.fov * (socket.view.size[1] / socket.body.renderer.fov)) / 2);
      // POSSIBLE TODO: MAKE 1 THE STANDARD SIZE
      socket.view.box[0][0] = socket.body.renderer.camera[0] - ((socket.body.renderer.fov / 100) * socket.view.size[0]) / 2;
      socket.view.box[0][1] = socket.body.renderer.camera[1] - ((socket.body.renderer.fov / 100) * socket.view.size[1]) / 2;
      socket.view.box[1][0] = socket.body.renderer.camera[0] + ((socket.body.renderer.fov / 100) * socket.view.size[0]) / 2;
      socket.view.box[1][1] = socket.body.renderer.camera[1] + ((socket.body.renderer.fov / 100) * socket.view.size[1]) / 2;
      const data = socket.view.info.flat(Infinity);// injection = socket.injection.injected.flat(), removed = socket.injection.removal.flat();
      socket.talk(["u", util.time(), socket.body.renderer.camera[0], socket.body.renderer.camera[1], socket.body.renderer.fov, socket.body.entityId].concat(data));
      if (socket.injection.info.length > 0) {
        socket.talk(["s"].concat(socket.injection.info));
        socket.injection.info.length = 0;
        socket.injection.indices = {};
      }
      //socket.injection.injected.length = 0;
      //socket.injection.removal.length = 0;
      /*if (socket.injection.syncVariables.length > 0) {
        const synced = socket.injection.syncVariables.flat();
        socket.talk(["s", synced.length].concat(synced));
        socket.injection.syncVariables.length = 0;
      }*/
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
      info: [],
      indices: {},
      /*injected: [],
      removal: [],
      syncVariables: [],
      addSync: (entityId, variableId, name, value, clientCallback) => socket.injection.syncVariables.push([false, entityId, variableId, false, name, value, clientCallback]),
      addArraySync: (entityId, variableId, name, value, clientCallback) => socket.injection.syncVariables.push([false, entityId, variableId, true, name, value.length].concat(value.decode).concat([clientCallback])),
      updateSync: (entityId, variableId, value) => socket.injection.syncVariables.push([true, entityId, variableId, false, value]),
      updateArraySync: (entityId, variableId, index, value) => socket.injection.syncVariables.push([true, entityId, variableId, true, index, value]),
      add: (func) => socket.injection.injected.push(func),
      remove: (func) => socket.injection.removal.push(func)*/
      addSync: (variableId, name, value) => socket.injection.info.push(0b0001, variableId, name, value),
      addArraySync: (variableId, name, value) => {
        socket.injection.info.push(0b0011, variableId, name, value.length);
        for (let i = 0, length = value.length; i < length; i++) {
          socket.injection.info.push(value[i]);
        }
      },
      updateSync: (variableId, value) => {
        if (socket.injection.indices[variableId] == null) {
          socket.injection.info.push(0b0101, variableId, value);
          socket.injection.indices[variableId] = socket.injection.info.length - 1;
        } else {
          socket.injection.indices[variableId] = value;
        }
      },
      updateArraySync: (variableId, value, index) => {
        //socket.injection.info.push(0b0111, variableId, value, index);
        if (socket.injection.indices[variableId] == null) {
          socket.injection.indices[variableId] = {};
          socket.injection.info.push(0b0111, variableId, value, index);
          socket.injection.indices[variableId][index] = socket.injection.info.length - 2;
        } else {
          if (socket.injection.indices[variableId][index] != null) {
            socket.injection.info[socket.injection.indices[variableId][index]] = value;
          } else {
            socket.injection.info.push(0b0111, variableId, value, index);
            socket.injection.info.indices[variableId][index] = socket.injection.info.length - 2;
          }
        }
      },
      removeSync: (variableId) => socket.injection.info.push(0b1001, variableId),

      addClient: (name, id, information) => socket.injection.info.push(0b0000, name, id, information),
      removeClient: (name, id) => socket.injection.info.push(0b1000, name, id)
    };
    socket.view = {
      info: [],
      size: [0, 0],
      box: [[Infinity, Infinity], [-Infinity, -Infinity]],
      chunkLoader: ChunkLoader(new Int16Array(2), new Int16Array(2)),
      check: (aabb) => Utility.Boxes.BoxOverlap(socket.view.box, aabb),
      contains: (data) => socket.view.info.includes(data),
      add: (data) => socket.view.info.push(data),
      remove: (data) => util.remove(socket.view.info, socket.view.info.indexOf(data))
    };
    
    socket.cycle = () => {
      socket.view.chunkLoader.position = socket.body.renderer.camera;
      Uplink(socket);
    }
    
    Room.clients.push(socket);
    socket.body = Entity(definitions.basic, 0, 0, {
      client: socket
    });
    socket.view.chunkLoader.position = socket.body.renderer.camera;
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

const Sockets = new WebSocket.Server({ server: Server }).on("connection", (websocket) => Socket(websocket));