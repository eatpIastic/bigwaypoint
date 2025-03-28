/// <reference types="../CTAutocomplete" />

import Skyblock from "../BloomCore/Skyblock";
import { getDistanceToCoord } from "../BloomCore/utils/Utils";
import { Render3D } from "../tska/rendering/Render3D";
import PogObject from "../PogData";

const Toolkit = Java.type("java.awt.Toolkit");
const DataFlavor = Java.type("java.awt.datatransfer.DataFlavor");

const data = new PogObject("bigwaypoint", {}, "waypoints.json");
const tempSettings = new PogObject("bigwaypoint", {
    r: 79,
    g: 165,
    b: 222,
    a: 127
}, "temp.json");
const toggleKey = new KeyBind("toggle waypoint edit mode", Keyboard.KEY_NONE, "big");
const guiKey = new KeyBind("open edit gui", Keyboard.KEY_NONE, "big");
const bigGUI = new Gui();

const renderStr = "bigwaypoint editing";
let renderStrWidth;
let renderX;
let renderY;

let editMode;
let currentWorldWaypoints;


register("worldLoad", () => {
    if (editMode) swapEditMode();
    currentWorldWaypoints = null;
    waypointSearch.register();
    waypointRender.unregister();
});


const waypointSearch = register("step", () => {
    if (Skyblock.area == null) return;

    if (!data?.[Skyblock.area] || Object.keys(data[Skyblock.area]).length === 0) {
        data[Skyblock.area] = {};
        waypointSearch.unregister();
    }

    let tempWaypoints = [];
    let waypointNames = Object.keys(data[Skyblock.area]);
    for (let i = 0; i < waypointNames.length; i++) {
        let waypointData = data[Skyblock.area][waypointNames[i]];
        let [x, y, z] = waypointNames[i].split(",").map(i => parseInt(i));

        tempWaypoints.push(new BigWaypoint(x, y, z, waypointData));
    }
    currentWorldWaypoints = tempWaypoints;
    waypointSearch.unregister();
    waypointRender.register();
}).setFps(2).unregister();


register("tick", () => {
    if (!Skyblock.inSkyblock) {
        if (editMode) {
            swapEditMode();
        }
        return;
    }


    if (toggleKey.isPressed()) swapEditMode();
    if (guiKey.isPressed()) doBigGuiOpen();

    if (currentWorldWaypoints) {
        currentWorldWaypoints.forEach(w => w.checkDist());
    }
});


const swapEditMode = () => {
    editMode = !editMode;
    if (editMode) {
        if (!data?.[Skyblock.area]) data[Skyblock.area] = {};
        
        renderStrWidth = Renderer.getStringWidth(renderStr);
        renderX = (Renderer.screen.getWidth() / 2) - (renderStrWidth / 2);
        renderY = Renderer.screen.getHeight() * 0.55;
        editModeDisplay.register();
        editModeInput.register();
        setBlockInfo.register();
    } else {
        editModeDisplay.unregister();
        editModeInput.unregister();
        setBlockInfo.unregister();
    }
}

register("playerInteract", (action, pos, event) => {
    if(action.toString() !== "RIGHT_CLICK_BLOCK" || !Skyblock.inSkyblock || !Skyblock.area || !currentWorldWaypoints) return;

    let [x, y, z] = [pos.getX(), pos.getY(), pos.getZ()];

    currentWorldWaypoints.some(w => w.commandClickCheck(x, y, z));
});


const editModeInput = register("playerInteract", (action, pos, event) => {
    if(action.toString() !== "RIGHT_CLICK_BLOCK") return;

    let [x, y, z] = [pos.getX(), pos.getY(), pos.getZ()];
    let str = `${x},${y},${z}`;

    if (data[Skyblock.area]?.[str]) {
        delete data[Skyblock.area][str];
        waypointSearch.register();
    } else if (!data[Skyblock.area]?.[str]) {
        data[Skyblock.area][str] = { ...tempSettings };
        waypointSearch.register();
    }

    data.save();
}).unregister();


