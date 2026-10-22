let entities = [];
let mic, fft;
let bandPass;
let capture;
let opencvReady = false;
let resetBtn;
let dominantFreq = 0.0;

// interface sine wave icon
let amplitude = 12;
let phase = 0.0;

//world view
let cam;

// OpenCV working matrices
let src, hsv, mask, contours, hierarchy;
let videoCanvas, videoCtx;
let frameCounter = 0; // let open cv throttle very 2 frame to prevent lag.
let handKalman; //kalman filter

//sound sensitivity and initial harmonics
let mappedHarmonics = 1;
let noiseThreshold = 0.015; // Adjust this threshold based on microphone sensitivity

function onOpenCvReady() {
  console.log("OpenCV.js is ready!");
  opencvReady = true;
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  cam = createCamera();

  // Forvr WebGL to use standard sRGB color space
  
  let gl = canvas.elt.getContext('webgl2')|| canvas.elt.getContext('webgl');
  if(gl && gl.drawingBufferColorSpace){
    gl.drawingBufferColorSpace = 'srgb';
  }

  //frameRate(60);

  // Force enable right click to menu (so that orbitcontrol in draw does not block it)
  canvas.elt.addEventListener('contextmenu', (e) => {
    e.stopImmediatePropagation();
  }, true);

  // Reset Canvas button in DOM
  resetBtn = createButton('Reset Canvas');

  // Initialize Audio
  mic = new p5.AudioIn();
  mic.start();
  mic.disconnect(); // Disconnect raw mic from speakers

  // Create a BandPass filter centered at 392Hz (midpoint of C4 to C5 octave)
  bandPass = new p5.BandPass();
  bandPass.freq(392); 
  bandPass.res(3);    // Controls the width/sharpness of the octave window

  mic.connect(bandPass);
  bandPass.disconnect(); 

  // Initialize FFT and point it to the BandPass filtered signal
  fft = new p5.FFT();
  console.log("fft bucket size:", fft.bins);
  fft.setInput(bandPass);

  // Initialize Webcam for OpenCV processing
  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  // Create a standard HTML canvas element for OpenCV.js with an explicit ID
  videoCanvas = document.createElement('canvas');
  videoCanvas.id = 'opencvSourceCanvas';
  videoCanvas.width = 640;
  videoCanvas.height = 480;
  videoCanvas.style.display = 'none'; // Hide it from visual view
  document.body.appendChild(videoCanvas);
  videoCtx = videoCanvas.getContext('2d');

  // Start with a single entity at center
  handKalman = new KalmanFilter2D(1e-4, 5e-2);
  entities.push(new Entity(0, 0, 0));
}

//analysis audio, extract different frequency bands and map to harmonics
function audioanAnalysis(spectrum, micLevel) {
  let audioData = {
    bass: 0,
    mid: 0,
    treble: 0,
    harmonics: mappedHarmonics, 
    centroid: 261.63  // C4 default
  };

  if (micLevel > noiseThreshold && spectrum) {
    audioData.bass = fft.getEnergy("bass");
    audioData.mid = fft.getEnergy("mid");
    audioData.treble = fft.getEnergy("treble");

    // 1. Calculate frequency resolution per bin
    let nyquist = sampleRate() / 2;
    let binWidth = nyquist / spectrum.length;

    // 2. Map C4 (261.63 Hz) and C5 (523.25 Hz) to exact FFT array indices
    let minBin = floor(261.63 / binWidth);
    let maxBin = floor(523.25 / binWidth);

    // 3. Find the peak frequency with the highest amplitude strictly within this octave
    let maxAmp = -1;
    let peakBin = minBin;

    for (let i = minBin; i <= maxBin; i++) {
      if (spectrum[i] > maxAmp) {
        maxAmp = spectrum[i];
        peakBin = i;
      }
    }

    dominantFreq = peakBin * binWidth;

    // 4. Apply if a valid sound signal is detected above background noise
    if (maxAmp > 15) {
      audioData.centroid = constrain(dominantFreq, 261.63, 523.25);

      let norm = (audioData.centroid - 261.63) / (523.25 - 261.63);
      let curvedNorm = sqrt(norm); 
      audioData.harmonics = int(map(curvedNorm, 0, 1, 1, 12, true));

      console.log("Peak Pitch:", dominantFreq.toFixed(2), "Amp:", maxAmp.toFixed(1), "Harmonics:", audioData.harmonics);
    }
  }
  return audioData;
}

