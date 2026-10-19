let entities = [];
let mic, fft;
let capture;
let opencvReady = false;


// OpenCV working matrices
let src, hsv, mask, contours, hierarchy;
let videoCanvas, videoCtx;

// Kalman filtered hand position
let handKalman;

//sound sensitivity and initial harmonics
let mappedHarmonics = 1 ;
let noiseThreshold = 0.035; // Adjust this threshold based on microphone sensitivity

function onOpenCvReady() {
  console.log("OpenCV.js is ready!");
  opencvReady = true;
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);

  // Initialize Audio
  mic = new p5.AudioIn();
  mic.start();
  fft = new p5.FFT();
  console.log("fft bucket size:", fft.bins);
  fft.setInput(mic);

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
    // Create a default state object that holds the previous values if quiet
  let audioData = {
    bass: 0,
    mid: 0,
    treble: 0,
    harmonics: mappedHarmonics // Holds last active value during silence/ambient noise
  };

  // Noise gate: Only process frequency data when active speech/sound is detected
  if (micLevel > noiseThreshold) {

    // Extract multi-band frequencies (values range from 0 to 255)
    audioData.bass = fft.getEnergy("bass");
    audioData.mid = fft.getEnergy("mid");
    audioData.treble = fft.getEnergy("treble");

    // Calculate spectral centroid for harmonics
    let centroid = fft.getCentroid();
    if (centroid) {
      centroid = constrain(centroid, 80, 6000); 

      //audioData.harmonics = int(map(centroid, 80, 6000, 1, 12, true));

      //logarithic mappinfg for a more balanced scaling in harmonics
      let norm = (centroid-80)/(6000-80);

      let curvedNorm = pow(norm, 0.75); // expands the lower / middle notes

      audioData.harmonics = int(map(curvedNorm, 0, 1, 1, 12, true));

      console.log("Raw Centroid:", centroid, "Mapped Harmonics:", audioData.harmonics);
    }
  }
  return audioData;
}

function draw() {
  background(15, 25);


  // 1. Audio Frequency Analysis -> Update Harmonics
  let spectrum = fft.analyze();
  let micLevel = mic.getLevel();

  let audio = audioanAnalysis(spectrum, micLevel);
  mappedHarmonics = audio.harmonics; // Update global harmonics for entities

  // 2. OpenCV Hand Tracking & Gesture Processing
  if (opencvReady && capture.loadedmetadata) {
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
            let targetX = map(smoothedPos.x, 0, capture.width, width / 2, -width / 2);
            let targetY = map(smoothedPos.y, 0, capture.height, -height / 2, height / 2);

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

  // Update and render all active entities
  for (let entity of entities) {
    entity.harmonics = max(1, mappedHarmonics);

    // Pass the raw energy levels into the entity
    entity.bass = audio.bass;
    entity.treble = audio.treble;

    entity.update();
    entity.display();
  }
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