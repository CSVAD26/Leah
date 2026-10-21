class Entity {
  constructor(x, y, z) {
    this.pos = createVector(x, y, z);
    this.velocity = createVector(0, 0, 0);
    this.frequency = 440;
    this.harmonics = 3;   // Sound frequency shapes harmonics
    this.radius = 100;    // Gesture pinch changes size
    this.currentDisplayRadius = 100; // Initialized properly for smooth transitions

    //multi-band audio hooks
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.centroid = 261.63;
    this.spectrum = null; // Holds the live FFT spectrum array reference

    this.particles = [];
  }

  initParticles(count) {
    for (let i = 0; i < count; i++) {
      this.spawnParticle();
    }
  }

  spawnParticle() {
    let theta = random(TWO_PI);
    let phi = acos(random(-1, 1));
    let maxLife = random(60, 200); // Particle lifespan in frames

    let initWave = sin(theta * this.harmonics) * 18;
    let initRadius = this.currentDisplayRadius + initWave;
    let startX = initRadius * sin(phi) * cos(theta);
    let startY = initRadius * sin(phi) * sin(theta);
    let startZ = initRadius * cos(phi);

    this.particles.push({
      theta: theta,
      phi: phi,
      noiseOffset: random(1000),
      currentX: startX,
      currentY: startY,
      currentZ: startZ,
      prevX: startX,     // Track previous X position
      prevY: startY,     
      prevZ: startZ,     
      life: maxLife,
      maxLife: maxLife,
      colorHue: random(360)
    });
  }

  update(audioData, spectrum) {
    this.pos.add(this.velocity);
    this.velocity.mult(0.85); // Damping friction

    if (audioData) {
      this.bass = audioData.bass;
      this.mid = audioData.mid;
      this.treble = audioData.treble;
      this.harmonics = max(1, audioData.harmonics);
      this.centroid = audioData.centroid || 261.63;

      let totalEnergy = this.bass + this.mid + this.treble;
      if (totalEnergy > 20) {
        let spawnCount = floor(map(totalEnergy, 20, 765, 1, 3, true)); 
        for (let i = 0; i < spawnCount; i++) {
          this.spawnParticle();
        }
      }
    }

    this.spectrum = spectrum; 

    if (this.particles.length > 5000) {
      this.particles.splice(0, this.particles.length - 5000);
    }
  }

  display() {
    push();

    translate(this.pos.x, this.pos.y, this.pos.z);
    
    colorMode(HSB, 360, 100, 100, 255);
    noFill();

    // Calculate dynamic values once per frame before looping particles
    let totalEnergy = (this.bass + this.mid + this.treble) + 0.001;
    let dynamicWeight = map(totalEnergy, 0, 400, 1, 20, true) + 5;
    strokeWeight(dynamicWeight);

    let noiseSpeed = map(this.treble, 0, 255, 0.01, 0.25);
    let bassPulse = map(this.bass, 0, 255, 0, 180, true);
    let frequencyScale = map(this.harmonics, 1, 12, 50, 150);
    let targetDisplayRadius = this.radius + bassPulse + frequencyScale;

    this.currentDisplayRadius = lerp(this.currentDisplayRadius, targetDisplayRadius, 0.15);

    // Color and brightness mappings
    let liveHue = map(this.centroid, 261.63, 523.25, 0, 360, true);
    let brightnessVal = map(totalEnergy, 0, 765, 50, 100);  //total band range (0,255)*3, bass + mid + high

    // Update and render all active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];

      p.life--;
      if (p.life < 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Store previous position before updating
      p.prevX = p.currentX;
      p.prevY = p.currentY;
      p.prevZ = p.currentZ;

      let n = noise(p.noiseOffset + frameCount * noiseSpeed);
      let harmonicWave = sin(p.theta * this.harmonics) * 18;
      let currentRadius = this.radius + bassPulse + harmonicWave + (n * 50 - 25);
      
      let targetX = currentRadius * sin(p.phi) * cos(p.theta);
      let targetY = currentRadius * sin(p.phi) * sin(p.theta);
      let targetZ = currentRadius * cos(p.phi);

      p.currentX = lerp(p.currentX, targetX, 0.2);
      p.currentY = lerp(p.currentY, targetY, 0.2);
      p.currentZ = lerp(p.currentZ, targetZ, 0.2);

      // Fade out alpha over time
      let alphaVal = map(p.life, 0, p.maxLife, 0, 255);


      // Variation 1: dots activated by frequency
      //stroke(liveHue, 90, brightnessVal, alphaVal);

      //point(p.currentX, p.currentY, p.currentZ);

      // Variation 2: trails activated by bass
      stroke(liveHue, 90, brightnessVal, alphaVal);
      

      //responsive visuals
      let vx = p.currentX - p.prevX;
      let vy = p.currentY - p.prevY;
      let vz = p.currentZ - p.prevZ;

      if(totalEnergy > 55){
        beginShape(LINES);
        vertex(p.currentX, p.currentY, p.currentZ);
        vertex(p.currentX, p.currentY + vy * 3, p.currentZ + vz * 3);
        endShape();
        } 
        else if (totalEnergy>45 && totalEnergy<55){
          stroke(205);
          strokeWeight(0.7);
          ellipsoid(p.currentX*vx*0.02, p.currentY*vy*0.02, p.currentZ*vz*0.04, 5,5,5 );
          
      }
      else if (totalEnergy>75 && totalEnergy){
          stroke(215, 245, 98);
          strokeWeight(10);
          ellipsoid(p.currentX*vx*0.04, p.currentY*vy*0.02, p.currentZ*vz*0.01);
          
      }
      else{
        point(p.currentX, p.currentY, p.currentZ);  //Variation 1: dots activated by frequency
      }
    }

    
    //second motion trails in diffent tone
      for (let p of this.particles) {
        let alphaVal = map(p.life, 0, p.maxLife, 0, 100);
        stroke(p.hue, 85, 90, alphaVal);
        line(p.prevX, p.prevY, p.prevZ, p.currentX, p.currentY, p.currentZ);
      }
        
      colorMode(RGB, 255, 255, 255, 255);
      pop();
  }
}
    
