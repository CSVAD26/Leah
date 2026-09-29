
let eyeOffset =40;
let deg_start=0;
let deg_end=180;

function setup() {
  createCanvas(800, 800);
 
}

function draw() {
  let centerX = width/2;
  let centerY = height/2;
  background(195, 228, 247);

  //head
  stroke(212,119,83);
  strokeWeight(4);
  fill(227, 184, 167);
  ellipse(centerX, centerY, 700, 700);


  //eyes
  fill(255);
  circle(centerX-eyeOffset, centerY-eyeOffset, 50);
  circle(centerX+eyeOffset, centerY-eyeOffset, 50);
  
  //pupils
  stroke(0);
  fill(0);
  circle(centerX-eyeOffset+10,centerY-eyeOffset, 10);
  circle(centerX+eyeOffset+10, centerY-eyeOffset, 10);

  //brows
  stroke(0);
  line(centerX-eyeOffset, centerY-eyeOffset-70, centerX-eyeOffset-70, centerY-eyeOffset-100);
  line(centerX+eyeOffset, centerY-eyeOffset-70, centerX+eyeOffset+70, centerY-eyeOffset-100);
  //nose
  fill(255,90,25);
  stroke(255,90,25);
  triangle(centerX, centerY-20, centerX-20, centerY+20, centerX+20, centerY+20);

  //mouth
  noFill();
  stroke(212,119,83);
  arc(centerX, centerY, 400, 300,radians(0), radians(180), OPEN);
}