const editModeDisplay = register("renderOverlay", () => {
    if (bigGUI.isOpen()) return;
    Tessellator.pushMatrix();
    Renderer.drawString(renderStr, renderX, renderY);
    Tessellator.popMatrix();
}).unregister();


const waypointRender = register("renderWorld", () => {
    currentWorldWaypoints.forEach(waypoint => {
        waypoint.draw();
    });
}).unregister();

const setBlockInfo = register("hitBlock", (block, event) => {
    let [x, y, z] = [block.getX(), block.getY(), block.getZ()];
    let locStr = `${x},${y},${z}`;
    if (!data[Skyblock.area]?.[locStr]) {
        return;
    }

    data[Skyblock.area][locStr] = { ...tempSettings };
    data.save();
    waypointSearch.register();
}).unregister();


register("command", (...args) => {
    if (args?.[0] == "reset") {
        data[Skyblock.area] = {};
        data.save();
        waypointSearch.register();
    } else {
        doBigGuiOpen();
    }
}).setTabCompletions(["reset"]).setName("bigwp");


const doBigGuiOpen = () => {
    bigGUI.open();
    guiInfo = {
        w: Renderer.screen.getWidth(),
        h: Renderer.screen.getHeight(),
        gray: Renderer.color(0, 0, 0, 127),
        lightGray: Renderer.color(184, 184, 184, 127),
        buttonBackground: Renderer.color(133, 39, 37, 255),
        toggledButtonColor: Renderer.color(56, 255, 103, 255),
        command: tempSettings?.command ?? "none"
    };
    createCheckboxes();
    createSliders();
    createTextbars();
    createButtons();
}

let guiInfo;

bigGUI.registerClosed( () => {
    guiInfo.textbars.forEach(t => tempSettings[t.name] = t.val);
    guiInfo = undefined;
    tempSettings.save();
});


bigGUI.registerDraw( (mx, my, partialTicks) => {
    drawBigGUI();
});


const drawBigGUI = () => {
    if (!guiInfo) return;

    Tessellator.pushMatrix();
    // Renderer.drawRect(guiInfo.gray, guiInfo.w * .2, guiInfo.h * .15, guiInfo.w * .6, guiInfo.h * .55);
    Renderer.drawRect(guiInfo.gray, guiInfo.w * .2, guiInfo.h * .15, guiInfo.w * .6, guiInfo.h * .7);
    Tessellator.popMatrix();

    guiInfo.checkboxes.forEach(b => b.draw());
    guiInfo.sliders.forEach(s => s.draw());
    guiInfo.textbars.forEach(t => t.draw());
    guiInfo.buttons.forEach(b => b.draw());
    colorDraw();
}

const colorDraw = () => {
    Tessellator.pushMatrix();
    Renderer.drawRect(
        Renderer.color(
            tempSettings.r, 
            tempSettings.g, 
            tempSettings.b, 
            tempSettings.a
        ), 
        guiInfo.w * .65,
        (guiInfo.h * .15) + 5,
        guiInfo.h * .2,
        guiInfo.h * .2);
    Tessellator.popMatrix();
}

bigGUI.registerClicked( (mx, my, button) => {
        let clickDone = false;
    clickDone = guiInfo.checkboxes.some(b => b.checkClicked(mx, my));
    if (clickDone) return;
    clickDone = guiInfo.sliders.some(s => s.checkDragged(mx, my));
    if (clickDone) return;
    clickDone = guiInfo.buttons.some(b => b.checkClicked(mx, my));
    if (clickDone) return;
    guiInfo.textbars.some(t => t.checkClicked(mx, my)); // dont check this one
});

const createCheckboxes = () => {
    let w = (Renderer.screen.getWidth() * .2) + 5;
    let h = (Renderer.screen.getHeight() * .15) + 5;
    let locations = [];
    let settingTypes = ["depth", "fill", "do cmd", "show cmd", "shadow", "txt bg"];

    for (let i = 0; i < settingTypes.length; i++) {
        locations.push(new BigCheckbox(w, h + (25 * i), settingTypes[i]));
    }

    guiInfo.checkboxes = locations;
}

