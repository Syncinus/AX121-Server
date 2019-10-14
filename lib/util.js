/* jslint node: true */

'use strict';

const { performance } = require('perf_hooks');

exports.addArticle = function(string) {
    return (/[aeiou]/i.test(string[0])) ? 'an ' + string : 'a ' + string;
};

exports.getDistance = function (p1, p2) {
    return Math.sqrt(Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2));
};

exports.getDirection = function (p1, p2) {
    return Math.atan2(p2[1]- p1[1], p2[0]- p1[0]);
};

exports.clamp = function(value, min, max) {
    return Math.min(Math.max(value, min), max);
};

/*exports.angleDifference = function(a1, a2) {
    let diff1 = a2 - a1;
    while (diff1 >= 2*Math.PI) {
        diff1 -= 2*Math.PI;
    }
    while (diff1 < 0) {
        diff1 += 2*Math.PI;
    }
    let diff2 = a1 - a2;
    while (diff2 >= 2*Math.PI) {
        diff2 -= 2*Math.PI;
    }
    while (diff2 < 0) {
        diff2 += 2*Math.PI;
    }

    if (Math.abs(diff1) <= Math.abs(diff2)) { return diff1; }
    if (Math.abs(diff2) <= Math.abs(diff1)) { return diff2; }
};*/
exports.angleDifference = (() => {
    let mod = function(a, n) {
        return (a % n + n) % n;
    };
    return (sourceA, targetA) => {
        let a = targetA - sourceA;
        return mod(a + Math.PI, 2*Math.PI) - Math.PI;
    };
})();

exports.loopSmooth = (angle, desired, slowness) => {
    return exports.angleDifference(angle, desired) / slowness;
};

/*exports.loopClamp = function(angle, min, max) {
    angle = angle % (Math.PI * 2);
    min = min % (Math.PI * 2); if (min < 0) min += Math.PI * 2;
    max = max % (Math.PI * 2); if (max < 0) max += Math.PI * 2;
    let a = (max - min) % (Math.PI * 2); if (a < 0) a += Math.PI * 2;
    if (angle - min > a) return max;
    if (angle - min < 0) return min;
    return angle;
};*/


/*exports.pointInArc = function(point, givenAngle, allowedDifference) {
    let len = Math.sqrt(point.x * point.x + point.y * point.y);
    let norm = { x: point.x / len, y: point.y / len, };
    let vect = { x: Math.cos(givenAngle), y: Math.sin(givenAngle), };
    let dot = norm.x * vect.x + norm.y * vect.y;
    let a1 = Math.atan2(point.y, point.x);
    let a2 = Math.acos(dot);
    let diff = exports.angleDifference(a1, a2);
};*/

/*exports.isInArc = function(angle, arc) {
    return exports.loopClamp(angle, arc[0], arc[1]) === angle;
};*/

exports.deepClone = (obj, hash = new WeakMap()) => {
    let result;
    // Do not try to clone primitives or functions
    if (Object(obj) !== obj || obj instanceof Function) return obj;
    if (hash.has(obj)) return hash.get(obj); // Cyclic reference
    try { // Try to run constructor (without arguments, as we don't know them)
        result = new obj.constructor();
    } catch(e) { // Constructor failed, create object without running the constructor
        result = Object.create(Object.getPrototypeOf(obj));
    }
    // Optional: support for some standard constructors (extend as desired)
    if (obj instanceof Map)
        Array.from(obj, ([key, val]) => result.set(exports.deepClone(key, hash),
                                                   exports.deepClone(val, hash)) );
    else if (obj instanceof Set)
        Array.from(obj, (key) => result.add(exports.deepClone(key, hash)) );
    // Register in hash
    hash.set(obj, result);
    // Clone and assign enumerable own properties recursively
    return Object.assign(result, ...Object.keys(obj).map (
        key => ({ [key]: exports.deepClone(obj[key], hash) }) ));
};

exports.averageArray = arr => {
    if (!arr.length) return 0
    var sum = arr.reduce((a, b) => a + b)
    return sum / arr.length;
}

