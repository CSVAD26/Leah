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

  display(pg) {
    let target = pg || window;
    target.push();

    target.translate(this.pos.x, this.pos.y, this.pos.z);
    
    target.colorMode(HSB, 360, 100, 100, 255);
    target.noFill();

    // Calculate dynamic values once per frame before looping particles
    let totalEnergy = (this.bass + this.mid + this.treble) + 0.001;
    let dynamicWeight = target.map(totalEnergy, 0, 400, 1, 20, true) + 5;
    target.strokeWeight(dynamicWeight);

    let noiseSpeed = target.map(this.treble, 0, 255, 0.01, 0.25);
    let bassPulse = target.map(this.bass, 0, 255, 0, 180, true);
    let frequencyScale = target.map(this.harmonics, 1, 12, 50, 150);
    let targetDisplayRadius = this.radius + bassPulse + frequencyScale;

    this.currentDisplayRadius = target.lerp(this.currentDisplayRadius, targetDisplayRadius, 0.15);

    // Color and brightness mappings
    let liveHue = target.map(this.centroid, 261.63, 523.25, 0, 360, true);
    let brightnessVal = target.map(totalEnergy, 0, 765, 50, 100);  //total band range (0,255)*3, bass + mid + high

    // Update and render all active particles (Combined into a single loop for performance)
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

      let n = target.noise(p.noiseOffset + frameCount * noiseSpeed);
      let harmonicWave = target.sin(p.theta * this.harmonics) * 18;
      let currentRadius = this.radius + bassPulse + harmonicWave + (n * 50 - 25);
      
      let targetX = currentRadius * target.sin(p.phi) * target.cos(p.theta);
      let targetY = currentRadius * target.sin(p.phi) * target.sin(p.theta);
      let targetZ = currentRadius * target.cos(p.phi);

      p.currentX = target.lerp(p.currentX, targetX, 0.2);
      p.currentY = target.lerp(p.currentY, targetY, 0.2);
      p.currentZ = target.lerp(p.currentZ, targetZ, 0.2);

      // Fade out alpha over time
      let alphaVal = target.map(p.life, 0, p.maxLife, 0, 255);
      let trailAlpha = target.map(p.life, 0, p.maxLife, 0, 100);

      // Variation 2: trails activated by bass
      target.stroke(liveHue, 90, brightnessVal, alphaVal);
      
      //responsive visuals
      let vx = p.currentX - p.prevX;
      let vy = p.currentY - p.prevY;
      let vz = p.currentZ - p.prevZ;


      /*
      // --- CLEANED & NOISE-RESISTANT AUDIO THRESHOLDS ---
      if (totalEnergy < 15) {
        // 1. SILENCE / ROOM NOISE: Do nothing or render subtle static points
        target.point(p.currentX, p.currentY, p.currentZ);
      } 
      else if (totalEnergy >= 15 && totalEnergy < 40) {
        // 2. SOFT SPEECH / WHISPER: Short directional lines
         vx = p.currentX - p.prevX;
         vy = p.currentY - p.prevY;
         vz = p.currentZ - p.prevZ;

        target.beginShape(LINES);
        target.vertex(p.currentX, p.currentY, p.currentZ);
        target.vertex(p.currentX + vx * 2, p.currentY + vy * 2, p.currentZ + vz * 2);
        target.endShape();
      } 
      else if (totalEnergy >= 40 && totalEnergy < 65) {
        // 3. NORMAL SPEAKING VOICE: Medium gray ellipsoids
         vx = p.currentX - p.prevX;
         vy = p.currentY - p.prevY;
         vz = p.currentZ - p.prevZ;

        target.stroke(205);
        target.strokeWeight(0.7);
        target.ellipsoid(p.currentX * vx * 0.02, p.currentY * vy * 0.02, p.currentZ * vz * 0.04, 5, 5, 5);
      } 
      else if (totalEnergy >= 65 && totalEnergy < 85) {
        // 4. LOUD SPEECH: Long directional energy spikes
         vx = p.currentX - p.prevX;
         vy = p.currentY - p.prevY;
         vz = p.currentZ - p.prevZ;

        target.beginShape(LINES);
        target.vertex(p.currentX, p.currentY, p.currentZ);
        target.vertex(p.currentX + vx * 5, p.currentY + vy * 5, p.currentZ + vz * 5);
        target.endShape();
      } 
      else {
        // 5. SHOUTING / PEAKS (> 85): Heavy glowing ellipsoids
         vx = p.currentX - p.prevX;
         vy = p.currentY - p.prevY;
         vz = p.currentZ - p.prevZ;

        target.stroke(215, 245, 98);
        target.strokeWeight(5);
        target.ellipsoid(p.currentX * vx * 0.04, p.currentY * vy * 0.02, p.currentZ * vz * 0.01);
      }
        */
      
      if (totalEnergy > 5 && totalEnergy < 35) {
        target.beginShape(LINES);
        target.vertex(p.currentX, p.currentY, p.currentZ);
        target.vertex(p.currentX, p.currentY + vy * 3, p.currentZ + vz * 3);
        target.endShape();
      } else if (totalEnergy > 55) {
        target.beginShape(LINES);
        target.vertex(p.currentX, p.currentY, p.currentZ);
        target.vertex(p.currentX, p.currentY + vy * 5, p.currentZ + vz * 5);
        target.endShape();
      } else if (totalEnergy > 45 && totalEnergy < 55) {
        target.stroke(205);
        target.strokeWeight(0.7);
        target.ellipsoid(p.currentX * vx * 0.02, p.currentY * vy * 0.02, p.currentZ * vz * 0.04, 5, 5, 5);
      } else if (totalEnergy > 75) {
        target.stroke(215, 245, 98);
        target.strokeWeight(5);
        target.ellipsoid(p.currentX * vx * 0.04, p.currentY * vy * 0.02, p.currentZ * vz * 0.01);
      } else {
        target.point(p.currentX, p.currentY, p.currentZ);  //Variation 1: dots activated by frequency
      }

      // Render secondary motion trails inline to avoid a second redundant array loop
      target.stroke(p.colorHue, 85, 90, trailAlpha);
      //strokeWeight(1);
      target.line(p.prevX, p.prevY, p.prevZ, p.currentX, p.currentY, p.currentZ);
    }
    
    
    target.colorMode(RGB, 255, 255, 255, 255);
    target.pop();
  }
}
