// 1. Audio Context Setup
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const mainAudioElement = document.getElementById('audio-player');
const mainUpload = document.getElementById('audio-upload');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');

// 2. Create the Master Effects Chain
const masterGain = audioContext.createGain(); // Everything merges here first
const bassNode = audioContext.createBiquadFilter();
const distortionNode = audioContext.createWaveShaper();
const filterNode = audioContext.createBiquadFilter();
const delayNode = audioContext.createDelay();
const feedbackNode = audioContext.createGain();
const dryWetMerge = audioContext.createGain();
const analyser = audioContext.createAnalyser();

// Configure Initial Effect Settings
bassNode.type = 'lowshelf';
bassNode.frequency.value = 150; // Focus on deep bass
bassNode.gain.value = 0;

distortionNode.curve = makeDistortionCurve(0);
distortionNode.oversample = '4x';

filterNode.type = 'lowpass';
filterNode.frequency.value = 20000;

delayNode.delayTime.value = 0.5;
feedbackNode.gain.value = 0;

analyser.fftSize = 256;

// Route the Master Chain
masterGain.connect(bassNode);
bassNode.connect(distortionNode);
distortionNode.connect(filterNode);

// Split path for Reverb
filterNode.connect(dryWetMerge); // Clean path
filterNode.connect(delayNode);   // Echo path
delayNode.connect(feedbackNode);
feedbackNode.connect(delayNode);
delayNode.connect(dryWetMerge);

dryWetMerge.connect(analyser);
analyser.connect(audioContext.destination);

// 3. Helper Function for Tape Crunch (Distortion Math)
function makeDistortionCurve(amount) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
        let x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
}

// 4. Main Track Setup
let mainSourceConnected = false;
mainUpload.addEventListener('change', function() {
    if (this.files.length === 0) return;
    mainAudioElement.src = URL.createObjectURL(this.files[0]);
    if (!mainSourceConnected) {
        const source = audioContext.createMediaElementSource(mainAudioElement);
        source.connect(masterGain);
        mainSourceConnected = true;
    }
});

playBtn.addEventListener('click', () => {
    if (audioContext.state === 'suspended') audioContext.resume();
    mainAudioElement.play();
    drawVisualizer();
});

pauseBtn.addEventListener('click', () => mainAudioElement.pause());

// 5. Loop Pad Setup
const pads = [1, 2, 3, 4];
pads.forEach(padNum => {
    const uploadInput = document.getElementById(`pad${padNum}-upload`);
    const padBtn = document.getElementById(`pad${padNum}-btn`);
    const padAudio = document.getElementById(`pad${padNum}-audio`);
    let isConnected = false;

    // Handle loop upload
    uploadInput.addEventListener('change', function() {
        if (this.files.length === 0) return;
        padAudio.src = URL.createObjectURL(this.files[0]);
        if (!isConnected) {
            const source = audioContext.createMediaElementSource(padAudio);
            source.connect(masterGain); // Send loop to the master effects
            isConnected = true;
        }
        padBtn.innerText = `Pad ${padNum} Ready`;
    });

    // Handle Pad Click (Play/Stop Toggle)
    padBtn.addEventListener('click', () => {
        if (audioContext.state === 'suspended') audioContext.resume();
        
        if (padAudio.paused) {
            padAudio.play();
            padBtn.classList.add('active');
            padBtn.innerText = `Stop Pad ${padNum}`;
            drawVisualizer(); // Make sure visualizer runs
        } else {
            padAudio.pause();
            padAudio.currentTime = 0; // Reset loop to start
            padBtn.classList.remove('active');
            padBtn.innerText = `Play Pad ${padNum}`;
        }
    });
});

// 6. Live Slider Controls
document.getElementById('speed-slider').addEventListener('input', (e) => {
    mainAudioElement.playbackRate = e.target.value;
    // Apply speed to all loops too!
    pads.forEach(num => document.getElementById(`pad${num}-audio`).playbackRate = e.target.value);
});

document.getElementById('filter-slider').addEventListener('input', (e) => filterNode.frequency.value = e.target.value);
document.getElementById('reverb-slider').addEventListener('input', (e) => feedbackNode.gain.value = e.target.value);
document.getElementById('bass-slider').addEventListener('input', (e) => bassNode.gain.value = e.target.value);
document.getElementById('crunch-slider').addEventListener('input', (e) => {
    distortionNode.curve = makeDistortionCurve(Number(e.target.value));
});

// 7. Visualizer
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    analyser.getByteFrequencyData(dataArray);
    
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
        let barHeight = dataArray[i] / 2;
        canvasCtx.fillStyle = '#ff66b2';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}
