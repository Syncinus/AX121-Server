"use strict";
const util = require("../lib/util.js");
const Utility = util.Utility;
const Identifiers = {
  DynamicVariable: Symbol("DynamicVariable"),
  TypedVariable: Symbol("TypedVariable"),
  TypedArrayVariable: Symbol("TypedArrayVariable"),
  SyncedVariable: Symbol("SyncedVariable"),
  SyncedArrayVariable: Symbol("SyncedArrayVariable"),
  FunctionTemplate: Symbol("FunctionTemplate"),
  SyncedMethod: Symbol("SyncedMethod")
};

exports.InjectClient = {

};

exports.TypeBytes = (value) => {
  switch (value) {
    case "biguint64": return 8;
    case "bigint64": return 8;
    case "float64": return 8;
    case "float32": return 4;
    case "uint32": return 4;
    case "int32": return 4;
    case "uint16": return 2;
    case "int16": return 2;
    case "uint8": return 1;
    case "int8": return 1;
  }
}

exports.Variables = {
  VariableCheck: (value) => {
    if (Array.isArray(value) && (value[0] === Identifiers.DynamicVariable || value[0] === Identifiers.TypedVariable || value[0] === Identifiers.TypedArrayVariable || value[0] === Identifiers.SyncedVariable || value[0] === Identifiers.SyncedArrayVariable || value[0] === Identifiers.FunctionTemplate)) {
      return true;
    } else {
      return false;
    }
  },
  VariableOverlap: (section, name, variable) => {
    if (section != null) {
      if (section[name] != null) {
        variable[1] = Utility.Overlap(variable[1], section[name]);
      }
    }
    return variable;
  },
  DynamicVariable: (value) => [Identifiers.DynamicVariable, value],
  TypedVariable: (type, value) => [Identifiers.TypedVariable, value, type],
  TypedArrayVariable: (type, length) => [Identifiers.TypedArrayVariable, length, type],
  SyncedVariable: (type, value, serverSync, clientSync) => [Identifiers.SyncedVariable, value, type, serverSync, clientSync],
  SyncedArrayVariable: (type, length, serverSync, clientSync) => [Identifiers.SyncedArrayVariable, length, type, serverSync, clientSync],
  FunctionTemplate: (template) => [Identifiers.FunctionTemplate, template],
  SyncedMethod: (method) => [Identifiers.SyncedMethod, method],
  DynamicVariableIdentifier: Identifiers.DynamicVariable,
  TypedVariableIdentifier: Identifiers.TypedVariable,
  SyncedVariableIdentifier: Identifiers.SyncedVariable,
  FunctionTemplateIdentifier: Identifiers.FunctionTemplate,
  SyncedMethodIdentifier: Identifiers.SyncedMethod,
  VariableOrder: (value) => {
    switch (value[0]) {
      case Identifiers.TypedArrayVariable: return 0;
      case Identifiers.TypedVariable: return 0;
      case Identifiers.SyncedVariable: return 0;
      case Identifiers.SyncedArrayVariable: return 0;
      case Identifiers.DynamicVariable: return 1;
      case Identifiers.FunctionTemplate: return 2;
    }
  },
  DynamicOrder: (value) => {
    if (value[1] == null) {
      return 7;
    }
    switch (typeof value[1]) {
      case "number": return 0;
      case "bigint": return 1;
      case "boolean": return 2;
      case "string": return 3;
      case "symbol": return 4;
      case "object": return 5;
      case "function": return 6;

      case "undefined": return 8;
    }
  },
  TypedOrder: (value) => {
    switch (value[2]) {
      case "biguint64": return 0;
      case "bigint64": return 1;
      case "float64": return 2;
      case "float32": return 3;
      case "uint32": return 4;
      case "int32": return 5;
      case "uint16": return 6;
      case "int16": return 7;
      case "uint8": return 8;
      case "int8": return 9;
    }
  }
};

exports.Template = (templates, definition) => {
  const combined = {};
  for (let i = 0, length = templates.length; i < length; i++) {
    Utility.Overlap(combined, templates[i]);
  }
  return Utility.Overlap(combined, definition);
}