function draw() {
  background(15, 25);


  //reset button update with window size
  resetBtn.position(width*0.5, height*0.75);
  resetBtn.class('resetButton');
  
  // Reset button click handler resets entities back to single center state
  resetBtn.mousePressed(() => {
    entities = [new Entity(0, 0, 0)];
    cam.camera(0, 0, 800, 0, 0, 0, 0, 1, 0); 
  });

  if ( mouseIsPressed && mouseButton == LEFT)
  {
    orbitControl();
  }

  // 1. Audio Frequency Analysis -> Update Harmonics
  let spectrum = fft.analyze();
  let micLevel = mic.getLevel();

  let audio = audioanAnalysis(spectrum, micLevel);
  mappedHarmonics = audio.centroid; // Update global harmonics for entities

  // 2. OpenCV Hand Tracking & Gesture Processing
  frameCounter++;
  let runOpenCV = (frameCounter % 2 === 0);

  if (opencvReady && capture.loadedmetadata && runOpenCV) {
    try {
      // Draw the current video frame onto the p5 graphics canvas buffer
      videoCtx.drawImage(capture.elt, 0, 0, videoCanvas.width, videoCanvas.height);

      // pass the string ID of the canvas to cv.imread()
      src = cv.imread('opencvSourceCanvas');

      hsv = new cv.Mat();
      mask = new cv.Mat();
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();

      cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      // Define HSV color range for hand/glove tracking (adjust thresholds as needed)
      let lowThresh = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 20, 70, 0]);
      let highThresh = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [25, 255, 255, 255]);
      cv.inRange(hsv, lowThresh, highThresh, mask);

      // Find contours to locate hand center (Motion Follow)
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      if (contours.size() > 0) {
        let maxArea = 0;
        let maxContourIdx = 0;

        // Find the largest contour (representing the hand)
        for (let i = 0; i < contours.size(); ++i) {
          let cnt = contours.get(i);
          let area = cv.contourArea(cnt);
          if (area > maxArea) {
            maxArea = area;
            maxContourIdx = i;
          }
        }

        if (maxArea > 1500) {
          let handContour = contours.get(maxContourIdx);
          let moments = cv.moments(handContour);
          
          if (moments.m00 > 0) {
            let cx = moments.m10 / moments.m00;
            let cy = moments.m01 / moments.m00;

            let smoothedPos = handKalman.update(cx, cy);

            // Map OpenCV coordinates to WEBGL space
            let targetX = map(smoothedPos.x, 0, capture.width, width/2 , width/2);
            let targetY = map(smoothedPos.y, 0, capture.height, height/2, height/2);

            // Motion follow
            if (entities.length > 0) {
              let target = createVector(targetX, targetY, 0);
              let force = p5.Vector.sub(target, entities[0].pos);
              force.mult(0.1);
              entities[0].velocity.add(force);
            }

            // Radius zoom based on contour bounding box size
            let rect = cv.boundingRect(handContour);
            let handSize = max(rect.width, rect.height);
            let targetRadius = map(handSize, 50, 300, 50, 250, true);
            
            for (let entity of entities) {
              entity.radius = lerp(entity.radius, targetRadius, 0.2);
            }

            // Split gesture trigger: If hand area is extremely large/spread out
            if (maxArea > 25000 && entities.length === 1) {
              let parent = entities[0];
              let child1 = new Entity(parent.pos.x - 70, parent.pos.y, parent.pos.z);
              let child2 = new Entity(parent.pos.x + 70, parent.pos.y, parent.pos.z);
              entities = [child1, child2];
            }
          }
        }   
      }

      // Clean up OpenCV memory matrices to prevent memory leaks
      src.delete(); 
      hsv.delete(); 
      mask.delete(); 
      lowThresh.delete(); 
      highThresh.delete(); 
      contours.delete(); 
      hierarchy.delete();
      
    } catch (err) {
      console.error("OpenCV processing error:", err);
    }
  }
  // Update and render all active entities, passing both audio data and the live spectrum bins
  for (let entity of entities) {
    entity.update(audio, spectrum);
    entity.display();
  }
    console.log("audio", audio.centroid);

  //interface icon, sine wave
  push();   //isolate transformations so they don't break the rest of sketch
  
  stroke(152, 144, 144);
  strokeWeight(1.5);
  noFill();

  //translate(-width*0.075, height*0.2);
  translate(-width*0.05,height*0.2);

  beginShape();
  for (let x = 0; x < width*0.15; x++) {
    // Add phase to x to animate movement over time
    //let frequency = map(x, 0, width, 0, TWO_PI * 2);
    let frequency = audio.centroid;
    //let frequency = 0.6;
    let y = sin(x * frequency + phase) * amplitude;
    vertex(x, y);
    //console.log("frequency", frequency);
  }
  endShape();
  phase += 0.05; // Change this value to speed up or slow down the wave
  pop();
}

// Fallback keyboard trigger to reset or toggle split manually
function keyPressed() {
  if (key === 'r' || key === 'R') {
    entities = [new Entity(0, 0, 0)];
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}