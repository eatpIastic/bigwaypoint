/// <reference types="../CTAutocomplete" />

import Skyblock from "../BloomCore/Skyblock";
import { registerWhen } from "../BloomCore/utils/Utils";
import { Render3D } from "../tska/rendering/Render3D";
import PogObject from "../PogData";

const data = new PogObject("bigwaypoint", {}, "waypoints.json");
const tempSettings = new PogObject("bigwaypoint", {}, "tempsettings.json");
const toggleKey = new KeyBind("toggle waypoint edit mode", Keyboard.KEY_NONE, "big");
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
        let tempWaypointData = { ...waypointData };
        let [x, y, z] = waypointNames[i].split(",").map(i => parseInt(i));

        tempWaypointData.block = World.getBlockAt(x, y, z);
        tempWaypointData.x = x;
        tempWaypointData.y = y;
        tempWaypointData.z = z;

        if (waypointData?.command) {
            tempWaypointData.command = waypointData.command;
        }

        tempWaypoints.push(tempWaypointData);
    }
    currentWorldWaypoints = tempWaypoints;
    waypointSearch.unregister();
    waypointRender.register();
}).setFps(1).unregister();


register("tick", () => {
    if (!toggleKey.isPressed()) return;

    swapEditMode();
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


const editModeInput = register("playerInteract", (action, pos, event) => {
    console.log(action.toString())
    if(action.toString() !== "RIGHT_CLICK_BLOCK") return;

    let [x, y, z] = [pos.getX(), pos.getY(), pos.getZ()];
    let str = `${x},${y},${z}`;

    if (!Player.isSneaking() && data[Skyblock.area]?.[str]) {
        delete data[Skyblock.area][str];
        waypointSearch.register();
    } else if (!data[Skyblock.area]?.[str]) {
        data[Skyblock.area][str] = {};
        waypointSearch.register();
    } else if (Player.isSneaking() && data[Skyblock.area]?.[str]) {
        // command setup
    }
    data.save();
}).unregister();


const editModeDisplay = register("renderOverlay", () => {
    Renderer.drawString(renderStr, renderX, renderY);
}).unregister();


const waypointRender = register("renderWorld", () => {
    currentWorldWaypoints.forEach(waypoint => {
        Render3D.outlineBlock(
            waypoint.block,
            waypoint?.r ?? 255, waypoint?.g ?? 0, waypoint?.b ?? 0, waypoint?.a ?? 255, waypoint?.depth ?? true    
        )

        if (waypoint?.fill) {
            Render3D.filledBlock(
                waypoint.block,
                waypoint?.r ?? 255, waypoint?.g ?? 0, waypoint?.b ?? 0, waypoint?.a ?? 255, waypoint?.depth ?? true    
            );
        }

        if (waypoint?.str) {

        }
    });
}).unregister();


const setBlockInfo = register("hitBlock", (block, event) => {
    let [x, y, z] = [block.getX(), block.getY(), block.getZ()];
    let locStr = `${x},${y},${z}`;
    if (!data[Skyblock.area]?.[locStr]) {
        return;
    }

    data[Skyblock.area][locStr] = tempSettings;
    data.save();
    waypointSearch.register();
}).unregister();


register("command", () => {
    bigGUI.open();
    guiInfo = {
        w: Renderer.screen.getWidth(),
        h: Renderer.screen.getHeight(),
        gray: Renderer.color(0, 0, 0, 127),
        lightGray: Renderer.color(184, 184, 184, 127),
        buttonBackground: Renderer.color(133, 39, 37, 255),
        toggledButtonColor: Renderer.color(56, 255, 103, 255),
        command: tempSettings?.command ?? "none",
        r: tempSettings?.r ?? 255,
        g: tempSettings?.g ?? 0,
        b: tempSettings?.b ?? 0,
        buttons: createButtons()
    };
    clickDetection.register();
}).setName("bigwp");

let guiInfo;

bigGUI.registerOpened( () => bigGuiDisplay.register());
bigGUI.registerClosed( () => {
    bigGuiDisplay.unregister();
    clickDetection.unregister();
    guiInfo = undefined;
    tempSettings.save();
});

const bigGuiDisplay = register("renderOverlay", () => {
    drawBigGUI();
}).unregister();


const drawBigGUI = () => {
    if (!guiInfo) return;
    Renderer.drawRect(guiInfo.gray, guiInfo.w * .2, guiInfo.h * .15, guiInfo.w * .6, guiInfo.h * .55);

    guiInfo.buttons.forEach(b => b.draw());
    
    // for (let i = 0; i < guiInfo.buttonLocations.length; i++) {
        // let theButton = guiInfo.buttonLocations[i];
        // drawCheckbox( (theButton.x * .2) + 5, (guiInfo.h * .15), + 5 + (25 * i), tempSettings?.)
    // }
    // drawCheckbox((guiInfo.w * .2) + 10, (guiInfo.h * .15) + 5);
}

const clickDetection = register("clicked", (mx, my, button, isDown) => {
    if (!isDown) return;
    guiInfo.buttons.forEach(b => b.checkClicked(mx, my));
}).unregister();

const createButtons = () => {
    let w = (Renderer.screen.getWidth() * .2) + 5;
    let h = (Renderer.screen.getHeight() * .15) + 5;
    let locations = [];
    let settingTypes = ["depth", "fill"];

    for (let i = 0; i < settingTypes.length; i++) {
        locations.push(new BigButton(w, h + (25 * i), settingTypes[i]));
    }

    return locations;
}


class BigButton {
    constructor(x, y, name) {
        this.x = x;
        this.y = y;
        this.name = name;
        this.toggled = tempSettings?.[name];
    }

    checkClicked(mx, my) {
        if(mx >= this.x && mx <= this.x + 20 && my >= this.y && my <= this.y + 20 && Date.now()) {
            this.toggled = !this.toggled;
            tempSettings[this.name] = this.toggled;
        }
    }

    draw() {
        Renderer.drawRect(guiInfo.lightGray, this.x - 1, this.y - 1, 75, 22);
        Renderer.drawRect(this.toggled ? guiInfo.toggledButtonColor : guiInfo.buttonBackground, this.x, this.y, 20, 20);
        Renderer.drawString(this.name, this.x + 22, this.y + 6);
    }
}