// Upload an image to group its pixels into k representative RGB colors with
// OpenCV K-means, then display a simplified, color-segmented version.

// Group captured video in pixels into k representative RGB colors with OpenCV K-means

let cvReady = false;
let k = 3; // Number of color clusters; '+' and '-' change this value.

let video;
let cap;
let src, rgb, samples32f, labels, centers, clustered, dst;
let isStreaming = false;
let p5Canvas;

//composition
let focalPoints = [];
let voronoiSubdiv;

function setup() {
  // Store canvas element reference
  let cnv = createCanvas(1080, 720);
  p5Canvas = cnv.elt; // Get raw HTML canvas DOM element
  pixelDensity(1);
}

function startCamera() {
  video = document.getElementById('videoInput');

  navigator.mediaDevices.getUserMedia({ video: { width: 1080, height: 720 }, audio: false })
    .then((stream) => {
      video.srcObject = stream;
      video.play();

      video.addEventListener('canplay', () => {
        initOpenCV();
        isStreaming = true;
      }, { once: true });
    })
    .catch((err) => {
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.innerText = 'Error accessing webcam: ' + err;
    });
}

function initOpenCV() {
  const width = video.width;
  const height = video.height;

  // Video capture object
  cap = new cv.VideoCapture(video);

  // Allocate persistent matrices once to avoid memory churn
  src = new cv.Mat(height, width, cv.CV_8UC4);
  rgb = new cv.Mat(height, width, cv.CV_8UC3);
  samples32f = new cv.Mat();
  labels = new cv.Mat();
  centers = new cv.Mat();
  clustered = new cv.Mat(height, width, cv.CV_8UC3);
  dst = new cv.Mat(height, width, cv.CV_8UC4);
}

// compositional
function initVoronoi() {
  if (!cvReady) return;

  // Define a Subdiv2D space over the canvas bounding rectangle
  let rect = new cv.Rect(0, 0, width, height);
  voronoiSubdiv = new cv.Subdiv2D(rect);
}

function draw() {
  if (!cvReady || !isStreaming) return;

  // 1. Read frame from <video> into RGBA Mat
  cap.read(src);

  // 2. RGBA -> RGB
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);
  let sampleCount = rgb.rows * rgb.cols;


  // 3. Fast Reshape: Transform (H x W x 3) image matrix to (N x 3) layout for K-means
  samples32f = new cv.Mat(sampleCount, 3, cv.CV_32F);
  let rgbData = rgb.data;          // Raw 8-bit byte array
  let samplesData = samples32f.data32F; // Raw 32-bit float array

  for (let i = 0; i < sampleCount; i++) {
    let idx = i * 3;
    samplesData[idx]     = rgbData[idx];     // R
    samplesData[idx + 1] = rgbData[idx + 1]; // G
    samplesData[idx + 2] = rgbData[idx + 2]; // B
  }

  // 4. K-means clustering
  //use the center point from previous frame to prevent glitching caused by randomly assigned center
  let flags = (centers.rows > 0 && centers.rows === k) 
  ? cv.KMEANS_USE_INITIAL_LABELS 
  : cv.KMEANS_PP_CENTERS;

  let criteria = new cv.TermCriteria(cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER, 10, 1.0);
  cv.kmeans(samples32f, k, labels, criteria, 1, flags, centers);

  // 5. Map cluster center colors back to pixels
  let centers8u = new cv.Mat();
  centers.convertTo(centers8u, cv.CV_8U);

  // 6. map clusters color back to clustered matrix buffer 
  let clusteredData = clustered.data;
  let centersData = centers8u.data;
  let labelsData = labels.data32S; // Int32 labels array

  for (let i = 0; i < sampleCount; i++) {
    let clusterIdx = labelsData[i];
    let pixelIdx = i * 3;
    let centerIdx = clusterIdx * 3; //get the means of RGB center

    clusteredData[pixelIdx]     = centersData[centerIdx];     // R
    clusteredData[pixelIdx + 1] = centersData[centerIdx + 1]; // G
    clusteredData[pixelIdx + 2] = centersData[centerIdx + 2]; // B
  }

  // 7. Convert Clustered RGB back to RGBA for canvas rendering
  cv.cvtColor(clustered, dst, cv.COLOR_RGB2RGBA);

  // 8. Render directly onto p5 canvas element
  cv.imshow(p5Canvas, dst);

  // Free local temporary frame matrices
  samples32f.delete();
  centers8u.delete();


  // draw compositions
  // 1. Draw Stylized Composition Lines
  let roiCenter = createVector(mouseX || width / 2, mouseY || height / 2);
  let roiRadius = 220;

  drawCompositionLines();

  // 2. Render Region-Constrained Voronoi Facets via OpenCV
  if (cvReady && voronoiSubdiv) {
    drawConstrainedVoronoi(roiCenter, roiRadius);
  }

  // ROI Boundary ring for visual emphasis
  noFill();
  stroke(255, 255, 255, 255);
  strokeWeight(1);
  ellipse(roiCenter.x, roiCenter.y, roiRadius * 1);
}

// Deviding the image with Voronoi 
function drawConstrainedVoronoi(roiCenter, roiRadius) {
  let facetList = new cv.Point2fVectorVector();
  let centers = new cv.Point2fVector();

  // Obtain Voronoi facet polygons from OpenCV
  voronoiSubdiv.getVoronoiFacetList(new cv.IntVector(), facetList, centers);

  stroke(100, 200, 255, 180);
  strokeWeight(1.2);
  fill(255, 255, 255, 8);

  for (let i = 0; i < facetList.size(); i++) {
    let facet = facetList.get(i);
    
    // Convert facet points to p5 vectors
    let poly = [];
    for (let j = 0; j < facet.size(); j++) {
      let pt = facet.get(j);
      poly.push(createVector(pt.x, pt.y));
    }

    // Check if facet centroid falls within the target ROI
    let centroid = getPolyCentroid(poly);
    if (p5.Vector.dist(centroid, roiCenter) < roiRadius) {
      beginShape();
      poly.forEach(v => vertex(v.x, v.y));
      endShape(CLOSE);
    }
  }

  // Clean up OpenCV vector handles
  facetList.delete();
  centers.delete();
}

function drawCompositionLines() {
  stroke(255, 255, 255, 30);
  strokeWeight(1);

  // Rule of Thirds Grid
  line(width * 0.33, 0, width * 0.33, height);
  line(width * 0.66, 0, width * 0.66, height);
  line(0, height * 0.33, width, height * 0.33);
  line(0, height * 0.66, width, height * 0.66);

  // Dynamic Diagonals connecting canvas corners through mouse position
  stroke(255, 180, 0, 50);
  line(0, 0, width, height);
  line(width, 0, 0, height);
  line(0, height / 2, mouseX, mouseY);
  line(width, height / 2, mouseX, mouseY);
}

function getPolyCentroid(pts) {
  let cx = 0, cy = 0;
  pts.forEach(p => { cx += p.x; cy += p.y; });
  return createVector(cx / pts.length, cy / pts.length);
}

function keyPressed() {
  if (key === '+' || key === '=') {
    k++;
    document.getElementById('kVal').innerText = k;
  } else if (key === '-' && k > 2) {
    k--;
    document.getElementById('kVal').innerText = k;
  }
  initVoronoi();
}