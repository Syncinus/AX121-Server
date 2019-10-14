const util = require("./lib/util.js");
const Commands = {
    info: {},
    flags: {},
    Parse: (string) => {
        string = string.trim();
        let command = null;
        const feed = [
            {},
            null,
            {},
            null
        ], info = [];
        for (const flag in Commands.flags) {
            feed[0][flag] = Commands.flags[flag][1];
        }
        let preventIncrement = [false, false, false, false, false], current = "";
        for (let i = 0, length = string.length; i < length; i++) {
            if (string[i] === '"') {
                preventIncrement[0] = !preventIncrement[0];
            } else if (string[i] === "'") {
                preventIncrement[1] = !preventIncrement[1];
            } else if (string[i] === "`") {
                preventIncrement[2] = !preventIncrement[2];
            } else if (string[i] === "(") {
                info.push(current);
                current = "";
                if (preventIncrement[3] == false) {
                    preventIncrement[3] = true;
                }
            } else if (string[i] === ")") {
                if (preventIncrement[3] == true) {
                    preventIncrement[3] = false;
                }
            } else if (string[i] === "!") {
                info.push(current);
                current = "";
                preventIncrement[4] = true;
            } else if (preventIncrement[4] == false && (string[i] === "@" || (string[i] === " " && (preventIncrement[0] == false && preventIncrement[1] == false && preventIncrement[2] == false && preventIncrement[3] == false && preventIncrement[4] == false)))) {
                info.push(current);
                current = "";
            }
            if (preventIncrement[4] == false) {
                if (string[i] == " ") {
                    if (preventIncrement[0] == true || preventIncrement[1] == true || preventIncrement[2] == true || preventIncrement[3] == true) {
                        current += string[i];
                    }
                } else {
                    current += string[i];
                }
            } else {
                current += string[i];
            }
        }
        if (current !== "") {
            info.push(current);
        }
        for (let i = 0, length = info.length; i < length; i++) {
            if (info[i].startsWith("@")) {
                feed[1] = info[i].substring(info[i].indexOf("@") + 1, info[i].length);
                if (!isNaN(feed[1])) {
                    feed[1] = Number(feed[1]);
                }
            } else if (info[i].startsWith("!")) {
                feed[3] = info[i].substring(info[i].indexOf("!") + 1, info[i].length);
            } else if (info[i].startsWith("(") && info[i].endsWith(")")) {
                const args = info[i].substring(info[i].indexOf("(") + 1, info[i].indexOf(")")).split(",").map((setter) => setter.split("=").map((part) => part.trim()));
                for (let j = 0, length2 = args.length; j < length2; j++) {
                    if (!isNaN(args[j][1])) {
                        args[j][1] = Number(args[j][1]);
                    }
                    feed[2][args[j][0]] = args[j][1];
                }
            } else {
                let flag = "";
                for (const possibleFlag in Commands.flags) {
                    if (info[i].startsWith(possibleFlag)) {
                        flag = possibleFlag;
                        break;
                    }
                }
                if (flag != "") {
                    const push = [null, null];
                    if (info[i].includes(":")) {
                        if (info[i].includes("$")) {
                            push[0] = info[i].substring(info[i].indexOf(":") + 1, info[i].indexOf("$"));
                        } else {
                            push[0] = info[i].substring(info[i].indexOf(":") + 1, info[i].length);
                        }
                    }
                    if (info[i].includes("$")) {
                        push[1] = info[i].substring(info[i].indexOf("$") + 1, info[i].length);
                    }
                    feed[0][flag] = Commands.flags[flag][0]({level: push[0], info: push[1]});
                } else {
                    command = Commands.Methods.GetCommand(info[i]);
                }
            }
        }
        let accepted = true;
        for (const requirementFlag in command.requirements.flags) {
            if (typeof command.requirements.flags[requirementFlag] === "function") {
                if (!command.requirements.flags[requirementFlag](feed[0][requirementFlag])) {
                    util.error("Flag " + requirementFlag + " isn't at an acceptable value to execute command " + '"' + command.commandName + '"');
                    accepted = false;
                    break;
                }
            } else {
                if (feed[0][requirementFlag] != command.requirements.flags[requirementFlag]) {
                    util.error("Flag " + requirementFlag + " isn't at an acceptable value to execute command " + '"' + command.commandName + '"');
                    accepted = false;
                    break;
                }
            }
        }
        for (const requirementArgument in command.requirements.arguments) {
            if (typeof command.requirements.arguments[requirementArgument] === "function") {
                if (!command.requirements.arguments[requirementArgument](feed[2][requirementArgument])) {
                    util.error("Argument " + requirementFlag + " isn't at an acceptable value to execute command " + '"' + command.commandName + '"');
                    accepted = false;
                    break; 
                }
            } else {
                if (feed[2][requirementFlag] != command.requirements.arguments[requirementArgument]) {
                    util.error("Argument " + requirementFlag + " isn't at an acceptable value to execute command " + '"' + command.commandName + '"');
                    accepted = false;
                    break; 
                }
            }
        }
        if (command.requirements.primary != null) {
            if (typeof command.requirements.primary == "function") {
                if (!command.requirements.primary(feed[1])) {
                    util.error("Primary argument isn't an acceptable value to execute command " + '"' + command.commandName + '"');
                    accepted = false;
                    break;
                }
            } else {
                if (feed[1] != command.requirements.primary) {
                    util.error("Primary argument isn't an acceptable value to execute command " + '"' + command.commandName + '"');
                    accepted = false;
                    break; 
                }
            }
        }
        if (accepted) {
            const result = command({flags: feed[0], main: feed[1], args: feed[2], info: feed[3]});
            util.log("Command " + "'" + command.commandName + "'" + " executed successfully with result " + '"' + result + '"');
        } else {
            util.error("Unable to execute command " + '"' + command.commandName + '"');
        }
    },
    Methods: {
        GetCommand: (command) => {
            if (command.includes(":")) {
                const info = command.split(":"), find = info[0].split(".");
                let location = Commands.info;
                for (let i = 0, length = find.length; i < length; i++) {
                    location = location[find[i]];
                }
                if (location == undefined) {
                    util.error("Non-existent command " + command);
                } else {
                    return location[info[1]];
                }
            } else {
                const possibilities = [], Search = (namespace, name, level) => {
                    for (const element in namespace) {
                        if (typeof namespace[element] === "function") {
                            const value = (level * 256) + name.charCodeAt(0);
                            possibilities.push([value, namespace[element]]);
                        } else if (typeof namespace[element] === "object") {
                            Search(namespace[element], element, level + 1);
                        }
                    }
                };
                Search(Commands.info, "info", 0);

                const possibilitiesLength = possibilities.length;
                const k = Math.max.apply(null, (() => {
                    const x = [];
                    for (let i = 0; i < possibilitiesLength; i++) {
                        x.push(Math.ceil(Math.log(possibilities[i][0])) / Math.log(2));
                    }
                    return x;
                }));
                for (let d = 0; d < k; d++) {
                    for (let i = 0, p = 0, b = 1 << d; i < possibilitiesLength; i++) {
                        if ((possibilities[i][0] & b) === 0) {
                            possibilities.splice(p++, 0, possibilities.splice(i, 1)[0]);
                        }
                    }
                }
                return possibilities[0][1];
            }
        },
        GetNamespace: (namespace) => {
            const insert = Commands.info, find = namespace.split(".");
            for (let i = 0, length = find.length; i < length; i++) {
                insert = insert[find[i]];
            }
            return insert;
        },
        SetFlag: (flag, base) => Commands.flags[flag][1] = base
    }
};