const createSliders = () => {
    let w = (Renderer.screen.getWidth() * .4) + 5;
    let h = (Renderer.screen.getHeight() * .15) + 5;
    let locations = [];
    let settingTypes = ["r", "g", "b", "a"];

    for (let i = 0; i < settingTypes.length; i++) {
        locations.push(new BigSlider(w, h + (25 * i), settingTypes[i], 0, 255, tempSettings?.[settingTypes[i]] ?? 127));
    }

    
    locations.push(new BigSlider(w, h + (25 * (settingTypes.length + 0.5)), "scale", 0.01, 0.1, tempSettings?.["scale"] ?? 0.02));
    locations.push(new BigSlider(w, h + (25 * (settingTypes.length + 1.5)), "dist", 3, 300, tempSettings?.["dist"] ?? 30));

    guiInfo.sliders = locations;
}

const createTextbars = () => {
    let w = (Renderer.screen.getWidth() * .2) + 5;
    let h = (Renderer.screen.getHeight() * .75);
    let locations = [];
    let settingTypes = ["command"];

    for (let i = 0; i < settingTypes.length; i++) {
        locations.push(new BigTextbar(w, h + (20 * i), settingTypes[i], tempSettings?.[settingTypes[i]] ?? false));
    }

    guiInfo.textbars = locations;
}

const createButtons = () => {
    let w = Renderer.screen.getWidth() * .6;
    let h = (Renderer.screen.getHeight() * .45);
    let locations = [];
    let settingTypes = ["reset temp settings", "clear current world", "export to clipboard", "import from clipboard"];
    let settingFunctions = [BigButton.resetTempSettings, BigButton.clearCurrentWorld, BigButton.exportToClipboard, BigButton.importFromClipboard];
    
    for (let i = 0; i < settingTypes.length; i++) {
        locations.push(new BigButton(w, h + (20 * i), settingTypes[i], settingFunctions[i]));
    }

    guiInfo.buttons = locations;
}


bigGUI.registerMouseDragged( (mx, my, clickedMouseButton, timeSinceLastClick) => {
    guiInfo.sliders.forEach(s => s.checkDragged(mx, my));
})


bigGUI.registerKeyTyped( (typed, key) => {
    if (key == 1) return;
    guiInfo.textbars.forEach(t => t.doInput(typed, key));
});


class BigTextbar {
    constructor(x, y, name, val) {
        this.x = x;
        this.y = y;
        this.w = 120;
        this.h = 15;
        this.name = name;
        this.val = val || "command";
        this.takingInput = false;
        this.strW = Renderer.getStringWidth(this.val);
        this.lastPress = 0;
        this.displayI = 0;
    }

    checkClicked(mx, my) {
        if (mx >= this.x && (mx <= this.x + this.w || mx <= this.x + this.strW) && my >= this.y && my <= this.y + this.h) {
            this.takingInput = true;
            return true;
        } else if (this.takingInput) {
            tempSettings[this.name] = this.val;
            tempSettings.save();
        }
        this.takingInput = false;
    }

    doInput(char, keyCode) {
        if (!this.takingInput) return;
        // if (keyCode == 29 || keyCode == 15 || keyCode == 42) return;
        if (keyCode == 29 || keyCode == 56 || keyCode == 219 || keyCode == 58 || keyCode == 15
            || keyCode == 157 || keyCode == 220
        ) return;
        if (keyCode === 28 || keyCode === 1) {
            tempSettings[this.name] = this.val;
        } else if (keyCode === 14) {
            this.val = this.val.substring(0, this.val.length - 1);
        // } else if (keyCode == 57 || keyCode == 53 || keyCode <= 50) {
        } else {
            this.val += char;
        }
        this.lastPress = Date.now();
        this.strW = Renderer.getStringWidth(this.val);
    }

