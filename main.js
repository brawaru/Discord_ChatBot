var Discordie = require("discordie"),
    Cleverbot = require("cleverbot-node"),
    Promise = require("promise"),
    chalk = require("chalk"),
    stripComments = require("strip-json-comments"),
    yaspeller = require("yaspeller"),
    fs = require("fs");
    
var discordBot = new Discordie({autoReconnect: true}),
    settings = undefined,
    cleverbot = {};

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

var log = (who, what, state) => {
    state = state || "log";
    try {
        if(what instanceof Error) {
            what = "\n" + JSON.stringify(what, Object.getOwnPropertyNames(what));
            if(state !== "err" || state !== "warn") { state = "err"; }
        } else if (what instanceof Object) {
            what = "\n" + JSON.stringify(what);
        }
    } catch(err) {
        // oh, shit!
        return;
    }
    
    switch(state) {
    case "log": default:
        what = chalk.white(what);
        break;
    case "error": case "err":
        what = chalk.red(what);
        break;
    case "info": case "inf":
        what = chalk.cyan(what);
        break;
    case "warning": case "warn":
        what = chalk.yellow(what);
        break;
    case "ok": case "good": case "OK":
        what = chalk.green(what);
        break;
    }
    
    console.log(`${chalk.bold("["+who+"]")} ${what}`);
};

var parseReponse = (resp) => {
    
    var x = resp["message"].replaceAll("|0", "\\u0").replaceAll("|D", "\\uD");
    
    var r = /\\u([\d\w]{4})/gi;
    
    x = x.replace(r, function (match, grp) {
        return String.fromCharCode(parseInt(grp, 16)); 
    } );
    
    x = unescape(x);
    
    return x;
};

var replyMin = 1000,
    replyMax = 5000,
    credentials = {},
    useGrammarNaziPower = false,
    noReplace = null;

var reloadSettings = (safe, errCallback, sCallback) => {
    
    if(safe) {
        
        errCallback = errCallback || (() => {});
        sCallback = sCallback || (() => {});
        
        var oldSettings = settings;
        try {
            reloadSettings();
            sCallback("Reloaded!");
        } catch (error) {
            settings = oldSettings;
            log("Settings", "I've got error when tried to load settings.", "warn");
            log("Settings", error, "warn");
            log("Settings", "As safe mode are enabled. Old settings restored.", "warn");
            errCallback(`I've got error when tried to load new settings.\n\`\`\`javascript\n${JSON.stringify(error)}\n\`\`\`\nAs it goes in safe mode old settings restored.`);
        }
        return;
    }
    
    var tmp = fs.readFileSync("./settings.json", {encoding: "utf8"});
    tmp = stripComments(tmp);
    settings = JSON.parse(tmp);
    
    if(!settings.bindToChannels) {
        log("Settings", "No binded channels, it's very bad!", "warn");
    }

    if(!settings.replyOnlyTo) {
        log("Settings", "Bot replies to all messages.", "warn");
    } else {
        log("Settings", `Bot replies only to: ${settings.replyOnlyTo}`, "info");
    }
    
    if(!settings.replyMinTime) {
        log("Settings", `Minimal time to reply not set. Used default value: ${replyMin}.`, "warn");
    } else {
        if(typeof(settings.replyMinTime) !== "number") {
            log("Settings", `Invalid type of \`replyMinTime\`. Used default value: ${replyMin}.`);
        } else {
            log("Settings", `Minimal time to reply: ${settings.replyMinTime}.`, "info");
            replyMax = settings.replyMinTime;
        }
    }
    
    if(settings.prefix === null || settings.prefix === undefined) {
        log("Settings", `Bot reacts to all messages${settings.bindToChannels ? ` in channels: ${settings.bindToChannels.join()}` : ""}`);
    } else {
        log("Settings", `Bot reacts only to messages, which starts with \`${settings.prefix} \` ${settings.bindToChannels ? `in channels: ${settings.bindToChannels.join()}` : ""}`);
    }

    if(!settings.replyMaxTime) {
        log("Settings", `Maximal time to reply not set. Used default value: ${replyMax}.`, "warn");
    } else {
        if(typeof(settings.replyMaxTime) !== "number") {
            log("Settings", `Invalid type of \`replyMaxTime\`. Used default value: ${replyMax}.`);
        } else {
            log("Settings", `Maximal time to reply: ${settings.replyMinTime}.`, "info");
            replyMax = settings.replyMaxTime;
        }
    }
    
    if(settings.token) {
        credentials = {"token": settings.token};
    } else if(settings.login && settings.password) {
        credentials = {"login":settings.login, "password": settings.password};
    } else {
        log("Settings", "Not provied `token` or `login` with `password`!", "err");
        process.exit(-1);
    }
    
    if(typeof settings.useGrammarNaziPower === "boolean") {
        if(settings.useGrammarNaziPower) {
            log("Settings", "We using Grammar nazi power!", "ok");
            useGrammarNaziPower = true;
        }
    }
    
    if(settings.noReplace) {
        if(useGrammarNaziPower) {
            if(settings.noReplace instanceof Array) {
                noReplace = settings.noReplace;
            } else if (typeof settings.noReplace !== "string"){
                log("Settings", "Invalid type of `noReplace`.");
            } else {
                log("Settings", `Trying to load file "${settings.noReplace}"...`);
                try {
                    var noReplaceTemp = require(settings.noReplace);
                    if(noReplaceTemp instanceof Array) {
                        noReplace = noReplaceTemp;
                        log("Settings", "Loaded.", "ok");
                    } else {
                        log("Settings", "Invalid type!", "err");
                    }
                } catch (error) {
                    log("Settings", "Something wrong...", "err");
                    log("Settings", error, "err");
                }
            }
        } else {
            log("Settings", "Looks like you want to use Grammar nazi (Yaspeller) power, but not enabled it.", "info");
        }
    }
};

