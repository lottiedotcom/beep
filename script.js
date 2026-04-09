// 1. Setup the Audio Environment
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioElement = document.getElementById('audio-player');
const upload = document.getElementById('audio-upload');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');

// Visualizer setup
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
// Fix canvas resolution
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;

// Sliders
const speedSlider = document.getElementById('speed-slider');
const filterSlider = document.getElementById('filter-slider');
const reverbSlider = document.getElementById('reverb-slider');

// 2. Create the Audio Nodes (The Effect Pedals)
let source;
const filterNode = audioContext.createBiquadFilter();
const delayNode = audioContext.createDelay();
const feedbackNode = audioContext.createGain();
const dryWetMerge = audioContext.createGain();
const analyser = audioContext.createAnalyser();

// Configure initial node settings
filterNode.type = 'lowpass';
filterNode.frequency.value = 20000; // Start completely open (no muffling)
delayNode.delayTime.value = 0.5;    // Half-second echo
feedbackNode.gain.value = 0;        // Start with 0 reverb
analyser.fftSize = 256;             // Resolution of the visualizer

// 3. Handle File Uploads
upload.addEventListener('change', function() {
    const files = this.files;
    if (files.length === 0) return;
    
    // Turn the uploaded file into a URL the audio player can read
    const fileUrl = URL.createObjectURL(files[0]);
    audioElement.src = fileUrl;
    
    // Only wire up the nodes once
    if (!source) {
        source = audioContext.createMediaElementSource(audioElement);
        
        // Routing the cables: Source -> Filter -> [Split: Clean Audio & Reverb Audio] -> Analyser -> Speakers
        source.connect(filterNode);
        
        // Clean audio path
        filterNode.connect(dryWetMerge);
        
        // Reverb audio path
        filterNode.connect(delayNode);
        delayNode.connect(feedbackNode);
        feedbackNode.connect(delayNode); // Loops the echo
        delayNode.connect(dryWetMerge);
        
        // Send everything to the visualizer, then out to the speakers
        dryWetMerge.connect(analyser);
        analyser.connect(audioContext.destination);
    }
});

// 4. Playback Controls
playBtn.addEventListener('click', () => {
    // Browsers require audio contexts to be "resumed" after a user click
    if (audioContext.state === 'suspended') audioContext.resume();
    audioElement.play();
    drawVisualizer(); // Start the animation loop
});

pauseBtn.addEventListener('click', () => {
    audioElement.pause();
});

// 5. Live Slider Controls
speedSlider.addEventListener('input', (e) => {
    audioElement.playbackRate = e.target.value;
});

filterSlider.addEventListener('input', (e) => {
    filterNode.frequency.value = e.target.value;
});

reverbSlider.addEventListener('input', (e) => {
    feedbackNode.gain.value = e.target.value; 
});

// 6. The Visualizer Animation Loop
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function drawVisualizer() {
    // Only draw if the audio is playing
    if (!audioElement.paused) {
        requestAnimationFrame(drawVisualizer);
    }
    
    analyser.getByteFrequencyData(dataArray);
    
    // Clear the background (White)
    canvasCtx.fillStyle = '#ffffff';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;
    
    // Draw the bars (Pink)
    for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        canvasCtx.fillStyle = '#ff66b2';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}
