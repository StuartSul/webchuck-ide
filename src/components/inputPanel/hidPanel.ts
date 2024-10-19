import { HID } from "webchuck";
import ButtonToggle from "@/components/toggle/buttonToggle";
import InputMonitor from "./inputMonitor";

// Constants
const MAX_ELEMENTS = 5;

// Document elements
const mouseButton =
    document.querySelector<HTMLButtonElement>("#mouseHIDButton")!;
const keyboardButton =
    document.querySelector<HTMLButtonElement>("#keyboardHIDButton")!;
const hidLog = document.querySelector<HTMLDivElement>("#hidLog")!;

export default class HidPanel {
    public static hidMonitor: InputMonitor;
    constructor(hid: HID) {
        new ButtonToggle(
            mouseButton,
            true,
            "Mouse: On",
            "Mouse: Off",
            () => {
                hid.enableMouse();
                document.addEventListener("mousedown", logMouseClick);
                document.addEventListener("mouseup", logMouseClick);
                document.addEventListener("mousemove", logMouseMoveEvent);
                document.addEventListener("wheel", logWheelEvent);
            },
            () => {
                hid.disableMouse();
                document.removeEventListener("mousedown", logMouseClick);
                document.removeEventListener("mouseup", logMouseClick);
                document.removeEventListener("mousemove", logMouseMoveEvent);
                document.removeEventListener("wheel", logWheelEvent);
            }
        );

        new ButtonToggle(
            keyboardButton,
            true,
            "Keyboard: On",
            "Keyboard: Off",
            () => {
                hid.enableKeyboard();
                document.addEventListener("keydown", logKeyEvent);
                document.addEventListener("keyup", logKeyEvent);
            },
            () => {
                hid.disableKeyboard;
                document.removeEventListener("keydown", logKeyEvent);
                document.removeEventListener("keyup", logKeyEvent);
            }
        );

        mouseButton.disabled = false;
        keyboardButton.disabled = false;

        // Setup Hid Log
        HidPanel.hidMonitor = new InputMonitor(hidLog, MAX_ELEMENTS);
        hidLog.style.opacity = "100";
    }
}

//-----------------------------------------------------------
// HELPERS FOR HID LOGGING
//-----------------------------------------------------------
function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function logKeyEvent(event: KeyboardEvent) {
    if (!event.repeat) {
        if (event.type === "keyup") {
            HidPanel.hidMonitor.logEvent(
                `keyup:   ${event.key} (${event.which})`
            );
        } else {
            HidPanel.hidMonitor.logEvent(
                `${event.type}: ${event.key} (${event.which})`
            );
        }
    }
}

function logMouseClick(event: MouseEvent) {
    if (event.type === "mouseup") {
        HidPanel.hidMonitor.logEvent(`mouseup:   button=${event.which}`);
    } else {
        HidPanel.hidMonitor.logEvent(`${event.type}: button=${event.which}`);
    }
}

function logMouseMoveEvent(event: MouseEvent) {
    HidPanel.hidMonitor.logEvent(
        `${event.type}: X=${(
            event.clientX / document.documentElement.clientWidth
        ).toFixed(3)}, Y=${(
            event.clientY / document.documentElement.clientHeight
        ).toFixed(3)}`
    );
}

function logWheelEvent(event: WheelEvent) {
    if (event.deltaX !== 0) {
        HidPanel.hidMonitor.logEvent(
            `${event.type}: deltaX=${clamp(event.deltaX, -1, 1)}`
        );
    }
    if (event.deltaY !== 0) {
        HidPanel.hidMonitor.logEvent(
            `${event.type}: deltaY=${clamp(event.deltaY, -1, 1)}`
        );
    }
}
