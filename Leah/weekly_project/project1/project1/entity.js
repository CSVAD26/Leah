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

    this.particles = [];
    this.initParticles(3000);
  }

  initParticles(count) {
    for (let i = 0; i < count; i++) {

    let theta = random(TWO_PI);
    let phi = acos(random(-1, 1));
    let maxLife = random(60, 180); // Particle lifespan in frames

      this.particles.push({
        theta: random(TWO_PI),
        phi: acos(random(-1, 1)),
        noiseOffset: random(1000),

        // Particle-specific position tracking for feedback/delay inertia
        currentX: 0,
        currentY: 0,
        currentZ: 0,
        life: maxLife,
        maxLife: maxLife,
      });
    }
  }

  update() {
    this.pos.add(this.velocity);
    this.velocity.mult(0.85); // Damping friction
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y, this.pos.z);
    
    stroke(25, 200);
    strokeWeight(1.5);
    noFill();

    // Map treble to noise turbulence speed
    let noiseSpeed = map(this.treble, 0, 255, 0.01, 0.25);

    // Map bass energy to a sudden radius kick pulse
    let bassPulse = map (this.bass, 0, 255, 0, 180, true);
    let targetDisplayRadius = this.radius + bassPulse;

    //interpolate toward the target radius (smooth transition)
    this.currentDisplayRadius = lerp(this.currentDisplayRadius, targetDisplayRadius, 0.15);

    beginShape(POINTS);
    for (let p of this.particles) {
    
        p.life--;
        if (p.life<0){
            p.theta = random(TWO_PI);
            p.phi = acos(random(-1, 1));
            p.noiseOffset = random(1000);
            p.maxLife = random(60, 180);
            p.life = p.maxLife;

            // Reset starting position instantly to avoid flying streaks across the screen
            let initWave = sin(p.theta * this.harmonics) * 18;
            let initRadius = this.currentDisplayRadius + initWave;

            p.currentX = initRadius * sin(p.phi) * cos(p.theta);
            p.currentY = initRadius * sin(p.phi) * sin(p.theta);
            p.currentZ = initRadius * cos(p.phi);
        }

        let n = noise(p.noiseOffset + frameCount * noiseSpeed);
        let harmonicWave = sin(p.theta * this.harmonics) * 18;

        //Combine bass radius, gesture size, harmonic shape, bass punch, and treble jitter
        let currentRadius = this.radius + bassPulse + harmonicWave + (n * 50 - 25);
        
        let targetX = currentRadius * sin(p.phi) * cos(p.theta);
        let targetY = currentRadius * sin(p.phi) * sin(p.theta);
        let targetZ = currentRadius * cos(p.phi);

        // Delay Motion:
        // Lerp each particle's actual display position toward its target, creating a viscous, lagging momentum trail per particle
        p.currentX = lerp(p.currentX, targetX, 0.2);
        p.currentY = lerp(p.currentY, targetY, 0.2);
        p.currentZ = lerp(p.currentZ, targetZ, 0.2);

        vertex(p.currentX, p.currentY, p.currentZ);
    }
    endShape();
    pop();
  }
}