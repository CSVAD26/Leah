// Swatch examples in maximum amount of 10 that can be selected, moved, and recolored. Aids in understanding how color perception is relative based on other colors.
let swatch1;
let swatch2;
let swatch3;
let swatch4;
let swatch5;

let swatches = [];
let swatchCount=3;

// Change the swatch's color: when pressing "c" and drag and hold
//Change the swatch's size: when pressing "s" and drag and hold
let colorShift = false;
let sizeShift= false;

function setup() {
  createCanvas(800, 800);

  // Create 3 swatches with different positions and sizes.
  swatch1 = new Swatch(100, 100, 500, 500);
  swatch2 = new Swatch(500, 100, 300, 100);
  swatch3 = new Swatch(400, 200, 200, 200);

  swatches.push(swatch1, swatch2, swatch3);
}

function draw() {
  colorMode(RGB, 255);
  background(200, 200, 200);
  // Draw every swatch, including its selection outline when selected.
  for (let i = 0; i < swatches.length; i++) {
    swatches[i].draw();
  }

  fill(0);
  //change text here: Rules
  text('click to select a swatch, drag to move, hold down key to change hue',10, height-10);
}

function mousePressed() {
  // Check from last to first so the visually topmost overlapping swatch is selected.
  for (let i = swatches.length - 1; i >= 0; i--) {
    let s = swatches[i];
    let hitTest = s.hitTest(mouseX, mouseY);

    if (hitTest) {
      s.selected = true;
      print("selected", i);
      return;
    }
  }
  
}

function keyPressed() {
  // Holding key "c" enables color-adjustment mode.
  if(key==="c" || key==="C"){
    colorShift = true;
  }
  if(key==="s" || key==="S"){
    sizeShift = true;
  }
  // add new swatch. Maximum amount of swatches = 10
  if(key==="a"||key==="A"){
    if(swatches.length < 10){
      let s = new Swatch(mouseX, mouseY, 100, 100);
      swatches.push(s);
      swatchCount++;
    }
  }
  //delete swatch when pressing "d"
  for (i=swatches.length; i--; i>0){
    let s = swatches[i];
    if(s.selected==true){
      if(key==="d" || key==="D"){
        swatches.splice(i, 1);
        swatchCount--;
      }
    }
  }
}

function keyReleased() {
  // Releasing the key returns dragging to movement mode.
  if(key==="c" || key==="C"){
    colorShift = false;
  }
  if (key==="s"|| key==="S"){
    sizeShift = false; 
  }
}

function mouseReleased() {
  // End selection when the user releases the mouse button.
  deselectAllSwatches();
}

function mouseWheel(event) {
  // Use wheel direction and amount as the color adjustment value.
  let e = round(event.delta);
  for (let i = 0; i < swatches.length; i++) {
    let s = swatches[i];
    if (s.selected) {
      if (colorShift) {
        s.updateColor(createVector(0, 0), e);
      }
      return;
    }
  }
}


//1. move swatch 2. change swatch size 3. change hue
function mouseDragged() {
  // Compare the current pointer position with the previous frame's position.
  let delta = createVector(mouseX - pmouseX, mouseY - pmouseY);
  for (let i = 0; i < swatches.length; i++) {
    let s = swatches[i];
    if (s.selected) {
      // Holding "s" while dragging adjusts swatch's size
      if (sizeShift) {
        s.w = max(5, s.w + delta.x); // Adjust width with horizontal drag, minumum is 5 pixels
        s.h = max(5, s.h + delta.y);
      }
      else if (colorShift) {
        // Holding "c" while dragging adjusts the selected swatch's color.
        s.updateColor(delta, 0);
      } 
      else {
         // Normal drag moves the selected swatch with the pointer.
         s.moveBy(delta);
      }
      return;
    }
  }
}

function deselectAllSwatches() {
  // Clear the selection state from every swatch.
  for (let i = 0; i < swatches.length; i++) {
    swatches[i].selected = false;
  }
}

// ---------------- Swatch Class ----------------

class Swatch {
  constructor(x, y, w, h) {
    // Store geometry and assign a random starting RGB color.
    this.pos = createVector(x, y);
    this.w = w;
    this.h = h;
    this.c = color(random(255), random(255), random(255));
    this.selected = false;
  }

  draw() {
    // Draw the filled rectangle, then outline it if it is selected.
    fill(this.c);
    rect(this.pos.x, this.pos.y, this.w, this.h);
    if (this.selected) {
      noFill();
      stroke(0);
      strokeWeight(2);
      rect(this.pos.x, this.pos.y, this.w, this.h);
      noStroke();
    }
  }

  hitTest(mx, my) {
    // Return true when the pointer is inside this swatch's rectangle.
    return (mx > this.pos.x && mx < this.pos.x + this.w &&
            my > this.pos.y && my < this.pos.y + this.h);
  }

  moveBy(delta) {
    // Add a pointer movement vector to the swatch's position.
    this.pos.add(delta);
  }

  updateColor(delta, wheelDelta) {
    console.log("updateColor", wheelDelta);
    // Adjust red with horizontal dragging or the wheel, and green with vertical dragging.
    // This changes RGB channels;
    // WHEEL DELTA IS NOT RELIABLE ACROSS BROWSERS.
    let r = red(this.c) + delta.x * 0.5;
    let g = green(this.c) + delta.y * 0.5;
    let b = blue(this.c) + wheelDelta* 0.5;

    this.c = color(constrain(r, 0, 255),
                   constrain(g, 0, 255),
                   constrain(b, 0, 255));
  }
}