const TypedCalculationMemory = new Uint8Array(4);
const RoundToNearestBytes = (bytes, size) => Math.ceil(bytes / size) * size;
/*const SubmitTypedArray = (buffer, currentType) => {
  switch (currentType) {
    case "biguint64": return new BigUint64Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 4));
    case "bigint64": return new BigInt64Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 8));
    case "float64": return new Float64Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 8));
    case "float32": return new Float32Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 4));
    case "uint32": return new Uint32Array(buffer, RoundToNearestBytes(RoundToTypedCalculationMemory[1], 4));
    case "int32": return new Int32Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 4));
    case "uint16": return new Uint16Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 2));
    case "int16": return new Int16Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 2));
    case "uint8": return new Uint8Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 1));
    case "int8": return new Int8Array(buffer, RoundToNearestBytes(TypedCalculationMemory[1], 1));
  }
}*/
const GenerateTypedArray = (buffer, currentType, offset, length = undefined) => {
  switch (currentType) {
    case "biguint64": return new BigUint64Array(buffer, offset, length);
    case "bigint64": return new BigInt64Array(buffer, offset, length);
    case "float64": return new Float64Array(buffer, offset, length);
    case "float32": return new Float32Array(buffer, offset, length);
    case "uint32": return new Uint32Array(buffer, offset, length);
    case "int32": return new Int32Array(buffer, offset, length);
    case "uint16": return new Uint16Array(buffer, offset, length);
    case "int16": return new Int16Array(buffer, offset, length);
    case "uint8": return new Uint8Array(buffer, offset, length);
    case "int8": return new Int8Array(buffer, offset, length);
  }
}
const TotalOrder = (variable) => {
  switch (variable[2][0]) {
    case Identifiers.TypedVariable:
    case Identifiers.TypedArrayVariable:
    case Identifiers.SyncedVariable:
    case Identifiers.SyncedArrayVariable: {
      return (exports.Variables.VariableOrder(variable[2]) * 10) + exports.Variables.TypedOrder(variable[2]);
    }
    case Identifiers.DynamicVariable: {
      return (exports.Variables.VariableOrder(variable[2]) * 10) + exports.Variables.DynamicOrder(variable[2]);
    }
    case Identifiers.FunctionTemplate: {
      return (exports.Variables.VariableOrder(variable[2]) * 10);
    }
  }
}
const GenerateDataStorage = (buffer, generation) => {
  const storage = [[]];
  for (let i = 0, length = generation[0].length; i < length; i++) {
    storage[0].push(Utility.Clone(generation[0][i], true));
  }
  for (let i = 1, length = generation.length; i < length; i++) {
    storage.push(GenerateTypedArray(buffer, generation[i][0], generation[i][1]));
  }
  return storage;
}
const ReferenceDataBuilder = (componentGenerator, dataStorage, buffer, syncedVariableModule) => {
  const referenceData = {};
  for (let i = 0, length = componentGenerator.length; i < length; i++) {
    if ((componentGenerator[i][1] & (1 << 0)) === 0) {
      Object.defineProperty(referenceData, componentGenerator[i][0], {
        configurable: true,
        enumerable: true,
        get: () => dataStorage[componentGenerator[i][2]][componentGenerator[i][3]],
        set: (value) => dataStorage[componentGenerator[i][2]][componentGenerator[i][3]] = value
      });
    } else {
      if ((componentGenerator[i][1] & (1 << 1)) !== 0) {
        let typedArray = GenerateTypedArray(buffer, componentGenerator[i][2], componentGenerator[i][3], componentGenerator[i][4]);
        if ((componentGenerator[i][1] & (1 << 2)) !== 0) {
          const syncedVariableId = syncedVariableModule[0].length;
          syncedVariableModule[0].push((value, index) => {
            typedArray[index] = value;
          });
          syncedVariableModule[1](0, syncedVariableId, -1, typedArray, componentGenerator[i][0]);
          const syncedArrayHandler = {
            get: (target, property, receiver) => {
              return Reflect.get(target, property, receiver);
            },
            set: (target, property, value) => {
              syncedVariableModule[1](1, syncedVariableId, property, value);
              return Reflect.set(target, property, value);
            }
          }, proxy = new Proxy(typedArray, syncedArrayHandler);
          Object.defineProperty(referenceData, componentGenerator[i][0], {
            configurable: true,
            enumerable: true,
            get: () => proxy,
            set: (value) => {
              throw new Error("Cannot set a SyncedArray on a compiled definition");
            }
          });
        } else {
          Object.defineProperty(referenceData, componentGenerator[i][0], {
            configurable: true,
            enumerable: true,
            get: () => typedArray,
            set: (value) => {
              throw new Error("Cannot set a TypedArray on a compiled definition");
            }
          });
        }
      } else {
        if ((componentGenerator[i][1] & (1 << 2)) !== 0) {
          dataStorage[componentGenerator[i][2]][componentGenerator[i][3]] = componentGenerator[i][4];
          const syncedVariableId = syncedVariableModule[0].length;
          syncedVariableModule[0].push((value) => {
            dataStorage[componentGenerator[i][2]][componentGenerator[i][3]] = value;
          });
          syncedVariableModule[1](0, syncedVariableId, null, componentGenerator[i][4], componentGenerator[i][0]);
          Object.defineProperty(referenceData, componentGenerator[i][0], {
            configurable: true,
            enumerable: true,
            get: () => dataStorage[componentGenerator[i][2]][componentGenerator[i][3]],
            set: (value) => {
              dataStorage[componentGenerator[i][2]][componentGenerator[i][3]] = value;
              syncedVariableModule[1](1, syncedVariableId, null, value);
            }
          });
        } else {
          dataStorage[componentGenerator[i][2]][componentGenerator[i][3]] = componentGenerator[i][4];
          Object.defineProperty(referenceData, componentGenerator[i][0], {
            configurable: true,
            enumerable: true,
            get: () => dataStorage[componentGenerator[i][2]][componentGenerator[i][3]],
            set: (value) => dataStorage[componentGenerator[i][2]][componentGenerator[i][3]] = value
          });
        }
      }
    }
  }
  return referenceData;
}