exports.sumArray = arr => {
    if (!arr.length) return 0
    var sum = arr.reduce((a, b) => a + b)
    return sum;
}


exports.signedSqrt = x => {
    return Math.sign(x) * Math.sqrt(Math.abs(x))
}

exports.getJackpot = x => {
    return (x > 26300 * 1.5) ? Math.pow(x - 26300, 0.85) + 26300 : x / 1.5;
}
exports.serverStartTime = performance.now();
exports.time = () => performance.now();
function timeprefix() {
    return `${(exports.time()/1000).toFixed(2)}\t`
}
exports.log = text => {
    console.log('[' + (exports.time()/1000).toFixed(2) + ']: ', text);
}
exports.warn = text => {
    console.log('[' + (exports.time()/1000).toFixed(2) + ']: ' + '[WARNING] ', text);
}
exports.error = text => {
    console.log('[' + (exports.time()/1000).toFixed(2) + ']: ' + '[ERROR] ', text);
}
exports.remove = (array, index) => {
    if (index === array.length - 1) {
        return array.pop();
    } else if (index >= 0) {
        let o = array[index]
        array[index] = array.pop()
        return o
    }
}
exports.removeSequential = (array, index) => {
    return array.splice(index, 1)[0]
}
exports.arrayCheck = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  if (arr1 === arr2) return true;
  for (let i = 0; i < arr1.length; i++) {
    if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
      if (exports.arrayCheck(arr1[i], arr2[i]) != true) return false;
    } else {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }
  }
}
exports.Utility = {
  Helpers: {
    IsTypedArray: (value) => (value instanceof Int8Array || value instanceof Uint8Array || value instanceof Int16Array || value instanceof Uint16Array || value instanceof Int32Array || value instanceof Uint32Array || value instanceof Float32Array || value instanceof Float64Array || value instanceof BigInt64Array || value instanceof BigUint64Array),
    IsArray: (value) => (value instanceof Array || exports.Utility.Helpers.IsTypedArray(value)),
    Cloning: {
      Primative: (x) => {
        return x;
      },
      Array: (x, d) => {
        const y = [];
        for (let i = 0, l = x.length; i < l; i++) {
          y.push(exports.Utility.Clone(x[i], d));
        }
        return y;
      },
      Object: (x) => {
        const y = {}, k = Object.keys(x);
        for (let i = 0, l = k.length; i < l; i++) {
          y[k[i]] = exports.Utility.Clone(x[k[i]]);
        }
        return y;
      },
      DeepObject: (x) => {
        const y = {}, k = Object.getOwnPropertyNames(x);
        for (let i = 0, l = k.length; i < l; i++) {
          const d = Object.getOwnPropertyDescriptor(x, k[i]);
          if (d.get !== undefined || d.set !== undefined) {
            Object.defineProperty(y, k[i], Object.getOwnPropertyDescriptor(x, k[i]));
          } else {
            y[k[i]] = exports.Utility.Clone(x[k[i]], true);
          }
        }
        return y;
      }
    },
    Equality: {
      TypeChecking: (a, b) => {
        if (typeof a !== typeof b) {
          return false;
        } else {
          if (typeof a === "object") {
            if (exports.Utility.Helpers.IsArray(a)) {
              if (exports.Utility.Helpers.IsArray(b)) {
                return true;
              } else {
                return false;
              }
            } else {
              if (exports.Utility.Helpers.IsArray(b)) {
                return false;
              } else {
                return true;
              }
            }
          } else {
            return true;
          }
        }
      },
      Primative: (a, b) => {
        return a === b;
      },
      Array: (a, b) => {
        if (a === b) {
          return true;
        } else {
          if (a.length !== b.length) {
            return false; 
          } else {
            for (let i = 0, l = a.length; i < l; i++) {
              if (!exports.Utility.Equals(a[i], b[i])) {
                return false;
              }
            }
            return true;
          }
        }
      },
      Object: (a, b) => {
        if (a === b) {
          return true;
        } else {
          const k1 = Object.keys(a), k2 = Object.keys(b);
          if (k1.length !== k2.length) {
            return false;
          } else {
            for (let i = 0, l = k1.length; i < l; i++) {
              if (!exports.Utility.Equals(k1[i], k2[i]) || !exports.Utility.Equals(a[k1[i]], a[k2[i]])) {
                return false;
              }
            }
            return true;
          }
        }
      }
    },
    Overlap: {
      Primative: (a, b) => {
        return b;
      },
      Array: (a, b) => {
        let i = 0;
        for (let length = a.length; i < length; i++) {
          if (typeof a[i] === "object") {
            if (typeof b[i] === "object") {
              if (exports.Utility.Helpers.IsArray(a[i])) {
                if (exports.Utility.Helpers.IsArray(b[i])) {
                  a[i] = exports.Utility.Overlap(a[i], b[i]);
                } else {
                  a[i] = exports.Utility.Clone(b[i]);
                }
              } else {
                if (exports.Utility.Helpers.IsArray(b[i])) {
                  a[i] = exports.Utility.Clone(b[i]);
                } else {
                  a[i] = exports.Utility.Overlap(a[i], b[i]);
                }
              }
            } else {
              a[i] = exports.Utility.Clone(b[i]);
            }
          } else {
            a[i] = exports.Utility.Clone(b[i]);
          }
        }
        if (b.length > a.length) {
          for (let l = b.length; i < l; i++) {
            a.push(exports.Utility.Clone(b[i]));
          }
        }
        return a;
      },
      Object: (a, b) => {
        const k1 = Object.keys(a), k2 = Object.keys(b);
        for (let i = 0, l = k1.length; i < l; i++) {
          const n = k2.indexOf(k1[i]);
          if (n !== -1) {
            if (typeof a[k1[i]] === "object") {
              if (typeof b[k2[n]] === "object") {
                if (exports.Utility.Helpers.IsArray(a[k1[i]])) {
                  if (exports.Utility.Helpers.IsArray(b[k2[n]])) {
                    a[k1[i]] = exports.Utility.Overlap(a[k1[i], b[k2[n]]]);
                  } else {
                    a[k1[i]] = exports.Utility.Clone(b[k2[n]]);
                  }
                } else {
                  if (exports.Utility.Helpers.IsArray(b[k2[n]])) {
                    a[k1[i]] = exports.Utility.Clone(b[k2[n]]);
                  } else {
                    a[k1[i]] = exports.Utility.Overlap(a[k1[i]], b[k2[n]]);
                  }
                }
              } else {
                a[k1[i]] = exports.Utility.Clone(b[k2[n]]);
              }
            } else {
              a[k1[i]] = exports.Utility.Clone(b[k2[n]]);
            }
            exports.Utility.Methods.Array.Delete(k2, n);
          }
        }
        if (k2.length > 0) {
          for (let i = 0, l = k2.length; i < l; i++) {
            a[k2[i]] = exports.Utility.Clone(b[k2[i]]);
          }
        }
        return a;
      }
    },
    DataConverter: (data, func) => {
      const elements = [];
      for (let i = 0, length = data.length; i < length;) {
        const results = func(i, data);
        elements.push(results[0]);
        i += results[1];
      }
      return elements;
    }
  },
  Methods: {
    Number: {
      Loop: (value, min, max) => (value < min || value > max) ? value % max : value
    },
    Parsing: {
      Int: (x) => {
        let v = 0, p = 1;
        for (let i = x.length - 1; i >= 0; i--) {
          switch (x[i]) {
            case "-": v = -v; break;
            case "9": v = v + 9 * p; p *= 10; break;
            case "8": v = v + 8 * p; p *= 10; break;
            case "7": v = v + 7 * p; p *= 10; break;
            case "6": v = v + 6 * p; p *= 10; break;
            case "5": v = v + 5 * p; p *= 10; break;
            case "4": v = v + 4 * p; p *= 10; break;
            case "3": v = v + 3 * p; p *= 10; break;
            case "2": v = v + 2 * p; p *= 10; break;
            case "1": v = v + 1 * p; p *= 10; break;
            default: return NaN;
          }
        }
        return v;
      }
    },
    Array: {
      Sum: (x) => {
        let v = 0;
        for (let i = 0, l = x.length; i < l; i++) {
          if (typeof x[i] === "string") {
            v += exports.Utility.Methods.Parsing.Int(x[i]);
          } else {
            v += x[i];
          }
        }
        return v;
      },
      Average: (x) => {
        return exports.Utility.Methods.Array.Sum(x) / x.length;
      },
      Delete: (x, i) => {
        return x.splice(i, 1)[0];
      }
    },
    Object: {
      Delete: (x, i) => {
        const y = exports.Utility.Clone(x[i]);
        delete x[i];
        return y;
      }
    }
  },
  Clone: (x, d = false) => {
    if (typeof x === "object" && x != null) {
      if (exports.Utility.Helpers.IsArray(x)) {
        return exports.Utility.Helpers.Cloning.Array(x, d);
      } else {
        if (d) {
          return exports.Utility.Helpers.Cloning.DeepObject(x);
        } else {
          return exports.Utility.Helpers.Cloning.Object(x);
        }
      }
    } else {
      return exports.Utility.Helpers.Cloning.Primative(x);
    }
  },
  Equals: (a, b) => {
    if (!exports.Utility.Helpers.Equality.TypeChecking(a, b)) {
      return false;
    } else {
      if (typeof a === "object") {
        if (exports.Utility.Helpers.IsArray(a) && exports.Utility.Helpers.IsArray(b)) {
          return exports.Utility.Helpers.Equality.Array(a, b);
        } else {
          return exports.Utility.Helpers.Equality.Object(a, b);
        }
      } else {
        return exports.Utility.Helpers.Equality.Primative(a, b);
      }
    }
  },
  Overlap: (a, b) => {
    if (typeof a === "object") {
      if (typeof b === "object") {
        if (exports.Utility.Helpers.IsArray(a)) {
          if (exports.Utility.Helpers.IsArray(b)) {
            return exports.Utility.Helpers.Overlap.Array(a, b);
          } else {
            return exports.Utility.Clone(b);
          }
        } else {
          if (exports.Utility.Helpers.IsArray(b)) {
            return exports.Utility.Clone(b);
          } else {
            return exports.Utility.Helpers.Overlap.Object(a, b);
          }
        }
      } else {
        return exports.Utility.Helpers.Overlap.Primative(a, b);
      }
    } else {
      return exports.Utility.Helpers.Overlap.Primative(a, b);
    }
  },
  DataConverters: {
    FunctionalDataConverter: (data, func) => {
      return exports.Utility.Helpers.DataConverter(data, func);
    },
    IncrementalDataConverter: (data, interpretation) => {
      return exports.Utility.Helpers.DataConverter(data, (i, data) => {
        const current = {};
        let read = 0;
        for (let j = 0, length = interpretation.length; j < length;) {
          if (exports.Utility.Helpers.IsArray(interpretation[j])) {
            current[interpretation[j][0]] = [];
            for (let k = 0; k < interpretation[j][1]; k++) {
              current[interpretation[j][0]].push(data[i + read + k]);
            }
            read += interpretation[j][1];
            j++;
          } else {
            current[interpretation[j]] = data[i + read];
            read++;
            j++;
          }
        }
        return [current, read];
      });
    }
  },
  Boxes: {
    MakeBox: (aa, bb) => [
      [
        aa[0],
        aa[1]
      ],
      [
        bb[0],
        bb[1]
      ]
    ],
    BoxOverlap: (a, b) => (
      a[0][0] < b[1][0] &&
      a[0][1] < b[1][1] &&
      a[1][0] > b[0][0] &&
      a[1][1] > b[0][1]
    ),
    PointOverlap: (a, b) => (
      a[0][0] < b[0] &&
      a[0][1] < b[1] &&
      a[1][0] > b[0] &&
      a[1][1] > b[1]
    )
  }
};