try {
    log("Discord ChatBot", "Settings loading...");
    reloadSettings();
} catch (error) {
    log("Discord ChatBot", "Can't load settings!", "error");
    log("Discord ChatBot", "I are looking for the problem...");
    
    var fs = require("fs"),
        diagResult = {
            "fileNotExists": false,
            "requireProblem": null,
            "isArray": false,
            "isNotObject": false,
            "devContact": false,
            "settings": null
        };
    
    if(!fs.existsSync("./settings.json")) {
        log("Discord ChatBot", "File \"settings.json\" not found!", "err");
        diagResult.step_one = true;
    } else {
        try {
            var tmp = fs.readFileSync("./settings.json", {encoding: "utf8"});
            tmp = stripComments(tmp);
            settings  = JSON.parse(tmp);
        } catch (err) {
            log("Discord ChatBot", "File \"settings.json\" corruped?", "err");
            settings = undefined;
            diagResult.requireProblem = err;
        }
        
        if(settings) {
            if(settings instanceof Array) {
                log("Discord ChatBot", "Wrong type of \"settings.json\" object", "err");
                diagResult.isArray = true;
            } else {
                if(typeof settings !== "object") {
                    log("Discord ChatBot", "Wrong type of \"settings.json\". Should be `object`.", "err");
                    diagResult.isNotObject = true;
                } else {
                    log("Discord ChatBot", "Please, contact developer...", "err");
                    diagResult.devContact = true;
                    diagResult.settings = settings;
                    if(diagResult.settings.token) {
                        diagResult.settings.token = "Token hidden";
                    }
                    if(diagResult.settings.login) {
                        diagResult.settings.login = "Login hidden";
                    }
                    if(diagResult.settings.password) {
                        diagResult.settings.password = "Password hidden";
                    }
                }
            }
        }
    }
    
    diagResult.error = error;

    log("Discord ChatBot", "Diagnostic complete", "ok");
    log("Discord ChatBot", "Diagnostic information:", "info");
    log("Discord ChatBot", diagResult, "info");
    
    process.exit(-1);
}

var logMessage = (message) => {
    log("Discord", `New message from "${message.author.username}". Text: \n\t  ${message.content ? message.content.replaceAll("\n", " ⏎ ") : "No text"}.`, "info");
};

var restoreGrammar = (text) => {
    return new Promise(
        (resolve) => {
            if(!useGrammarNaziPower) {
                resolve(text);
            }
            log("Grammar nazi", `Checking text: ${text}`);
            yaspeller.checkText(text, (err, results) => {
                if(err) {
                    log("Grammar nazi", "Error", "err");
                    log("Grammar nazi", err);
                    return resolve(text);
                }
                log("Grammar nazi", "Result:", "ok");
                log("Grammar nazi", results, "ok");
                results.forEach((result) => {
                    if(!result.s[0]) {
                        return;
                    }
                    if(noReplace) {
                        if(noReplace instanceof Array) {
                            if(noReplace.indexOf(result.word.toLowerCase()) !== -1) {
                                log("Grammar nazi", `Skipped word "${result.word}" as it in "noReplace" option`, "info");
                                return;
                            }
                        }
                    }
                    text = text.replace(result.word, result.s[0]);
                });
                log("Grammar nazi", `Text ready - "${text}".`, "ok");
                resolve(text);
            });
        }
    );
};