exports.Compile = (components, definition, globalCache, zones) => {
  let byteCount = 0, byteRound = 0;
  const construct = [
    (client, entityId, room, interfaceGenerator) => {
      const instance = {
        entityId: entityId
      }, buffer = new ArrayBuffer(byteCount), dataStorage = GenerateDataStorage(buffer, construct[1][0]);
      if (client != null) {
        instance.syncedVariableModule = [
          [], // SET SYNCEDVARIABLES
          (flag, syncedVariableId, index = null, value, name) => {
            if (flag == 0) {
              // ADD
              if (index != null) {
                client.injection.addArraySync(syncedVariableId, name, value);
              } else {
                client.injection.addSync(syncedVariableId, name, value);
              }
            } else if (flag == 1) {
              // UPDATE
              if (index != null) {
                client.injection.updateArraySync(syncedVariableId, value, index);
              } else {
                client.injection.updateSync(syncedVariableId, value);
              }
            } else if (flag == 2) {
              // REMOVE
              client.injection.removeSync(syncedVariableId);
            }
          } // SYNC SYNCEDVARIABLES
        ];
        if (construct[2][0].length > 0) {
          for (let i = 0, length = construct[2][0].length; i < length; i += 2) {
            client.injection.addClient(construct[2][0][i][0], construct[2][0][i][1], construct[2][0][i][2]);
          }
        }
      }
      for (let i = 0, length = construct[2][2].length; i < length; i++) {
        construct[2][2][i](entityId, instance);
      }
      const interfaces = interfaceGenerator(instance, construct[2][1]);
      for (const trigger in construct[2][1]) {
        for (let i = 0, length = construct[2][1][trigger].length; i < length; i++) {
          construct[2][1][trigger][i].cache[entityId] = construct[2][1][trigger][i].cacheInstance({}, entityId);
          construct[2][1][trigger][i].execute[entityId] = (args) => {
            construct[2][1][trigger][i].apply(construct[2][1][trigger][i].cache[entityId], [interfaces].concat(args));
          }
        }
      }
      for (let i = 0, length = construct[1][1].length; i < length; i++) {
        construct[1][1][i](instance, dataStorage, buffer, instance.syncedVariableModule);
      }
      /*const renderBlocks = {

      };
      const zoneInterface = {

      };
      const componentInterface = {
        getComponent: (component) => instance[component],
        checkComponent: (component) => instance[component] != null,
        // IN THE FUTURE ADD IN ADDCOMPONENT AND REMOVECOMPONENT METHODS
        instance: () => instance,
        trigger: (method, args) => {
          for (let i = 0, length = construct[2][1][method].length; i < length; i++) {
            construct[2][1][method][i].apply(construct[2][1][method][i].cache[entityId], ({componentInterface, zoneInterface, renderBlocks}.concat(args)));
          }
        }
      };*/

      //instance.trigger = (method, ...args) => componentInterface.trigger(method, args);
      return instance;
    }, // BUILD
    [[[]], []], // DATASTORAGE + REFERENCE DATA
    [[], {}, []], // CLIENTSIDE METHODS + TRIGGERS + GENERATION
    {} // METHODS
  ],
  combinedEntries = [],
  clientMethodIndices = {
    window: {}
  };
  exports.DependencyInjection(components, definition.components);
  for (let i = 0, length = definition.components.length; i < length; i++) {
    const componentGenerator = [], information = {};
    for (const field in definition.components[i].fields) {
    
      if (!exports.Variables.VariableCheck(definition.components[i].fields[field])) {
        definition.components[i].fields[field] = exports.Variables.DynamicVariable(definition.components[i].fields[field]);
      } else {
        if (definition.components[i].fields[field][0] === Identifiers.TypedVariable || definition.components[i].fields[field][0] === Identifiers.SyncedVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].fields[field][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount += typeBytes;
        } else if (definition.components[i].fields[field][0] === Identifiers.TypedArrayVariable || definition.components[i].fields[field][0] === Identifiers.SyncedArrayVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].fields[field][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount += (typeBytes * definition.components[i].fields[field][1]);
        }
      }
      if (definition.components[i].fields[field][0] === Identifiers.FunctionTemplate) {
        let feed = null;
        if (definition[definition.components[i].name] != null && definition[definition.components[i].name][field] != null) {
          feed = definition[definition.components[i].name][field];
        }
        let executed = definition.components[i].fields[field][1](feed);
        if (!exports.Variables.VariableCheck(executed)) {
          executed = exports.Variables.DynamicVariable(executed);
        }
        information[field] = executed[1];
        combinedEntries.push([componentGenerator, field, executed]);
      } else {
        combinedEntries.push([componentGenerator, field, exports.Variables.VariableOverlap(definition[definition.components[i].name], field, Utility.Clone(definition.components[i].fields[field]))]);
        if (definition[definition.components[i].name] != null) {
          information[field] = definition[definition.components[i].name][field];
        } else {
          information[field] = definition.components[i].fields[field];
        }
      }
    }
    for (const property in definition.components[i].properties) {
      if (!exports.Variables.VariableCheck(definition.components[i].properties[property])) {
        definition.components[i].properties[property] = exports.Variables.DynamicVariable(definition.components[i].properties[property]);
      } else {
        if (definition.components[i].properties[property][0] === Identifiers.TypedVariable || definition.components[i].properties[property][0] === Identifiers.SyncedVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].properties[property][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount += typeBytes;
        } else if (definition.components[i].properties[property][0] === Identifiers.TypedArrayVariable || definition.components[i].properties[property][0] === Identifiers.SyncedArrayVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].properties[property][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount += (typeBytes * definition.components[i].properties[property][1]);
        }
      }
      combinedEntries.push([componentGenerator, property, Utility.Clone(definition.components[i].properties[property])]);
      information[property] = definition.components[i].properties[property];
    }

    construct[1][1].push((instance, dataStorage, buffer) => {
      let referenceData = ReferenceDataBuilder(componentGenerator, dataStorage, buffer, instance.syncedVariableModule);
      referenceData.configuration = Utility.Clone(definition.components[i].configuration);
      referenceData.configuration.id = definition.components[i].id;
      for (let j = 0, length2 = definition.components[i].type.length; j < length2; j++) {
        Object.defineProperty(instance, definition.components[i].type[j], {
          configurable: true,
          enumerable: true,
          get: () => referenceData,
          set: (value) => referenceData = value
        });
      }
    });
    
    const sharedCache = {};
    construct[2][2].push((entityId, instance) => {
      sharedCache[entityId] = {
        globalCache
      };
      if (definition.components[i].compilation != null) {
        definition.components[i].compilation.apply(sharedCache[entityId], [{instance, construct, information, sharedCache: sharedCache[entityId]}]);
      }
    });
    if (definition.components[i].client != null) {
      if (definition.components[i].client.triggers != null) {
        for (const clientsideFunction in definition.components[i].client.triggers) {
          if (clientsideFunction === "window") {
            for (const windowFunction in definition.components[i].client.triggers.window) {
              if (clientMethodIndices.window[windowFunction] == null) {
                clientMethodIndices.window[windowFunction] = 0;
              }
              construct[2][0].push(["triggers.window." + windowFunction, clientMethodIndices.window[windowFunction]++, definition.components[i].client.triggers.window[windowFunction].toString()]);
            }
          } else {
            if (clientMethodIndices[clientsideFunction] == null) {
              clientMethodIndices[clientsideFunction] = 0;
            }
            construct[2][0].push(["triggers." + windowFunction, clientMethodIndices[clientsideFunction]++, definition.components[i].client.triggers[clientsideFunction].toString()]);
          }
        }
      }
    }
    for (const trigger in definition.components[i].triggers) {
      definition.components[i].triggers[trigger].cacheInstance = (cache, entityId) => {
        cache.sharedCache = sharedCache[entityId];
        return Utility.Overlap(cache, definition.components[i].methods);
      }
      if (construct[2][1][trigger] == null) {
        construct[2][1][trigger] = [];
      }
      construct[2][1][trigger].push(definition.components[i].triggers[trigger]);
    }
  }
  const combinedEntriesLength = combinedEntries.length;
  const k = Math.max.apply(null, (() => {
    const x = [];
    for (let i = 0; i < combinedEntriesLength; i++) {
      x.push(Math.ceil(Math.log(TotalOrder(combinedEntries[i])) / Math.log(2)));
    }
    return x;
  })());
  for (let d = 0; d < k; d++) {
    for (let i = 0, p = 0, b = 1 << d; i < combinedEntriesLength; i++) {
      if ((TotalOrder(combinedEntries[i]) & b) === 0) {
        combinedEntries.splice(p++, 0, combinedEntries.splice(i, 1)[0]);
      }
    }
  }
  byteCount = RoundToNearestBytes(byteCount, byteRound);

  TypedCalculationMemory[0] = 0, TypedCalculationMemory[1] = 0, TypedCalculationMemory[2] = 1, TypedCalculationMemory[3] = 0;
  let currentType = "";
  for (let i = 0, length = combinedEntries.length; i < length; i++) {
    if (combinedEntries[i][2][0] === Identifiers.TypedVariable || combinedEntries[i][2][0] === Identifiers.TypedArrayVariable || combinedEntries[i][2][0] === Identifiers.SyncedVariable || combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
      if (combinedEntries[i][2][2] !== currentType) {
        if (currentType !== "") {
          TypedCalculationMemory[2] += 1;
        }
        TypedCalculationMemory[3] = 0;
        currentType = combinedEntries[i][2][2];
        //construct[1][0].push([currentType, (() => {
        switch (currentType) {
          case "biguint64": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 8); break;
          case "bigint64": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 8); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 8);
          case "float64": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 8); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 8);
          case "float32": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 4); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 4);
          case "uint32": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 4); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 4);
          case "int32": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 4); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 4);
          case "uint16": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 2); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 2);
          case "int16": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 2); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 2);
          case "uint8": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 1); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 1);
          case "int8": TypedCalculationMemory[0] = RoundToNearestBytes(TypedCalculationMemory[0], 1); break; //return RoundToNearestBytes(TypedCalculationMemory[1], 1);
        }
        TypedCalculationMemory[1] = TypedCalculationMemory[0];
        construct[1][0].push([currentType, TypedCalculationMemory[1]]);

        //})()]);
      }
      const array = TypedCalculationMemory[2], index = TypedCalculationMemory[3];
      if (combinedEntries[i][2][0] === Identifiers.SyncedVariable || combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
        if (combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
          combinedEntries[i][0].push([combinedEntries[i][1], 0b0111, currentType, TypedCalculationMemory[0], combinedEntries[i][2][1]]);
        } else {
          combinedEntries[i][0].push([combinedEntries[i][1], 0b0101, array, index, combinedEntries[i][2][1]]);
        }
      } else {
        if (combinedEntries[i][2][0] === Identifiers.TypedArrayVariable) {
          combinedEntries[i][0].push([combinedEntries[i][1], 0b0011, currentType, TypedCalculationMemory[0], combinedEntries[i][2][1]]);
        } else {
          combinedEntries[i][0].push([combinedEntries[i][1], 0b0001, array, index, combinedEntries[i][2][1]]);
        }
      }
      if (combinedEntries[i][2][0] === Identifiers.TypedArrayVariable || combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
        //for (let j = index; j < index + combinedEntries[i][2][1]; j++) {
        //  dataStorage[array][j] = 0;
        //}
        TypedCalculationMemory[3] += combinedEntries[i][2][1];
        TypedCalculationMemory[0] += exports.TypeBytes(currentType) * combinedEntries[i][2][1];
      } else {
        //dataStorage[array][index] = combinedEntries[i][2][1];
        TypedCalculationMemory[3] += 1;
        TypedCalculationMemory[0] += exports.TypeBytes(currentType);
      }
    } else if (combinedEntries[i][2][0] === Identifiers.DynamicVariable) {
      const dynamicIndex = construct[1][0][0].length;
      construct[1][0][0].push(combinedEntries[i][2][1]);
      combinedEntries[i][0].push([combinedEntries[i][1], 0b0000, 0, dynamicIndex]);
    }
  }

  return construct;
  /*
  let instance = null;
  const construct = [
    {}, // ENTITY INFO
    {}, // TRIGGERS
    [], // RENDERBLOCKS
    [], // REFERENCE DATA
    [[], [], null, []], // CLIENTSIDE
    [], // ZONES
    (definition) => instance = definition // INSTANCE
  ],
  dataStorage = [[]],
  combinedEntries = [];
  let byteCount = 0, byteRound = 0, buffer = null;
  exports.DependencyInjection(components, definition.components);
  for (let i = 0, length = definition.components.length; i < length; i++) {
    const referenceIndex = construct[3].length;
    construct[3].push({
      configuration: Utility.Overlap(definition.components[i].configuration, {
        id: definition.components[i].id
      })
    });
    for (let j = 0, length2 = definition.components[i].type.length; j < length2; j++) {
      Object.defineProperty(construct[0], definition.components[i].type[j], {
        configurable: true,
        enumerable: true,
        get: () => instance[3][referenceIndex],
        set: (value) => instance[3][referenceIndex] = value
      });
    }
    for (const field in definition.components[i].fields) {
      if (!exports.Variables.VariableCheck(definition.components[i].fields[field])) {
        definition.components[i].fields[field] = exports.Variables.DynamicVariable(definition.components[i].fields[field]);
      } else {
        if (definition.components[i].fields[field][0] === Identifiers.TypedVariable || definition.components[i].fields[field][0] === Identifiers.SyncedVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].fields[field][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount = byteCount + typeBytes;
        } else if (definition.components[i].fields[field][0] === Identifiers.TypedArrayVariable || definition.components[i].fields[field][0] === Identifiers.SyncedArrayVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].fields[field][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount = byteCount + (typeBytes * definition.components[i].fields[field][1]);
        }
      }
      if (definition.components[i].fields[field][0] === Identifiers.FunctionTemplate) {
        if (definition[definition.components[i].name] != null && definition[definition.components[i].name][field] != null) {
          definition[definition.components[i].name][field] = definition.components[i].fields[field][1](definition[definition.components[i].name][field]);
          if (!exports.Variables.VariableCheck(definition[definition.components[i].name][field])) {
            combinedEntries.push([referenceIndex, field, exports.Variables.DynamicVariable(definition[definition.components[i].name][field])]);
          } else {
            combinedEntries.push([referenceIndex, field, definition[definition.components[i].name][field]]);
          }
        } else {
          const executed = definition.components[i].fields[field][1](null);
          if (!exports.Variables.VariableCheck(executed)) {
            combinedEntries.push([referenceIndex, field, exports.Variables.DynamicVariable(executed)]);
          } else {
            combinedEntries.push([referenceIndex, field, executed]);
          }
        }
      } else {
        if (definition[definition.components[i].name] != null && definition[definition.components[i].name][field] != null) {
          combinedEntries.push([referenceIndex, field, exports.Variables.VariableOverlap(definition[definition.components[i].name][field], Utility.Clone(definition.components[i].fields[field]))]);
        } else {
          combinedEntries.push([referenceIndex, field, Utility.Clone(definition.components[i].fields[field])]);
        }
      }
    }
    for (const property in definition.components[i].properties) {
      if (!exports.Variables.VariableCheck(definition.components[i].properties[property])) {
        definition.components[i].properties[property] = exports.Variables.DynamicVariable(definition.components[i].properties[property]);
      } else {
        if (definition.components[i].properties[property][0] === Identifiers.TypedVariable || definition.components[i].properties[property][0] === Identifiers.SyncedVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].properties[property][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount += typeBytes;
        } else if (definition.components[i].properties[property][0] === Identifiers.TypedArrayVariable || definition.components[i].properties[property][0] === Identifiers.SyncedArrayVariable) {
          const typeBytes = exports.TypeBytes(definition.components[i].properties[property][2]);
          if (typeBytes > byteRound) {
            byteRound = typeBytes;
          }
          byteCount += (typeBytes * definition.components[i].properties[property][1]);
        }
      }
      combinedEntries.push([referenceIndex, property, Utility.Clone(definition.components[i].properties[property])]);
    }
    if (definition.components[i].client.triggers) {
      for (const clientsideFunction in definition.components[i].client.triggers) {
        if (clientsideFunction === "windowEvents") {
          for (const windowFunction in definition.components[i].client.triggers.windowEvents) {
            construct[4][3].push("triggers.window." + windowFunction, definition.components[i].client.triggers.windowEvents[windowFunction].toString());
          }
        } else {
          construct[4][3].push("triggers." + clientsideFunction, definition.components[i].client.triggers[clientsideFunction].toString());
        }
      }
    }
    if (definition.components[i].client.methods) {
      for (const clientsideMethod in definition.components[i].client.methods) {
        construct[4][3].push("methods." + clientsideMethod, definition.components[i].client.methods[clientsideFunction].toString());
      }
    }
    if (definition.components[i].client.variables) {
      for (const clientsideVariable in definition.components[i].client.variables) {
        construct[4][3].push("variables." + clientsideVariable, JSON.stringify(definition.components[i].client.variables[clientsideVariable]));
      }
    }
    const methods = {};
    for (let method in definition.components[i].methods) {
      if (typeof definition.components[i].methods[method] === "function") {
        methods[method] = definition.components[i].methods[method];
      } else if (Array.isArray(definition.components[i].methods[method]) && definition.components[i].methods[method].length === 2) {
        methods[method] = definition.components[i].methods[method];
        construct[4][3].push("methods." + method, definition.components[i].methods[method].toString());
      } else {
        throw new Error("Invalid method type");
      }
    }
    const sharedCache = Utility.Overlap({
      globalCache
    }, methods);
    construct[3][referenceIndex].sharedCache = sharedCache;
    if (definition.components[i].client.packet) {
      construct[4][0].push(definition.components[i].client.packet.bind(sharedCache));
    }
    for (let trigger in definition.components[i].triggers) {
      definition.components[i].triggers[trigger].cache = {
        sharedCache,
        methods: methods
      };
      if (construct[1][trigger] != null) {
        construct[1][trigger].push(definition.components[i].triggers[trigger]);
      } else {
        construct[1][trigger] = [definition.components[i].triggers[trigger]];
      }
    }
    if (definition.components[i].compilation != null) {
      definition.components[i].compilation.apply(sharedCache, [construct, definition, definition[definition.components[i].name] || {}, sharedCache]);
    }
  }
  combinedEntries.sort((a, b) => {
    if (a[2][0] !== b[2][0]) {
      return CompareTwo(exports.Variables.VariableOrder(a[2]), exports.Variables.VariableOrder(b[2]));
    } else if (a[2][0] === b[2][0]) {
      if (a[2][0] === Identifiers.DynamicVariable && b[2][0] === Identifiers.DynamicVariable) {
        return CompareTwo(exports.Variables.DynamicOrder(a[2]), exports.Variables.DynamicOrder(b[2]));
      } else if ((a[2][0] === Identifiers.TypedVariable || a[2][0] === Identifiers.TypedArrayVariable || a[2][0] === Identifiers.SyncedVariable || a[2][0] === Identifiers.SyncedArrayVariable) && (b[2][0] === Identifiers.TypedVariable || b[2][0] === Identifiers.TypedArrayVariable || b[2][0] === Identifiers.SyncedVariable || b[2][0] === Identifiers.SyncedArrayVariable)) {
        return CompareTwo(exports.Variables.TypedOrder(a[2]), exports.Variables.TypedOrder(b[2]));
      }
    }
  });
  byteCount = RoundToNearestBytes(byteCount, byteRound);

  TypedCalculationMemory[0] = 0, TypedCalculationMemory[1] = 0, TypedCalculationMemory[2] = 1, TypedCalculationMemory[3] = 0;
  let currentType = "", SYNCEDVARIABLEID = 0;
  for (let i = 0, length = combinedEntries.length; i < length; i++) {
    if (combinedEntries[i][2][0] === Identifiers.TypedVariable || combinedEntries[i][2][0] === Identifiers.TypedArrayVariable || combinedEntries[i][2][0] === Identifiers.SyncedVariable || combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
      if (buffer == null) {
        buffer = new ArrayBuffer(byteCount);
      }
      if (combinedEntries[i][2][2] !== currentType) {
        if (currentType !== "") {
          TypedCalculationMemory[2] += 1;
        }
        TypedCalculationMemory[3] = 0;
        TypedCalculationMemory[1] = TypedCalculationMemory[0];
        currentType = combinedEntries[i][2][2];
        dataStorage.push(SubmitTypedArray(buffer, currentType));
      }
      const array = TypedCalculationMemory[2], index = TypedCalculationMemory[3];
      if (combinedEntries[i][2][0] === Identifiers.SyncedVariable || combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
        let typedArray = null;
        const syncedVariableId = SYNCEDVARIABLEID++;
        construct[4][1].push((value, INITILIZATIONMODE, isArray = false, arrayIndex = null) => {
          if (INITILIZATIONMODE) {
            if (combinedEntries[i][2][0] !== Identifiers.SyncedArrayVariable) {
              instance[4][2](false, false, syncedVariableId, null, dataStorage[array][index], combinedEntries[i][1], combinedEntries[i][2][4]);
            } else {
              instance[4][2](false, true, syncedVariableId, null, typedArray, combinedEntries[i][1], combinedEntries[i][2][4]);
            }
          } else {
            if (isArray) {
              typedArray[arrayIndex] = value;
              if (combinedEntries[i][2][3]) {
                combinedEntries[i][2][3].apply(instance[3][combinedEntries[i][0]].sharedCache, [value, arrayIndex, instance[3][combinedEntries[i][0]]]);
              }
            } else {
              dataStorage[array][index] = value;
              if (combinedEntries[i][2][3]) {
                combinedEntries[i][2][3].apply(instance[3][combinedEntries[i][0]].sharedCache, [value, instance[3][combinedEntries[i][0]]]);
              }
            }
          }
          return true;
        });
        if (combinedEntries[i][2][0] === Identifiers.SyncedVariable) {
          Object.defineProperty(construct[3][combinedEntries[i][0]], combinedEntries[i][1], {
            configurable: true,
            enumerable: true,
            get: () => dataStorage[array][index],
            set: (value) => {
              if (!Utility.Equals(dataStorage[array][index], value)) {
                instance[4][2](true, false, syncedVariableId, null, value);
                return dataStorage[array][index] = value;
              } else {
                return dataStorage[array][index];
              }
            }
          });
        } else {
          const handler = {
            get: (target, property) => {
              if (property === "decode") {
                return Array.from(target);
              } else {
                return Reflect.get(target, property);
              }
            },
            set: (target, property, value) => {
              if (!Utility.Equals(target[property], value)) {
                instance[4][2](true, true, syncedVariableId, property, value);
                return Reflect.set(target, property, value);
              } else {
                return true;
              }
            }
          };
          typedArray = new Proxy(GenerateTypedArray(buffer, currentType, TypedCalculationMemory[0], combinedEntries[i][2][1]), handler);
          Object.defineProperty(construct[3][combinedEntries[i][0]], combinedEntries[i][1], {
            configurable: true,
            enumerable: true,
            value: typedArray
          });
        }
      } else {
        if (combinedEntries[i][2][0] === Identifiers.TypedArrayVariable) {
          Object.defineProperty(construct[3][combinedEntries[i][0]], combinedEntries[i][1], {
            configurable: true,
            enumerable: true,
            value: GenerateTypedArray(buffer, currentType, TypedCalculationMemory[0], combinedEntries[i][2][1])
          });
        } else {
          Object.defineProperty(construct[3][combinedEntries[i][0]], combinedEntries[i][1], {
            configurable: true,
            enumerable: true,
            get: () => dataStorage[array][index],
            set: (value) => dataStorage[array][index] = value
          });
        }
      }
      if (combinedEntries[i][2][0] === Identifiers.TypedArrayVariable || combinedEntries[i][2][0] === Identifiers.SyncedArrayVariable) {
        for (let j = index; j < index + combinedEntries[i][2][1]; j++) {
          dataStorage[array][j] = 0;
        }
        TypedCalculationMemory[3] += combinedEntries[i][2][1];
        TypedCalculationMemory[0] += exports.TypeBytes(currentType) * combinedEntries[i][2][1];
      } else {
        dataStorage[array][index] = combinedEntries[i][2][1];
        TypedCalculationMemory[3] += 1;
        TypedCalculationMemory[0] += exports.TypeBytes(currentType);
      }
    } else if (combinedEntries[i][2][0] === Identifiers.DynamicVariable) {
      const referenceIndex = dataStorage[0].length;
      dataStorage[0].push(Utility.Clone(combinedEntries[i][2][1]));
      Object.defineProperty(construct[3][combinedEntries[i][0]], combinedEntries[i][1], {
        configurable: true,
        enumerable: true,
        get: () => dataStorage[0][referenceIndex],
        set: (value) => dataStorage[0][referenceIndex] = value
      });
    }
  }
  for (let i = 0, length = definition.zones.length; i < length; i++) {
    construct[5].push(definition.zones[i]);
  }
  return construct;
  */
  /*
  const construct = [
    {}, // ENTITY INFO
    {}, // TRIGGERS
    [], // RENDERBLOCKS
    []  // REFERENCE DATA
  ];
  exports.DependencyInjection(components, definition.components);
  for (let i = 0, length = definition.components.length; i < length; i++) {
    const information = definition[definition.components[i].name] || {};
    const compiled = exports.CompileComponent(definition.components[i], information);
    construct[3].push(compiled[0]);
    const index = construct[3].length - 1;
    for (let j = 0, length2 = definition.components[i].type.length; j < length2; j++) {
      Object.defineProperty(construct[0], definition.components[i].type[j], {
        configurable: true,
        enumerable: true,
        get: () => construct[3][index],
        set: (value) => construct[3][index] = value
      });
    }
    const sharedCache = {
      globalCache
    };
    for (let j = 0, length2 = compiled[1].length; j < length2; j++) {
      compiled[1][j][1].cache = {
        sharedCache
      };
      if (construct[1][compiled[1][j][0]]) {
        construct[1][compiled[1][j][0]].push(compiled[1][j][1]);
      } else {
        construct[1][compiled[1][j][0]] = [compiled[1][j][1]];
      }
    }
    if (definition.components[i].compilation != null) {
      definition.components[i].compilation.apply(sharedCache, [construct, definition, information, sharedCache]);
    }
  }
  return construct;
  */
}