    draw() {
        this.displayI++;
        if (this.strW > this.w - 5) {
            Tessellator.pushMatrix();
            Renderer.drawRect(guiInfo.lightGray, this.x, this.y - 2, this.strW + 5, this.h);
            Tessellator.popMatrix();
        } else {
            Tessellator.pushMatrix();
            Renderer.drawRect(guiInfo.lightGray, this.x, this.y - 2, this.w, this.h);
            Tessellator.popMatrix();
        }
        Tessellator.pushMatrix();
        Renderer.drawString(`${this.val}${this.takingInput && this.displayI % 90 <= 45 ? "_" : ""}`, this.x, this.y + 1, true);
        Tessellator.popMatrix();
    }
}


class BigSlider {
    constructor(x, y, name, minVal, maxVal, val) {
        this.x = x;
        this.y = y;
        this.w = 75;
        this.h = 15;
        this.name = name;
        this.minVal = minVal;
        this.maxVal = maxVal;
        this.val = val;
        this.valStr = this.val < 1 ? (this.val).toFixed(2) : this.val;
        this.strW = Renderer.getStringWidth(name);
    }

    checkDragged(mx, my) {
        if (mx >= this.x && mx <= this.x + this.w && my >= this.y && my <= this.y + this.h) {
            let dragProg = (mx - this.x) / this.w;
            dragProg = Math.max(0, Math.min(1, dragProg));
    
            this.val = this.minVal + (this.maxVal - this.minVal) * dragProg;
            
            if (this.val < this.minVal) this.val = this.minVal;
            if (this.val > this.maxVal) this.val = this.maxVal;

            this.val = this.val < 1 ? this.val : Math.round(this.val);
            this.valStr = this.val < 1 ? (this.val).toFixed(2) : this.val;
            tempSettings[this.name] = this.val;
            return true;
        }
        return false;
    }

    draw() {
        Tessellator.pushMatrix();
        Renderer.drawRect(guiInfo.lightGray, this.x, this.y - 1, this.w + 2.5, this.h);

        const normalizedPos = (this.val - this.minVal) / (this.maxVal - this.minVal);
        
        Renderer.drawRect(Renderer.WHITE, this.x + (this.w * normalizedPos) - 2.5, this.y - 1, 5, this.h);
        Renderer.drawString(`${this.name}`, this.x - 3 - this.strW, this.y);
        Renderer.drawString(`${this.valStr}`, this.x + (this.w * 0.25), this.y + (this.h * 0.25), true);
        Tessellator.popMatrix();
    }
}



class BigCheckbox {
    constructor(x, y, name) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.toggled = tempSettings?.[name];
    }

    checkClicked(mx, my) {
        if (mx >= this.x && mx <= this.x + 20 && my >= this.y && my <= this.y + 20) {
            this.toggled = !this.toggled;
            tempSettings[this.name] = this.toggled;
            return true;
        }
        return false;
    }

    draw() {
        Tessellator.pushMatrix();
        Renderer.drawRect(guiInfo.lightGray, this.x - 1, this.y - 1, 75, 22);
        Renderer.drawRect(this.toggled ? guiInfo.toggledButtonColor : guiInfo.buttonBackground, this.x, this.y, 20, 20);
        Renderer.drawString(this.name, this.x + 22, this.y + 6);
        Tessellator.popMatrix();
    }
}


class BigWaypoint {
    constructor(x, y, z, data) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.block = World.getBlockAt(x, y, z);
        this.doCmd = data?.["do cmd"] || data?.["do command"];
        this.command = data?.["command"];
        this.fill = data?.fill;
        
        this.str = data?.str;

        this.r = data?.r ?? 255;
        this.g = data?.g ?? 0;
        this.b = data?.b ?? 0;
        this.a = data?.a ?? 127;
        this.depth = data?.depth ?? false;
        
        this.dist = data?.["dist"] ?? 30;
        