Commands.Flag = (
    name,
    base,
    parse,
) => {
    Commands.flags[name] = [parse, base];
}

Commands.Command = (
    space,
    args,
    command,
    {
        primary = null,
        flags = {},
        arguments = []
    }
) => {
    let name = "";
    const location = Commands.info, finder = space.split(":");
    if (finder.length !== 1 && finder[0].trim() !== "") {
        for (let i = 0, length = finder.length; i < length; i++) {
            location = location[finder[i]];
        }
    } else {
        if (finder.length === 2 && finder[0].trim() === "") {
            name = finder[1];
        } else {
            name = finder[0];
        }
    }
    command.commandName = name;
    command.args = args;
    command.requirements = {
        primary,
        flags,
        arguments
    };
    location[name] = command;
}

Commands.Command(
    "hello",
    {
        arg1: 10,
        arg2: 20
    },
    ({flags, main, args, info}) => {

    },
    {
        flags: {
            "access-level": (value) => value >= 1
        }
    }
);
 

Commands.Flag("access-level", 0, ({level, info}) => {
    return Number(level);
});

const readline = require("readline");
global.commandModule = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
let previousInput = "";
global.commandModule.on("line", (input) => {
    if (input !== previousInput) {
        Commands.Parse(input);
        previousInput = input;
    }
});