exports.AddRequired = (required, components) => {
  for (let i = 0, length = required.length; i < length; i++) {
    if (!components.some((component) => component.name === required[i].name || component.type.some((type) => required[i].type.includes(type)))) {
      components.push(required[i]);
    }
  }
}

exports.DependencyInjection = (components, info) => {
  const types = info.map((component) => component.type);
  const names = info.map((component) => component.name);
  const dependencies = info.reduce((combined, current) => combined.concat(current.dependencies), []);
  for (let i = 0, length = dependencies.length; i < length; i++) {
    if (!names.find((name) => name === dependencies[i]) && !types.find((type) => type.includes(dependencies[i]))) {
      util.warn("Dependency " + '"' + dependencies[i] + '"' + "is missing, attempting to inject");
      const injection = components.find((component) => component.name === dependencies[i] || component.type.includes(dependencies[i]));
      if (injection != null) {
        info.push(injection);
        util.warn("Dependency injected. Please add " + '"' + dependencies[i] + '"' + " to the components array of the definition");
      } else {
        util.error("Injection failed, component " + '"' + dependencies[i] + '"' + " does not exist! Definitions compilation failed!");
        throw new Error("Missing dependency");
      }
    }
  }
}

const ZoneChangeHandler = (zone = null, name = "", fixed = false) => {
  const references = [
    null, // TARGET
    null  // PROXY
  ];
  const childrenInstances = {};
  const parentInstances = {};
  const defaultBuiltin = {
    descriptor: { configurable: false, enumerable: true, writable: false },
    define: false,
    has: true,
    get: true,
    set: false,
    delete: false,
    keys: true
  };
  const builtins = {
    order: {
      value: 0,
      set: true
    },
    name: {
      value: name
    },
    emit: {
      value: (event, ...args) => {
        if (zone != null) {
          return zone.trigger(event, ...args);
        } else {
          throw new Error("Cannot run emit event on zone root object");
        }
      }
    },
    define: {
      value: (builtin, value, descriptor) => {
        descriptor.value = value;
        builtins[builtin] = descriptor;
      }
    }
  };
  const builtinAction = (builtin, action) => {
    if (builtins[builtin] != null) {
      return builtins[builtin][action] || defaultBuiltin[action];
    } else {
      throw new Error("The builtin " + '"' + builtin + '"' + " doesn't exist, this probably means it's a zone hard setter");
    }
  }
  const isBuiltin = (property) => {
    const underscore = property.split("_");
    return builtins[property] != null || (underscore.length === 2 && (underscore[0] === "REFERENCES" || underscore[0] === "CHILDREN" || underscore[0] === "PARENTS" || underscore[0] === "REMOVED"));
  }
  if (zone != null) {
    builtins.order.value = zone.order;
  }
  const proxy = {
    getOwnPropertyDescriptor: (target, property) => {
      if (childrenInstances[property] != null) {
        return { configurable: false, enumerable: true, writable: false, value: childrenInstances[property] };
      } else {
        if (isBuiltin(property)) {
          return builtinAction(builtin, "descriptor");
        } else {
          return Reflect.getOwnPropertyDescriptor(target, property);
        }
      }
    },
    defineProperty: (target, property, descriptor) => {
      if (childrenInstances[property] != null) {
        throw new Error("Cannot redefine instance of child on zone");
      } else {
        if (isBuiltin(property)) {
          if (builtinAction(property, "define")) {
            builtins[property].descriptor = descriptor;
          } else {
            throw new Error("Cannot redefine builtin " + '"' + property + '"');
          }
        } else {
          return Reflect.defineProperty(target, property, descriptor);
        }
      }
    },
    has: (target, property) => {
      if (childrenInstances[property[0]] != null) {
        return true;
      } else {
        if (isBuiltin(property)) {
          return builtinAction(property, "has");
        } else {
          if (zone != null) {
            const check = zone.trigger("has", property);
            if (check == true || check.every((e) => !!e)) {
              return Reflect.has(target, property);
            } else {
              return false;
            }
          } else {
            return Reflect.has(target, property);
          }
        }
      }
    },
    get: (target, property) => {
      if (childrenInstances[property] != null) {
        return Reflect.get(childrenInstances, property);
      }
      if (isBuiltin(property)) {
        if (builtinAction(property, "get")) {
          return builtins[property].value;
        } else {
          return undefined;
        }
      } else {
        if (zone != null) {
          const check = zone.trigger("set", property);
          if (check == true || check.every((e) => !!e)) {
            return Reflect.get(target, property);
          } else {
            return undefined;
          }
        } else {
          return Reflect.get(target, property);
        }
      }
    },
    set: (target, property, value) => {
      if (childrenInstances[property] != null) {
        throw new Error("Cannot redefine child");
      }
      if (isBuiltin(property)) {
        const setterData = property.split("_");
        if (setterData.length === 2) {
          switch (setterData[0]) {
            case "REFERENCES": {
              if (setterData[1] === "TARGET") {
                return references[0] = value;
              } else if (setterData[1] === "PROXY") {
                return references[1] = value;
              } else {
                return false;
              }
            } break;
            case "PARENTS": {
              Reflect.set(parentInstances, setterData[1], value);
              return true;
            } break;
            case "CHILDREN": {
              Reflect.set(value, "PARENTS_" + builtins.name, references[1]);
              return Reflect.set(childrenInstances, setterData[1], value);
            } break;
            case "REMOVED": {
              if (setterData[1] === "CLEAN" && value == true) {
                for (const child of childrenInstances) {
                  Reflect.set(childrenInstances[child], "REMOVE_CLEAN", true);
                }
                for (const parent of parentInstances) {
                  delete parentInstances[parent][builtins.name];
                }
              }
              return true;
            } break;
            default: throw new Error("Invalid zone hard setter " + '"' + setterData[0] + '"');
          }
        } else {
          if (builtinAction(property, "set")) {
            return builtins[property] = value;
          } else {
            throw new Error("Cannot set builtin " + '"' + property + '"');
          }
        }
      } else {
        if (fixed) {
          if (!Reflect.get(target, property)) {
            return false;
          }
        }
        if (zone != null) {
          const check = zone.trigger("set", property, value);
          if (check == true || check.every((e) => !!e)) {
            return Reflect.set(target, property, value);
          } else {
            return false;
          }
        } else {
          return Reflect.set(target, property, value);
        }
      }
    },
    deleteProperty: (target, property) => {
      if (childrenInstances[property] != null) {
        return delete childrenInstances[property];
      } else {
        if (isBuiltin(property)) {
          if (builtinAction(property, "delete")) {
            return delete builtins[property];
          } else {
            throw new Error("Cannot delete builtin " + '"' + property + '"');
          }
        } else {
          if (property in target) {
            return delete target[property];
          } else {
            return false;
          }
        }
      }
    },
    ownKeys: (target) => {
      const keys = Reflect.ownKeys(target);
      for (const builtin in builtins) {
        if (builtinAction(builtin, "keys")) {
          keys.push(builtin);
        }
      }
      for (const child in childrenInstances) {
        keys.push(child);
      }
      return keys;
    }
  };
  return proxy;
}