        this.showStr = data?.["show cmd"];
        this.scale = data?.["scale"] ?? .02;
        this.withinRange = this.showStr && getDistanceToCoord(this.x, this.y, this.z) < this.dist;
        this.shadow = data?.["shadow"];
        this.background = data?.["txt bg"];
    }

    checkDist() {
        this.withinRange = this.showStr && getDistanceToCoord(this.x, this.y, this.z) < this.dist;
    }

    commandClickCheck(cx, cy, cz) {
        if (editMode || !this.doCmd || !this.command || this.command == "") return false;
        if (this.x == cx && this.y == cy && this.z == cz) {
            ChatLib.command(`${this.command}`);
            return true;
        }
        return false;
    }

    draw() {
        if (!this.fill) {
            Tessellator.pushMatrix();
            Render3D.outlineBlock(
                this.block,
                this.r, this.g, this.b, this.a, this.depth
            );
            Tessellator.popMatrix();
        } else if (this.fill) {
            Tessellator.pushMatrix();
            Render3D.filledBlock(
                this.block,
                this.r, this.g, this.b, this.a, this.depth
            );
            Tessellator.popMatrix();
        }

        if (this.showStr && this.withinRange) {
            Tessellator.pushMatrix();
            Render3D.renderString(this.command, this.x + .5, this.y + .75, this.z + .5,
                [0, 0, 0, 180], this.background, this.scale, false, this.shadow
            );
            Tessellator.popMatrix();
        }
    }
}


class BigButton {
    constructor(x, y, name, action) {
        this.x = x;
        this.y = y;
        this.w = 30
        this.h = 15;
        this.name = name;
        this.action = action;
        this.strW = Renderer.getStringWidth(this.name);
    }

    checkClicked(mx, my) {
        if (mx >= this.x && mx <= this.x + this.strW + 3 && my >= this.y && my <= this.y + this.h) {
            this.action();
            return true;
        }
        return false;
    }

    draw() {
        Tessellator.pushMatrix();
        Renderer.drawRect(Renderer.DARK_GRAY, this.x, this.y, this.strW + 3, this.h);
        Renderer.drawString(`${this.name}`, this.x + 1.5, this.y + 3);
        Tessellator.popMatrix();
    }

    static resetTempSettings() {
        let keys = Object.keys(tempSettings);
        for (let i = 0; i < keys.length; i++) {
            delete tempSettings[keys[i]];
        }
        tempSettings.r = 79;
        tempSettings.g = 165;
        tempSettings.b = 222;
        tempSettings.a = 127;
        doBigGuiOpen();
        tempSettings.save();
    }

    static clearCurrentWorld() {
        delete data[Skyblock.area];
        data.save();
        waypointSearch.register();
    }

    static exportToClipboard() {
        ChatLib.command(`ct copy ${JSON.stringify(data)}`, true);
    }

    static importFromClipboard() {
        let bigJSON;
        try {
            let clipboard = Toolkit.getDefaultToolkit().getSystemClipboard().getData(DataFlavor.stringFlavor);
            bigJSON = JSON.parse(clipboard);
        } catch(e) {
            ChatLib.chat(`error parsing clipboard json`);
            return;
        }

        if (!bigJSON) return;

        let bigKeys = Object.keys(bigJSON);
        if (!bigKeys) return;
        for (let i = 0; i < bigKeys.length; i++) {
            if (data?.[bigKeys[i]]) {
                data[bigKeys[i]] = BigButton.combine(data[bigKeys[i]], bigJSON[bigKeys[i]]);
            } else {
                data[bigKeys[i]] = bigJSON[bigKeys[i]];
            }
        }
        data.save();
        waypointSearch.register();
    }

    static combine = (obj1, obj2) => {
        if (typeof obj1 !== "object" || typeof obj2 !== "object") return;
        const result = { ...obj1 };

        Object.keys(obj2).forEach(key => {
            result[key] = obj2[key];
        });
        
        return result;
    }
}