var cleverbotReady = false,
    prepareCleverbot = () => {
        cleverbot = new Cleverbot;
        Cleverbot.prepare(() => {
            log("Cleverbot", "Connected", "ok");
            cleverbotReady = true;
        });
    },
    latestSentMessage = null,
    events = {
        "new_message": (text, channel) => {
            if(!cleverbotReady) {
                return;
            }
            var messageSent = false,
                intervalId = -1,
                updateTypingStatus = () => {
                    if(!messageSent) {
                        channel.sendTyping();
                    } else {
                        clearInterval(intervalId);
                    }
                };
            intervalId = setInterval(updateTypingStatus, 5000);
            
            channel.sendTyping();
            
            cleverbot.write(text, (response) => {
                response = parseReponse(response);
                
                // fuck it!
                if(response.indexOf(";&#") !== -1) {
                    log("Cleverbot", "Invalid response. Skipped!", "info");
                    return; // ?
                }
                
                restoreGrammar(response).then((fixed) => {
                    response = fixed;
                    setTimeout(() => {
                        channel.sendMessage(response).then(
                            (msg) => { 
                                logMessage(msg);
                                latestSentMessage = msg;
                                messageSent = true;
                            },
                            () => { 
                                log("Discord", "Failed to send message. Trying to send it with other methods...", "warn");
                                
                                /** Method one - trying to send new message again */
                                var methodOne = () => {
                                        return new Promise(
                                            (resolve, reject) => {
                                                setTimeout(() => {
                                                    channel.sendMessage(response).then(
                                                        (message) => {
                                                            latestSentMessage = message;
                                                            messageSent = true;
                                                            logMessage(message);
                                                            resolve();
                                                        },
                                                        () => {
                                                            reject();
                                                        }
                                                    );
                                                }, 5000);
                                            }
                                        );
                                    },
                                    /** Method two - trying to edit latest message */
                                    methodTwo = () => {
                                        return new Promise(
                                            (resolve, reject) => {
                                                if(latestSentMessage) {
                                                    latestSentMessage.edit(
                                                        `${latestSentMessage.content}\nCan't send new message, so I write it here:\n${response}`
                                                    ).then(
                                                        (editedMsg) => {
                                                            latestSentMessage = editedMsg;
                                                            messageSent = true;
                                                            resolve();
                                                        },
                                                        () => {
                                                            reject();
                                                        }
                                                    );
                                                }
                                            }
                                        );
                                    };
                                
                                methodOne().then(
                                    () => { log("Discord", "Method one works.", "ok"); },
                                    () => { 
                                        log("Discord", "Trying to send message. Method one failed, so we have method two.", "warn");
                                        
                                        methodTwo().then(
                                            () => { log("Discord", "Method two works.", "ok"); },
                                            () => { 
                                                log("Discord", "Trying to send message. Method two failed.", "err");
                                                log("Discord", "Can't send message at all.", "err");
                                                messageSent = true;
                                            }
                                        );
                                    }
                                );
                                
                            }
                        );
                    }, Math.round(Math.random() * (replyMax - replyMin)) + replyMin);
                });
                
            });
        },
        "connected" : () => { 
            log("Discord ChatBot", "Preparing Cleverbot...", "info");
            prepareCleverbot();
        }
    },
    attachBotEvents = () => {
        discordBot.Dispatcher.on("GATEWAY_READY", () => {
            log("Discord", "Connected", "ok");
            events.connected();
        });

        discordBot.Dispatcher.on("DISCONNECTED", (e) => {
            log("Discord", `Disconnected, error: ${e.error}`, "err");
            if(e.error === "No token specified" || e.error === "Login failed") {
                process.exit(-1);
            } else if(e.error.exception === 4004) {
                log("Discord", "4004, authentication failed: The account token sent with your identify payload is incorrect.", "err");
                process.exit(-1);
            }
        });

        discordBot.Dispatcher.on("MESSAGE_CREATE", (e) => {
            switch(e.message.content) {
            case null: case undefined:
                return;
            case "!reset": {
                if(settings.bindToChannels) {
                    if(settings.bindToChannels.indexOf(e.message.channel.id) !== -1) {
                        prepareCleverbot();
                    }
                } else {
                    prepareCleverbot();
                }
            } break;
            case "!reload_settings": {
                reloadSettings(
                    true, 
                    (errText) => {
                        e.message.channel.sendMessage(errText);
                    },
                    (okText) => {
                        e.message.channel.sendMessage(okText);
                    }
                );
            } break;
            default: {
                e = e.message;
                if(settings.replyOnlyTo) {
                    if(settings.replyOnlyTo.indexOf(e.author.id) === -1) {
                        return;
                    }
                }
                if(e.author.id === discordBot.User.id) {
                    return;
                }
                if(!e.content) {
                    return;
                }
                if(e.content.startsWith("! ") || e.content.startsWith("!!")) {
                    return;
                }
                if((settings.prefix !== undefined && settings.prefix !== null) && !e.content.startsWith(`${settings.prefix} `)) {
                    return;
                }
                if(settings.bindToChannels) {
                    if(settings.bindToChannels.indexOf(e.channel.id) !== -1) {
                        logMessage(e);
                        events.new_message(e.content, e.channel);
                    }
                } else {
                    logMessage(e);
                    events.new_message(e.content, e.channel);
                }
            } break;
            }
        });
    };

discordBot.connect(credentials);
attachBotEvents();