exports.CompileZone = (zone) => {
  const ZoneArray = Utility.Clone(zone.initilizer.base);
  if (zone.initilizer.length !== 0 && zone.initilizer.length !== Infinity) {
    for (let i = 0; i < zone.initilizer.length; i++) {
      if (Array.isArray(ZoneArray)) {
        ZoneArray.push(zone.initilizer.fill);
      } else {
        ZoneArray[zone.initilizer.key + i.toString()] = zone.initilizer.fill;
      }
    }
  }
  const ZoneDataProxy = new Proxy(ZoneArray, ZoneChangeHandler(zone, zone.name, zone.initilizer.length !== 0 && zone.initilizer.length !== Infinity));
  Reflect.set(ZoneDataProxy, "REFERENCES_TARGET", ZoneArray);
  Reflect.set(ZoneDataProxy, "REFERENCES_PROXY", ZoneDataProxy);
  //let TargetSettingObject = ZoneMap[zone.root];
  //for (let j = 0, length2 = zone.parents.length; j < length2; j++) {
  //  TargetSettingObject = TargetSettingObject[zone.parents[j].name];
  //}
  //Reflect.set(TargetSettingObject, "CHILDREN_" + zone.name, ZoneDataProxy);
  return ZoneDataProxy;
}

exports.FormatZones = (ADSZ, zones, root, engines) => {
  const ZoneData = [
    null, // UPDATE FUNCTION
    [], // ENGINE FUNCTION TIMEOUTS
    ADSZ.ZoneMap // ZONEMAP
  ];
  for (let i = 0, length = root.length; i < length; i++) {
    const RootArray = [];
    ADSZ.ZoneMap[root[i]] = new Proxy(RootArray, ZoneChangeHandler(null, root[i]));
  }
  for (let i = 0, length = zones.length; i < length; i++) {
    ADSZ.Add(zones[i]);
    /*
    const ZoneArray = Utility.Clone(zones[i].initilizer.base);
    if (zones[i].initilizer.length !== 0 && zones[i].initilizer.length !== Infinity) {
      for (let i = 0; i < zones[i].initilizer.length; i++) {
        if (Array.isArray(ZoneArray)) {
          ZoneArray.push(zones[i].initilizer.fill);
        } else {
          ZoneArray[zones[i].initilizer.key + i.toString()] = zones[i].initilizer.fill;
        }
      }
    }
    const ZoneDataProxy = new Proxy(ZoneArray, ZoneChangeHandler(zones[i], zones[i].name, zones[i].initilizer.length !== 0 && zones[i].initilizer.length !== Infinity));
    let TargetSettingObject = ADSZ.ZoneMap[zones[i].root];
    for (let j = 0, length2 = zones[i].parents.length; j < length2; j++) {
      TargetSettingObject = TargetSettingObject[zones[i].parents[j].name];
    }
    Reflect.set(TargetSettingObject, "CHILDREN_" + zones[i].name, ZoneDataProxy);
    */
  }
  for (let i = 0, length = engines.length; i < length; i++) {
    const Engine = (entities, zone) => {
      if (engines[i].requirements.length > 0) {
        const filtered = [];
        for (let j = 0, length2 = entities.length; j < length2; j++) {
          let accept = true;
          for (let k = 0, length3 = engines[i].requirements.length; k < length3; k++) {
            if (!entities[j].componentInterface.hasComponent(engines[i].requirements[k])) {
              accept = false;
              break;
            }
          }
          if (accept) {
            filtered.push(entities[j]);
          }
        }
        engines[i].engine.apply(zone, [entities, zone]);
      } else {
        engines[i].engine.apply(zone, [entities, zone]);
      }
    }
    for (let j = 0, length2 = engines[i].zones.length; j < length2; j++) {
      const zoneSplit = engines[i].zones[j].split(".");
      let TargetSettingObject = ADSZ.ZoneMap;
      for (let k = 0, length3 = zoneSplit.length; k < length3; k++) {
        TargetSettingObject = TargetSettingObject[zoneSplit[k]];
      }
      ZoneData[1].push([Engine, engines[i].frequency, TargetSettingObject.order, TargetSettingObject]);
    }
  }
  ZoneData[1].sort((a, b) => a[2] - b[2]);
  zones.sort((a, b) => a.order - b.order);
  ZoneData[0] = (room) => {
    for (let i = 0, length = zones.length; i < length; i++) {
      zones[i].trigger("update", room);
    }
  }
  return ZoneData;
}

