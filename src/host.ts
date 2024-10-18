//--------------------------------------------------------
// title: Host (Web Audio)
// desc:  Audio Host for WebChucK IDE, managing everything
//        related to Web Audio API
//
//        Creates the AudioContext and WebChucK Web Audio
//        Node instance (Chuck)
//
// author: terry feng
// date:   August 2023
//--------------------------------------------------------

import { Chuck, HID } from "webchuck";
import { calculateDisplayDigits } from "@utils/time";
import { ChuckNow } from "@/components/vmMonitor";
import { loadWebChugins } from "@/utils/webChugins";
import Console from "@/components/outputPanel/console";
import Visualizer from "@/components/outputPanel/visualizer";
import HidPanel from "@/components/inputPanel/hidPanel";
import ChuckBar from "@/components/chuckBar/chuckBar";
import ProjectSystem from "@/components/fileExplorer/projectSystem";
import Recorder from "@/components/chuckBar/recorder";
import NavBar from "./components/navbar/navbar";

// WebChucK source
const DEV_CHUCK_SRC = "https://chuck.stanford.edu/webchuck/dev/"; // dev webchuck src
const PROD_CHUCK_SRC = "https://chuck.stanford.edu/webchuck/src/"; // prod webchuck src
let whereIsChuck: string =
    localStorage.getItem("chuckVersion") === "dev"
        ? DEV_CHUCK_SRC
        : PROD_CHUCK_SRC;

let theChuck: Chuck;
let chuckVersion: string = "1.5.X.X";
let audioContext: AudioContext;
let sampleRate: number = 0;

// Audio Visualizer
let analyser: AnalyserNode;
let visual: Visualizer;

// Recorder
let recordGain: GainNode;

// HID
let hid: HID;

export { theChuck, chuckVersion, audioContext, sampleRate, visual, hid };

// Chuck Time
let chuckNowCached: number = 0;

export async function selectChuckSrc(production: boolean) {
    // TODO: this doesn't really do much now
    whereIsChuck = production ? PROD_CHUCK_SRC : DEV_CHUCK_SRC;
}

/**
 * Initialize theChuck and audio context on page load
 * Audio Context will be suspended until the user presses "Start WebChucK"
 */
export async function initChuck() {
    audioContext = new AudioContext();
    audioContext.suspend();
    sampleRate = audioContext.sampleRate;
    calculateDisplayDigits(sampleRate);

    // TODO: Hack for WebChugins 7/16/2024
    const chugins: string[] = loadWebChugins();
    chugins.forEach((chuginPath) => Chuck.loadChugin(chuginPath));

    // Create theChuck
    theChuck = await Chuck.init(
        [],
        audioContext,
        audioContext.destination.maxChannelCount,
        whereIsChuck
    );
    theChuck.connect(audioContext.destination);
    Console.print("WebChucK is ready!");

    onChuckReady();
}

/**
 * Called when theChuck is ready
 */
export async function onChuckReady() {
    ChuckBar.webchuckButton.disabled = false;
    ChuckBar.webchuckButton.innerText = "Start WebChucK";
    ProjectSystem.uploadFilesButton.disabled = false;
    ProjectSystem.initDragUpload();
    theChuck.getParamString("VERSION").then((value: string) => {
        chuckVersion = value;
    });
    NavBar.aboutButton.disabled = false;
}

/**
 * Start theChuck (when user presses "Start WebChucK")
 * Audio context will resume
 * Build theChuck connections for VM time, HID, and visualizer
 */
export async function startChuck() {
    audioContext.resume();

    // Hook up theChuck to the console
    theChuck.chuckPrint = Console.print;
    theChuck.setParamInt("TTY_COLOR", 1);
    theChuck.setParamInt("TTY_WIDTH_HINT", Console.getWidth());
    Console.print("starting virtual machine...");

    // Print audio info
    theChuck.getParamInt("SAMPLE_RATE").then((value: number) => {
        Console.print("sample rate: " + value);
    });
    theChuck.getParamString("VERSION").then((value: string) => {
        chuckVersion = value;
        Console.print("chuck version: " + value);
    });
    Console.print(
        "number of channels: " + audioContext.destination.maxChannelCount
    );

    setInterval(updateChuckNow, 50);

    // Start audio visualizer
    startVisualizer();

    // Configure Recorder
    recordGain = audioContext.createGain();
    recordGain.gain.value = 0.98; // Prevents weird clipping artifacts
    theChuck.connect(recordGain);
    Recorder.configureRecorder(audioContext, recordGain);

    // Start HID, mouse and keyboard on
    hid = await HID.init(theChuck);
    new HidPanel(hid);

    // TODO: for debugging, make theChuck global
    (window as any).theChuck = theChuck;

    // TODO: EZScore HACKS @terryfeng @alexhan
    try {
        await theChuck
            .loadFile(
                "https://raw.githubusercontent.com/tae1han/ChucKTonal/main/src/ezchord.ck"
            )
            .then(() => {
                theChuck.runFile("ezchord.ck");
            });
        await theChuck
            .loadFile(
                "https://raw.githubusercontent.com/tae1han/ChucKTonal/main/src/ezscore.ck"
            )
            .then(() => {
                theChuck.runFile("ezscore.ck");
            });
        await theChuck
            .loadFile(
                "https://raw.githubusercontent.com/tae1han/ChucKTonal/main/src/ezscale.ck"
            )
            .then(() => {
                theChuck.runFile("ezscale.ck");
            });
        await theChuck
            .loadFile(
                "https://raw.githubusercontent.com/tae1han/ChucKTonal/main/src/scoreplayer.ck"
            )
            .then(() => {
                theChuck.runFile("scoreplayer.ck");
            });
    } catch (error) {
        console.error("Failed to load EZScore", error);
    }
}

/**
 * Get the current time from theChuck
 * Cache the value to TS
 */
function updateChuckNow() {
    theChuck.now().then((samples: number) => {
        chuckNowCached = samples;
        // Update time in visualizer
        ChuckNow.updateChuckNow(samples);
    });
}

/**
 * Return the current saved time in samples
 */
export function getChuckNow(): number {
    return chuckNowCached;
}

/**
 * Connect microphone input to theChuck
 */
export async function connectMic() {
    // Get microphone with no constraints
    navigator.mediaDevices
        .getUserMedia({
            video: false,
            audio: {
                echoCancellation: false,
                autoGainControl: false,
                noiseSuppression: false,
            },
        })
        .then((stream) => {
            const adc = audioContext.createMediaStreamSource(stream);
            adc.connect(theChuck);
        });
}

/**
 * Start the audio visualizer for time/frequency domain
 */
function startVisualizer() {
    const cnv: HTMLCanvasElement = document.getElementById(
        "visualizer"
    )! as HTMLCanvasElement;

    analyser = audioContext.createAnalyser();
    // instantiate visualizer
    visual = new Visualizer(cnv, analyser);
    // connect chuck output to analyser
    theChuck.connect(analyser);
    // start visualizer
    visual.drawVisualization_();
    visual.start();
}