exports.RenderBlocks = {
  Create: (color, position, scale, angle, points) => [points.length * 2, color, position[0], position[1], scale[0], scale[1], angle].concat(points.flat()),
  Translate: (block, position) => {
    block[2] = position[0]; block[3] = position[1];
    return block;
  },
  Scale: (block, scale) => {
    block[4] = scale[0]; block[5] = scale[1];
    return block;
  },
  Rotate: (block, angle) => {
    block[6] = angle;
    return block;
  },
  Color: (block, color) => {
    block[1] = color;
    return block;
  },
  Get: {
    Position: (block) => [block[2], block[3]],
    Size: (block) => [block[4], block[5]],
    Rotation: (block) => block[6],
    Color: (block) => block[1]
  },
  GUI: {
    
  }
};

/*exports.CompileComponent = (component, info) => {
  const compiled = {}, properties = Object.keys(component.properties), fields = Object.keys(component.fields);
  for (let i = 0, length = properties.length; i < length; i++) {
    compiled[properties[i]] = Utility.Clone(component.properties[properties[i]]);
  }
  for (let i = 0, length = fields.length; i < length; i++) {
    if (typeof component.fields[fields[i]] === "function") {
      if (info[fields[i]] != null) {
        if (typeof info[fields[i]] === "function") {
          compiled[fields[i]] = info[fields[i]];
        } else {
          compiled[fields[i]] = component.fields[fields[i]](compiled[fields[i]]);
        }
      } else {
        compiled[fields[i]] = component.fields[fields[i]](null);
      }
    } else {
      if (info[fields[i]] != null) {
        compiled[fields[i]] = Utility.Overlap(Utility.Clone(component.fields[fields[i]]), info[fields[i]]);
      } else {
        compiled[fields[i]] = Utility.Clone(component.fields[fields[i]]);
      }
    }
  }
  compiled.configuration = Utility.Clone(component.configuration);
  compiled.configuration.id = component.id;
  return [compiled, Object.entries(component.triggers)];
}*/
